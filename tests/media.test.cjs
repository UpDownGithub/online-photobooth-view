const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { solid, rasterCanvas } = require('./helpers.cjs');
const { createShootingSession } = require('../backend/modules/shooting/shooting-session.cjs');
const { buildFrameGeometry } = require('../backend/modules/frames/layouts.cjs');
const { composeReview } = require('../backend/modules/render/compose.cjs');
const load = async () => ({
  ...await import('../frontend/src/media/capture-frame.js'),
  ...await import('../frontend/src/media/shot-upload.js'),
  ...await import('../frontend/src/media/shot-pipeline.js'),
});
function reviewFixture() {
  let time = 0;
  const session = createShootingSession({ userIds: ['demo-a', 'demo-b'], now: () => time });
  session.setReady('demo-a', true); session.setReady('demo-b', true); session.start('demo-a');
  for (let i = 0; i < 4; i++) { time += 3000; session.advance(); time += 1000; session.advance(); }
  return session.getState();
}
async function pixel(buffer, x, y) {
  return [...await sharp(buffer).extract({ left: x, top: y, width: 1, height: 1 })
    .removeAlpha().raw().toBuffer()];
}

test('capture uses the supplied video, central square, mirror transform, and never upscales', async () => {
  const { captureFrame } = await load();
  const video = { videoWidth: 1920, videoHeight: 1080 };
  const canvas = captureFrame({ video, size: 1360, createCanvas: rasterCanvas });
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1080);
  assert.deepEqual(canvas.calls, [
    ['translate', 1080, 0], ['scale', -1, 1],
    ['drawImage', 420, 0, 1080, 1080, 0, 0, 1080, 1080],
  ]);
  const portrait = captureFrame({ video: { videoWidth: 720, videoHeight: 1280 }, size: 500,
    mirrored: false, createCanvas: rasterCanvas });
  assert.deepEqual(portrait.calls, [['drawImage', 0, 280, 720, 720, 0, 0, 500, 500]]);
  assert.equal(captureFrame({ video: { videoWidth: 0 } }), null);
  assert.throws(() => captureFrame({ video, size: NaN }), /INVALID_CAPTURE_SIZE/);
});

test('over 5 MiB: JPEG quality changes without changing canvas dimensions or reusing lossy input', async () => {
  const { encodeShotForUpload, MAX_SHOT_BYTES } = await load();
  const qualities = [];
  const canvas = { width: 1360, height: 1360, toBlob(callback, type, quality) {
    qualities.push(quality);
    callback(new Blob([new Uint8Array(qualities.length < 3 ? MAX_SHOT_BYTES + 1 : 123)], { type }));
  } };
  const blob = await encodeShotForUpload(canvas);
  assert.equal(blob.size, 123);
  assert.deepEqual(qualities, [0.92, 0.86, 0.78]);
  assert.equal(canvas.width, 1360);
  assert.equal(canvas.height, 1360);
  const alwaysLarge = { width: 1, height: 1,
    toBlob: (cb, type) => cb(new Blob([new Uint8Array(MAX_SHOT_BYTES + 1)], { type })) };
  await assert.rejects(encodeShotForUpload(alwaysLarge), /SHOT_COMPRESSION_LIMIT/);
  await assert.rejects(encodeShotForUpload({ width: 1, height: 1,
    toBlob: (cb) => cb(null) }), /SHOT_ENCODING_FAILED/);
});

test('actual synthetic pixels encode to JPEG and preserve the requested crop dimensions', async () => {
  const { captureFrame, encodeShotForUpload } = await load();
  const canvas = captureFrame({ video: { videoWidth: 640, videoHeight: 480,
    pixels: await solid('#dd4422') }, size: 320, createCanvas: rasterCanvas });
  const blob = await encodeShotForUpload(canvas);
  const meta = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 320); assert.equal(meta.height, 320);
});

test('a real oversized synthetic JPEG is compressed below the limit without resizing', async () => {
  const { captureFrame, encodeShotForUpload, MAX_SHOT_BYTES } = await load();
  const side = 3000;
  const raw = Buffer.alloc(side * side * 3);
  // Deterministic noise; no user image or random credential is used.
  let seed = 12345;
  for (let i = 0; i < raw.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    raw[i] = seed & 255;
  }
  const pixels = await sharp(raw, { raw: { width: side, height: side, channels: 3 } }).png().toBuffer();
  const canvas = captureFrame({ video: { videoWidth: side, videoHeight: side, pixels },
    size: side, createCanvas: rasterCanvas });
  const first = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  assert.ok(first.size > MAX_SHOT_BYTES);
  canvas.qualities.length = 0;
  const result = await encodeShotForUpload(canvas);
  assert.ok(result.size <= MAX_SHOT_BYTES);
  assert.ok(canvas.qualities.length > 1);
  const meta = await sharp(Buffer.from(await result.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [side, side]);
});

test('delivery retries reuse one Blob; permanent failures and stale jobs stop', async () => {
  const { retryShotUpload } = await load();
  const params = { blob: new Blob(['synthetic']), shotIndex: 0 };
  const seen = []; const delays = [];
  const result = await retryShotUpload(async (input) => {
    seen.push(input.blob);
    if (seen.length < 3) throw Object.assign(new Error('temporary'), { status: 503 });
    return 'done';
  }, params, { wait: async (ms) => delays.push(ms) });
  assert.equal(result, 'done');
  assert.ok(seen.every((blob) => blob === params.blob));
  assert.deepEqual(delays, [600, 1200]);
  for (const status of [400, 403, 413]) {
    let attempts = 0;
    await assert.rejects(retryShotUpload(async () => { attempts++; throw Object.assign(new Error('rejected'), { status }); }, params));
    assert.equal(attempts, 1);
  }
  let current = true; let attempts = 0;
  assert.equal(await retryShotUpload(async () => { attempts++; throw new Error('temporary'); }, params,
    { wait: async () => { current = false; }, isCurrent: () => current }), null);
  assert.equal(attempts, 1);
});

test('capture occurs before encoding; duplicate completion shares a job; retake drops late encoding', async () => {
  const { createShotPipeline } = await load();
  let generation = 1; let encoded; let captures = 0; let deliveries = 0;
  const pipeline = createShotPipeline({
    capture: () => { captures++; return { width: 10, height: 10, toBlob: (cb) => { encoded = cb; } }; },
    deliver: async () => { deliveries++; }, isCurrent: (id) => id === generation,
  });
  const shot = { generation: 1, shotIndex: 0, userId: 'demo-a' };
  pipeline.onShotStarted(shot);
  assert.equal(encoded, undefined);
  const result = pipeline.onShotCompleted(shot);
  assert.equal(pipeline.onShotCompleted(shot), result);
  generation++;
  encoded(new Blob(['synthetic'], { type: 'image/jpeg' }));
  assert.equal(await result, null);
  assert.equal(captures, 1); assert.equal(deliveries, 0);
  pipeline.reset();
  await assert.rejects(pipeline.onShotCompleted({ ...shot, generation: 2 }), /CAPTURE_NOT_FOUND/);
});

test('connected Ready → capture → encoding → delivery → review render uses all four shots in display order', async () => {
  const { runExample } = require('../examples/shooting-flow.cjs');
  const { room, shots, buffer, events, html } = await runExample();
  assert.equal(room.status, 'REVIEW');
  assert.equal(shots.length, 4); assert.equal(events.length, 8);
  const meta = await sharp(buffer).metadata();
  assert.deepEqual([meta.width, meta.height, meta.format], [2188, 3108, 'webp']);
  assert.equal(meta.hasAlpha, true);
  assert.equal(meta.exif, undefined); assert.equal(meta.xmp, undefined); assert.equal(meta.iptc, undefined);
  assert.match(html, /photo-board/);
  // For two participants: chronological shots [0,1,2,3] display as [0,1,3,2].
  const slots = buildFrameGeometry('grid2x2').slots;
  const expectedColours = [[204, 68, 51], [68, 136, 85], [208, 170, 68], [51, 85, 187]];
  for (let i = 0; i < slots.length; i++) {
    const rgb = await pixel(buffer, Math.round(slots[i].x + slots[i].w / 2), Math.round(slots[i].y + slots[i].h / 2));
    rgb.forEach((v, channel) => assert.ok(Math.abs(v - expectedColours[i][channel]) < 8, `${i}: ${rgb}`));
  }
});

for (const filter of ['bw', 'warm', 'film']) {
  test(`${filter}: actual pixel recipe yields an alpha-preserving result`, async () => {
    const room = reviewFixture(); room.settings.filter = filter;
    const shots = [{ generation: room.session.generation, shotIndex: 0, buffer: await solid('#dd4422') }];
    const result = await composeReview({ room, shots });
    const slot = buildFrameGeometry('grid2x2').slots[0];
    const rgb = await pixel(result, slot.x + 100, slot.y + 100);
    if (filter === 'bw') assert.ok(Math.max(...rgb) - Math.min(...rgb) <= 2);
    assert.equal((await sharp(result).metadata()).hasAlpha, true);
  });
}

test('overlay is above photos; rotated stickers at frame edges are cropped and composited last', async () => {
  const room = reviewFixture();
  const layout = buildFrameGeometry('grid2x2');
  const overlay = await sharp({ create: { width: layout.width, height: layout.height,
    channels: 4, background: { r: 20, g: 180, b: 40, alpha: 1 } } }).png().toBuffer();
  const buffer = await composeReview({ room, shots: [], overlay,
    stickers: [{ x: 0, y: 0.5, scale: 0.12, rotation: 45, buffer: await solid('#ff0000', 100, 100) }] });
  const green = await pixel(buffer, 1000, 1000);
  assert.ok(green[1] > 170 && green[0] < 30);
  const red = await pixel(buffer, 1, Math.round(layout.height / 2));
  assert.ok(red[0] > 230 && red[1] < 20);
});

test('composer accepts buffers only and rejects stale generations, SVG, invalid stickers, duplicates, wrong state', async () => {
  const room = reviewFixture();
  const shot = { generation: room.session.generation, shotIndex: 0, buffer: await solid('#445566') };
  await assert.rejects(composeReview({ room, shots: [{ ...shot, buffer: '/synthetic/path.png' }] }), /INVALID_IMAGE_BUFFER/);
  await assert.rejects(composeReview({ room, shots: [{ ...shot, generation: -1 }] }), /STALE_SHOT/);
  await assert.rejects(composeReview({ room, shots: [shot, shot] }), /INVALID_SHOT_INDEX/);
  await assert.rejects(composeReview({ room, shots: [], overlay: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>') }), /UNSUPPORTED_IMAGE/);
  await assert.rejects(composeReview({ room, shots: [], stickers: [{ x: NaN }] }), /INVALID_STICKER/);
  await assert.rejects(composeReview({ room: { ...room, status: 'LOBBY' }, shots: [] }), /ROOM_NOT_IN_REVIEW/);
});

test('existing frontend and backend layout rules remain identical for every supported participant count', async () => {
  const frontend = await import('../frontend/src/pages/layouts.js');
  const backend = require('../backend/modules/frames/layouts.cjs');
  for (let count = 1; count <= 4; count++) {
    assert.deepEqual(frontend.layoutsForUserCount(count), backend.layoutsForUserCount(count));
    for (const template of backend.layoutsForUserCount(count)) {
      assert.deepEqual(frontend.buildFrameGeometry(template), backend.buildFrameGeometry(template));
      const ids = Array.from({ length: backend.getShotsForTemplate(template, count) }, (_, i) => `demo-${i % count}`);
      assert.deepEqual(frontend.slotOrder(template, ids), backend.slotOrder(template, ids));
    }
  }
});
