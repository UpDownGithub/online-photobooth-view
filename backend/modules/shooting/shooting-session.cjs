const { getShotsForTemplate, resolveTemplate } = require('../frames/layouts.cjs');

// Adapted from rooms/service.js: a single in-memory session, with an injected clock.
// Participant IDs here are display inputs, not authentication or access control.
const COUNTDOWN_SECONDS = 3;
const SHOOTING_MS = 1000;
const copy = (value) => structuredClone(value);
function fail(code) { throw new Error(code); }

function createShootingSession({ userIds, template = 'grid2x2', now = Date.now }) {
  if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > 4
    || userIds.some((id) => typeof id !== 'string' || !id || id.length > 64)
    || new Set(userIds).size !== userIds.length) fail('INVALID_PARTICIPANTS');

  const participantIds = [...userIds];
  let sequence = 0;
  let room = {
    status: 'LOBBY',
    users: participantIds.map((userId) => ({ userId, isReady: false })),
    settings: { template: resolveTemplate(template, participantIds.length) },
    session: null,
  };

  function requireState(status) {
    if (room.status !== status) fail(`ROOM_NOT_IN_${status}`);
  }
  function getState() { return copy(room); }
  function setReady(userId, isReady) {
    requireState('LOBBY');
    const user = room.users.find((entry) => entry.userId === userId);
    if (!user) fail('UNKNOWN_PARTICIPANT');
    if (typeof isReady !== 'boolean') fail('INVALID_READY');
    user.isReady = isReady;
    return getState();
  }
  function start(userId) {
    requireState('LOBBY');
    if (!room.users.some((user) => user.userId === userId)) fail('UNKNOWN_PARTICIPANT');
    if (!room.users.every((user) => user.isReady)) fail('ALL_USERS_MUST_BE_READY');
    const totalShots = getShotsForTemplate(room.settings.template, room.users.length);
    const stamp = now();
    room = {
      ...room,
      status: 'COUNTDOWN',
      session: {
        // A local generation counter prevents late encoding results crossing a retake.
        // This is not an operating session token.
        generation: ++sequence,
        startedAt: stamp,
        shotOrder: Array.from({ length: totalShots }, (_, i) => participantIds[i % participantIds.length]),
        totalShots,
        currentShotIndex: 0,
        countdownSeconds: COUNTDOWN_SECONDS,
        countdownStartedAt: stamp,
        currentShotStartedAt: null,
        completedShots: [],
      },
    };
    return getState();
  }
  function tickCountdown() {
    requireState('COUNTDOWN');
    const elapsed = Math.floor(Math.max(0, now() - room.session.countdownStartedAt) / 1000);
    room.session.countdownSeconds = Math.max(COUNTDOWN_SECONDS - elapsed, 0);
    return { room: getState(), done: room.session.countdownSeconds === 0 };
  }
  function beginCurrentShot() {
    requireState('COUNTDOWN');
    if (!tickCountdown().done) fail('COUNTDOWN_NOT_FINISHED');
    room.status = 'SHOOTING';
    room.session.currentShotStartedAt = now();
    return getState();
  }
  function completeCurrentShot() {
    requireState('SHOOTING');
    const session = room.session;
    if (now() - session.currentShotStartedAt < SHOOTING_MS) fail('SHOT_NOT_FINISHED');
    if (session.completedShots.some((shot) => shot.shotIndex === session.currentShotIndex)) {
      fail('SHOT_ALREADY_COMPLETED');
    }
    session.completedShots.push({
      shotIndex: session.currentShotIndex,
      userId: session.shotOrder[session.currentShotIndex],
      capturedAt: now(),
    });
    return getState();
  }
  function moveToNextShotOrReview() {
    requireState('SHOOTING');
    const session = room.session;
    if (!session.completedShots.some((shot) => shot.shotIndex === session.currentShotIndex)) {
      fail('SHOT_NOT_COMPLETED');
    }
    const finished = session.currentShotIndex + 1 >= session.totalShots;
    session.currentShotStartedAt = null;
    if (finished) {
      room.status = 'REVIEW';
    } else {
      room.status = 'COUNTDOWN';
      session.currentShotIndex += 1;
      session.countdownStartedAt = now();
      session.countdownSeconds = COUNTDOWN_SECONDS;
    }
    return { room: getState(), finished };
  }
  function retake() {
    requireState('REVIEW');
    return reset();
  }
  function reset() {
    room.status = 'LOBBY';
    room.session = null;
    room.users.forEach((user) => { user.isReady = false; });
    return getState();
  }
  // Explicit ticks replace the original interval/timeout + socket runtime.
  // At most one transition per tick: delayed tabs cannot skip uncaptured shots.
  function advance() {
    if (room.status === 'COUNTDOWN') {
      if (tickCountdown().done) return { type: 'SHOT_STARTED', room: beginCurrentShot() };
      return { type: 'COUNTDOWN_TICK', room: getState() };
    }
    if (room.status === 'SHOOTING' && now() - room.session.currentShotStartedAt >= SHOOTING_MS) {
      const captured = completeCurrentShot();
      const { room: next, finished } = moveToNextShotOrReview();
      return {
        type: 'SHOT_COMPLETED', room: next, finished,
        generation: captured.session.generation,
        shot: captured.session.completedShots.at(-1),
      };
    }
    return { type: 'IDLE', room: getState() };
  }
  return { getState, setReady, start, tickCountdown, beginCurrentShot,
    completeCurrentShot, moveToNextShotOrReview, advance, retake, cancel: reset };
}

module.exports = { createShootingSession, COUNTDOWN_SECONDS, SHOOTING_MS };
