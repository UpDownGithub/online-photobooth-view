// Keep the server's hard limit, but fit normal camera captures before sending bytes.
export const MAX_SHOT_BYTES = 5 * 1024 * 1024;
const JPEG_QUALITIES = [0.92, 0.86, 0.78, 0.68, 0.56, 0.44, 0.32, 0.2];

function encodeJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/jpeg') return reject(new Error('SHOT_ENCODING_FAILED'));
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

export async function encodeShotForUpload(canvas) {
  if (!canvas || !canvas.width || !canvas.height) throw new Error('SHOT_ENCODING_FAILED');
  // Always encode from the original captured pixels, never from a previous lossy JPEG.
  // No resize/crop: existing frame geometry and camera composition stay unchanged.
  for (const quality of JPEG_QUALITIES) {
    const blob = await encodeJpeg(canvas, quality);
    if (blob.size <= MAX_SHOT_BYTES) return blob;
  }
  // Bounded work for exceptional inputs; never send a known-oversized payload repeatedly.
  throw new Error('SHOT_COMPRESSION_LIMIT');
}

export async function retryShotUpload(upload, params, {
  attempts = 3,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  isCurrent = () => true,
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (!isCurrent()) return null;
    try { return await upload(params); }
    catch (err) {
      if (err.status === 413) throw Object.assign(new Error('SHOT_UPLOAD_TOO_LARGE'), { status: 413 });
      const permanent = err.status >= 400 && err.status < 500 && ![408, 429].includes(err.status);
      if (permanent || attempt === attempts) throw err;
      await wait(600 * attempt);
    }
  }
}
