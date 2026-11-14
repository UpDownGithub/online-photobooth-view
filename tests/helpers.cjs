const sharp = require('sharp');

async function solid(colour, width = 640, height = 480) {
  return sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer();
}

// Test adapter, NOT a browser Canvas implementation. Sharp supplies synthetic
// pixels; draw calls are recorded so capture geometry can also be inspected.
function rasterCanvas() {
  let source;
  let crop;
  let mirrored = false;
  const calls = [];
  const qualities = [];
  const canvas = {
    width: 0, height: 0, calls, qualities,
    getContext: () => ({
      translate: (...args) => calls.push(['translate', ...args]),
      scale: (x, y) => { mirrored = x === -1; calls.push(['scale', x, y]); },
      drawImage: (video, sx, sy, w, h, ...target) => {
        source = video.pixels;
        crop = { left: Math.round(sx), top: Math.round(sy), width: Math.round(w), height: Math.round(h) };
        calls.push(['drawImage', sx, sy, w, h, ...target]);
      },
    }),
    toBlob(callback, type, quality) {
      qualities.push(quality);
      let image = sharp(source).extract(crop).resize(canvas.width, canvas.height);
      if (mirrored) image = image.flop();
      image.jpeg({ quality: Math.round(quality * 100) }).toBuffer().then(
        (buffer) => callback(new Blob([buffer], { type })),
        () => callback(null),
      );
    },
  };
  return canvas;
}

function fakePeer() {
  return {
    localDescription: null, remoteDescription: null, candidates: [], closed: false,
    offerCount: 0,
    async createOffer() { this.offerCount++; return { type: 'offer', sdp: 'synthetic-offer' }; },
    async createAnswer() {
      if (!this.remoteDescription) throw new Error('REMOTE_DESCRIPTION_REQUIRED');
      return { type: 'answer', sdp: 'synthetic-answer' };
    },
    async setLocalDescription(sdp) { this.localDescription = sdp; },
    async setRemoteDescription(sdp) { this.remoteDescription = sdp; },
    async addIceCandidate(candidate) {
      if (!this.remoteDescription) throw new Error('REMOTE_DESCRIPTION_REQUIRED');
      if (candidate.fail) throw new Error('SYNTHETIC_BAD_CANDIDATE');
      this.candidates.push(candidate);
    },
    close() { this.closed = true; },
  };
}
module.exports = { solid, rasterCanvas, fakePeer };
