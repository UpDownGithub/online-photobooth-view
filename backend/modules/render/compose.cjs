const sharp = require('sharp');
const { resolveTemplate, buildFrameGeometry, slotOrder } = require('../frames/layouts.cjs');
const { FILTERS } = require('../filters/filters.cjs');

const MAX_PIXELS = 4096 * 4096;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// Buffer-only boundary: never pass a path, URL, SVG or storage identifier to Sharp.
// These sample checks are independent of the operating service's upload handler.
async function validateImage(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('INVALID_IMAGE_BUFFER');
  }
  // Reject non-raster signatures before asking an image decoder to inspect data.
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  const webp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('UNSUPPORTED_IMAGE');
  const meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) !== 1) {
    throw new Error('UNSUPPORTED_IMAGE');
  }
}

// Adapted from render.service.js. Only preloaded raster buffers are accepted.
async function composeReview({ room, shots, overlay = null, stickers = [] }) {
  if (room?.status !== 'REVIEW') throw new Error('ROOM_NOT_IN_REVIEW');
  const count = room.users?.length;
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error('INVALID_PARTICIPANTS');
  const template = resolveTemplate(room.settings?.template, count);
  const layout = buildFrameGeometry(template);
  const displayOrder = slotOrder(template, room.session?.shotOrder);
  if (displayOrder.length !== layout.slots.length) throw new Error('INVALID_SHOT_ORDER');
  if (!Array.isArray(shots) || shots.length > layout.slots.length) throw new Error('INVALID_SHOTS');
  if (!Array.isArray(stickers) || stickers.length > 24) throw new Error('INVALID_STICKERS');

  const shotBuffers = new Map();
  for (const shot of shots) {
    if (!Number.isInteger(shot.shotIndex) || !displayOrder.includes(shot.shotIndex)
      || shotBuffers.has(shot.shotIndex)) throw new Error('INVALID_SHOT_INDEX');
    if (shot.generation !== room.session.generation) throw new Error('STALE_SHOT');
    await validateImage(shot.buffer);
    shotBuffers.set(shot.shotIndex, shot.buffer);
  }
  if (overlay !== null) await validateImage(overlay);
  const filterId = hasOwn(FILTERS, room.settings?.filter) ? room.settings.filter : 'none';
  const recipe = FILTERS[filterId].recipe;
  const useOverlay = overlay !== null;
  const bleed = useOverlay ? 2 : 0;
  const composites = [];
  if (!useOverlay) {
    composites.push({ input: await roundedPlate(layout.width, layout.height, layout.style), top: 0, left: 0 });
  }
  for (let i = 0; i < layout.slots.length; i++) {
    const slot = layout.slots[i];
    const width = slot.w + bleed * 2;
    const height = slot.h + bleed * 2;
    const source = shotBuffers.get(displayOrder[i]);
    const cell = source
      ? await applyFilterRecipe(source, width, height, recipe)
      : await sharp({ create: { width, height, channels: 4, background: '#222222' } }).png().toBuffer();
    composites.push({
      input: useOverlay ? cell : await roundCorners(cell, width, height, layout.style.cornerRadius),
      top: slot.y - bleed, left: slot.x - bleed,
    });
  }
  if (layout.header > 0 && !useOverlay) {
    composites.push({ input: buildHeaderSvg(layout.width, layout.header, room, layout.style), top: 0, left: 0 });
  }
  if (useOverlay) {
    composites.push({ input: await sharp(overlay).resize(layout.width, layout.height,
      { fit: 'fill' }).png().toBuffer(), top: 0, left: 0 });
  }
  for (const sticker of stickers) {
    const layer = await buildStickerLayer(sticker, layout.width, layout.height);
    if (layer) composites.push(layer);
  }
  // No withMetadata/keepMetadata: only the generated pixels are encoded.
  return sharp({ create: { width: layout.width, height: layout.height, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites).webp({ quality: 90 }).toBuffer();
}

async function buildStickerLayer(sticker, canvasW, canvasH) {
  if (!sticker || ![sticker.x, sticker.y, sticker.scale, sticker.rotation ?? 0].every(Number.isFinite)
    || sticker.x < 0 || sticker.x > 1 || sticker.y < 0 || sticker.y > 1
    || sticker.scale <= 0 || sticker.scale > 1 || Math.abs(sticker.rotation ?? 0) > 360) {
    throw new Error('INVALID_STICKER');
  }
  await validateImage(sticker.buffer);
  const width = Math.max(1, Math.round(sticker.scale * Math.min(canvasW, canvasH)));
  const rotated = await sharp(sticker.buffer).resize({ width })
    .rotate(sticker.rotation || 0, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer({ resolveWithObject: true });
  const w = rotated.info.width;
  const h = rotated.info.height;
  const left = Math.round(sticker.x * canvasW - w / 2);
  const top = Math.round(sticker.y * canvasH - h / 2);
  // Clip a rotated sticker to the frame, preserving its centre at the edge.
  const cropX = Math.max(0, -left);
  const cropY = Math.max(0, -top);
  const visibleW = Math.min(w - cropX, canvasW - Math.max(0, left));
  const visibleH = Math.min(h - cropY, canvasH - Math.max(0, top));
  if (visibleW <= 0 || visibleH <= 0) return null;
  const input = cropX || cropY || visibleW !== w || visibleH !== h
    ? await sharp(rotated.data).extract({ left: cropX, top: cropY, width: visibleW, height: visibleH }).png().toBuffer()
    : rotated.data;
  return { input, left: Math.max(0, left), top: Math.max(0, top) };
}

module.exports = { composeReview };

function roundedPlate(width, height, style) {
  const r = Math.round(Math.min(width, height) * style.cardRadius);
  return sharp(
    Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" rx="${r}" ry="${r}" fill="${style.frameColor}"/>
      </svg>`,
    ),
  )
    .png()
    .toBuffer();
}

async function roundCorners(buffer, w, h, radiusRatio) {
  const r = Math.round(Math.min(w, h) * radiusRatio);
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
  return sharp(buffer)
    .resize(w, h, { fit: 'cover', position: 'centre' }) // 이미 w×h지만 fallback 등 안전 보장
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function buildHeaderSvg(width, header, room, style) {
  const stamp = room.session?.startedAt ?? 0;
  const d = new Date(stamp);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const titleSize = Math.round(Math.min(width * 0.042, header * 0.34));
  const dateSize = Math.round(titleSize * 0.42);

  return Buffer.from(`
    <svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="${header * 0.52}" text-anchor="middle"
        font-family="${style.fontFamily}" font-size="${titleSize}"
        letter-spacing="${(titleSize * 0.06).toFixed(1)}" fill="${style.titleColor}">${style.title}</text>
      <text x="50%" y="${header * 0.8}" text-anchor="middle"
        font-family="${style.fontFamily}" font-size="${dateSize}" letter-spacing="2" fill="${style.dateColor}">${date}</text>
    </svg>`);
}

const FILTER_REF_CELL = 560;

async function applyFilterRecipe(inputBuffer, width, height, recipe) {
  let pipeline = sharp(inputBuffer, { limitInputPixels: MAX_PIXELS }).resize(width, height, { fit: 'cover', position: 'centre' });

  if (!recipe) {
    return pipeline.png().toBuffer();
  }

  const s = Math.max(width, height) / FILTER_REF_CELL;

  if (recipe.preBlur) pipeline = pipeline.blur(recipe.preBlur * s);
  if (recipe.linear) pipeline = pipeline.linear(recipe.linear[0], recipe.linear[1]);
  if (recipe.matrix) pipeline = pipeline.recomb(recipe.matrix);

  let buffer = await pipeline.png().toBuffer();

  if (recipe.aberration) {
    buffer = await applyAberration(buffer, width, height, Math.max(1, Math.round(recipe.aberration * s)));
  }

  const layers = [];
  if (recipe.glow) {
    layers.push({
      input: await sharp(buffer).blur(6 * s).ensureAlpha(recipe.glow).png().toBuffer(),
      blend: 'screen',
    });
  }
  if (recipe.wash) {
    layers.push({
      input: await sharp({
        create: { width, height, channels: 4, background: { r: 55, g: 55, b: 58, alpha: recipe.wash } },
      }).png().toBuffer(),
      blend: 'over',
    });
  }
  if (recipe.scanline) {
    layers.push({
      input: await scanlineTile(width, height, Math.max(2, Math.round(4 * s)), recipe.scanline),
      blend: 'multiply',
    });
  }
  if (recipe.grain) {
    layers.push({ input: await grainTile(width, height, recipe.grainAmp || 100, recipe.grain, s), blend: 'overlay' });
  }

  let out = sharp(buffer);
  if (layers.length) out = out.composite(layers);
  return out.png().toBuffer();
}

async function applyAberration(buffer, width, height, amount) {
  const [r, g, b] = await Promise.all([
    shiftedChannel(buffer, width, height, 0, -amount, 0),
    shiftedChannel(buffer, width, height, 1, 0, 0),
    shiftedChannel(buffer, width, height, 2, amount, Math.ceil(amount / 2)),
  ]);

  const raw = { raw: { width, height, channels: 1 } };
  return sharp(r, raw).joinChannel([g, b], raw).png().toBuffer();
}

async function shiftedChannel(buffer, width, height, channel, dx, dy) {
  const pad = Math.max(Math.abs(dx), Math.abs(dy)) + 4;
  const padded = await sharp(buffer)
    .extractChannel(channel)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: 'copy' })
    .png()
    .toBuffer();

  return sharp(padded)
    .extract({ left: pad - dx, top: pad - dy, width, height })
    .toColourspace('b-w') // 1채널 PNG 재로딩 시 srgb(3채널)로 승격되는 것을 방지
    .raw()
    .toBuffer();
}

async function grainTile(width, height, amplitude, opacity, scale = 1) {
  const w = Math.max(1, Math.round(width / scale));
  const h = Math.max(1, Math.round(height / scale));
  const px = w * h;
  const data = Buffer.alloc(px * 4);
  const alpha = Math.round(opacity * 255);
  for (let i = 0; i < px; i += 1) {
    const noise = 128 + amplitude * (Math.random() + Math.random() - 1);
    const value = Math.max(0, Math.min(255, noise));
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = alpha;
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .resize(width, height, { kernel: 'nearest' })
    .png()
    .toBuffer();
}

function scanlineTile(width, height, period, opacity) {
  const data = Buffer.alloc(width * height * 4);
  const alpha = Math.round(opacity * 255);
  for (let y = 0; y < height; y += 1) {
    const dark = y % period === 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = dark ? 0 : 255;
      data[i + 3] = dark ? alpha : 0;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

