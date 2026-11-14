// The caller selects its own video element. This helper never opens a camera.
// Adapted from camera.js: centre square crop, no upscaling, optional mirroring.
export function captureFrame({ video, size: requestedSize, mirrored = true,
  createCanvas = () => document.createElement('canvas') }) {
  const vw = video?.videoWidth;
  const vh = video?.videoHeight;
  if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw <= 0 || vh <= 0) return null;
  const minSide = Math.min(vw, vh);
  const requested = requestedSize ?? minSide;
  if (!Number.isFinite(requested) || requested <= 0) throw new Error('INVALID_CAPTURE_SIZE');
  const size = Math.max(1, Math.round(Math.min(requested, minSide, 4096)));
  const canvas = createCanvas();
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  if (mirrored) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (vw - minSide) / 2, (vh - minSide) / 2,
    minSide, minSide, 0, 0, size, size);
  return canvas;
}
