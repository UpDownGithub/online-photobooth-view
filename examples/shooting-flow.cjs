const sharp = require('sharp');
const { createShootingSession } = require('../backend/modules/shooting/shooting-session.cjs');
const { composeReview } = require('../backend/modules/render/compose.cjs');

// Generated colour cards only. This example never opens a camera or loads files.
async function runExample() {
  const { createShotPipeline } = await import('../frontend/src/media/shot-pipeline.js');
  const { captureFrame } = await import('../frontend/src/media/capture-frame.js');
  const { rasterCanvas } = require('../tests/helpers.cjs');
  const { renderRoomLayout } = await import('../frontend/src/pages/room.view.js');
  let time = Date.UTC(2026, 0, 1);
  const userIds = ['demo-a', 'demo-b'];
  const session = createShootingSession({ userIds, now: () => time });
  const shots = [];
  const events = [];
  const colours = ['#cc4433', '#448855', '#3355bb', '#d0aa44'];
  const sources = await Promise.all(colours.map((colour) => sharp({
    create: { width: 640, height: 480, channels: 3, background: colour },
  }).png().toBuffer()));
  const pipeline = createShotPipeline({
    capture: ({ shotIndex }) => captureFrame({
      video: { videoWidth: 640, videoHeight: 480, pixels: sources[shotIndex] },
      size: 480, mirrored: true, createCanvas: rasterCanvas,
    }),
    isCurrent: (generation) => session.getState().session?.generation === generation,
    deliver: async ({ blob, ...metadata }) => {
      const shot = { ...metadata, buffer: Buffer.from(await blob.arrayBuffer()) };
      shots.push(shot);
      return { shotIndex: shot.shotIndex, bytes: shot.buffer.length };
    },
  });
  userIds.forEach((id) => session.setReady(id, true));
  session.start('demo-a');
  while (session.getState().status !== 'REVIEW') {
    time += 3000;
    const started = session.advance();
    if (started.type !== 'SHOT_STARTED') throw new Error('UNEXPECTED_EXAMPLE_STATE');
    const { generation, currentShotIndex: shotIndex, shotOrder } = started.room.session;
    pipeline.onShotStarted({ generation, shotIndex, userId: shotOrder[shotIndex] });
    events.push({ type: started.type, shotIndex, status: started.room.status });
    time += 1000;
    const completed = session.advance();
    const result = await pipeline.onShotCompleted({ generation, ...completed.shot });
    events.push({ type: completed.type, shotIndex, status: completed.room.status, bytes: result.bytes });
  }
  const room = session.getState();
  const buffer = await composeReview({ room, shots });
  const html = renderRoomLayout({ room, myUserId: userIds[0], shotOrder: room.session.shotOrder });
  pipeline.reset();
  return { room, shots, events, buffer, html };
}

if (require.main === module) {
  runExample().then(async ({ room, events, buffer }) => {
    const { width, height, format } = await sharp(buffer).metadata();
    console.log(JSON.stringify({ status: room.status, events,
      result: { width, height, format, bytes: buffer.length } }, null, 2));
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { runExample };
