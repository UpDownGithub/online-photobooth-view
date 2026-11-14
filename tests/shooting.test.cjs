const test = require('node:test');
const assert = require('node:assert/strict');
const { createShootingSession } = require('../backend/modules/shooting/shooting-session.cjs');

function fixture(userIds = ['demo-a', 'demo-b'], template) {
  let time = 0;
  const session = createShootingSession({ userIds, template, now: () => time });
  return { session, jump: (ms) => { time += ms; }, ready: () => userIds.forEach((id) => session.setReady(id, true)) };
}

test('Ready gates: unknown participants, partial readiness, and non-boolean input', () => {
  const f = fixture();
  assert.throws(() => f.session.start('outsider'), /UNKNOWN_PARTICIPANT/);
  f.session.setReady('demo-a', true);
  assert.throws(() => f.session.start('demo-a'), /ALL_USERS_MUST_BE_READY/);
  assert.throws(() => f.session.setReady('outsider', true), /UNKNOWN_PARTICIPANT/);
  assert.throws(() => f.session.setReady('demo-b', 'yes'), /INVALID_READY/);
  f.ready();
  assert.equal(f.session.start('demo-b').status, 'COUNTDOWN');
  assert.throws(() => f.session.start('demo-a'), /ROOM_NOT_IN_LOBBY/);
});

for (const [count, template, expected] of [
  [1, 'grid2x2', [0, 0, 0, 0]], [2, 'grid2x2', [0, 1, 0, 1]],
  [3, 'trio_v', [0, 1, 2]], [3, 'six', [0, 1, 2, 0, 1, 2]],
  [4, 'strip', [0, 1, 2, 3]],
]) {
  test(`${count} participants / ${template}: complete countdown → shots → review → retake`, () => {
    const ids = Array.from({ length: count }, (_, i) => `demo-${i}`);
    const f = fixture(ids, template);
    f.ready();
    const initial = f.session.start(ids[0]);
    assert.deepEqual(initial.session.shotOrder, expected.map((i) => ids[i]));
    for (let i = 0; i < expected.length; i++) {
      f.jump(2999);
      assert.equal(f.session.advance().room.session.countdownSeconds, 1);
      assert.throws(() => f.session.beginCurrentShot(), /COUNTDOWN_NOT_FINISHED/);
      f.jump(1);
      assert.equal(f.session.advance().type, 'SHOT_STARTED');
      assert.throws(() => f.session.moveToNextShotOrReview(), /SHOT_NOT_COMPLETED/);
      f.jump(999);
      assert.equal(f.session.advance().type, 'IDLE');
      f.jump(1);
      const result = f.session.advance();
      assert.equal(result.type, 'SHOT_COMPLETED');
      assert.equal(result.shot.userId, ids[expected[i]]);
      assert.equal(result.shot.shotIndex, i);
      assert.equal(result.finished, i === expected.length - 1);
    }
    const review = f.session.getState();
    assert.equal(review.status, 'REVIEW');
    assert.equal(review.session.completedShots.length, expected.length);
    assert.equal(f.session.advance().type, 'IDLE');
    assert.throws(() => f.session.completeCurrentShot(), /ROOM_NOT_IN_SHOOTING/);
    f.session.retake();
    assert.equal(f.session.getState().session, null);
    assert.ok(f.session.getState().users.every((user) => !user.isReady));
    f.ready();
    assert.notEqual(f.session.start(ids[0]).session.generation, initial.session.generation);
  });
}

test('a delayed timer never skips several unrecorded shots; returned states are copies', () => {
  const f = fixture();
  f.ready();
  const state = f.session.start('demo-a');
  state.users.length = 0;
  state.session.shotOrder.length = 0;
  f.jump(60000);
  const started = f.session.advance();
  assert.equal(started.type, 'SHOT_STARTED');
  assert.equal(started.room.session.currentShotIndex, 0);
  assert.equal(started.room.users.length, 2);
  assert.equal(f.session.advance().type, 'IDLE');
  f.jump(1000);
  f.session.completeCurrentShot();
  assert.throws(() => f.session.completeCurrentShot(), /SHOT_ALREADY_COMPLETED/);
  assert.equal(f.session.moveToNextShotOrReview().room.session.currentShotIndex, 1);
  f.session.cancel();
  assert.equal(f.session.advance().type, 'IDLE');
});

test('empty, duplicate, excessive or invalid participant inputs are rejected', () => {
  for (const userIds of [[], ['a', 'a'], ['a', 'b', 'c', 'd', 'e'], [null]]) {
    assert.throws(() => createShootingSession({ userIds }), /INVALID_PARTICIPANTS/);
  }
});

test('mutating the caller participant array cannot change the accepted shooting order', () => {
  const ids = ['demo-a', 'demo-b'];
  const session = createShootingSession({ userIds: ids });
  ids.splice(0, ids.length, 'outsider');
  session.setReady('demo-a', true); session.setReady('demo-b', true);
  assert.deepEqual(session.start('demo-a').session.shotOrder, ['demo-a', 'demo-b', 'demo-a', 'demo-b']);
});
