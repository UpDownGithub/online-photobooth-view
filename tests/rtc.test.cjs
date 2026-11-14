const test = require('node:test');
const assert = require('node:assert/strict');
const { fakePeer } = require('./helpers.cjs');
const load = () => import('../frontend/src/rtc/peer-session.js');
const candidate = (id) => ({ candidate: `synthetic-candidate-${id}`, sdpMid: '0', sdpMLineIndex: 0 });

test('two peers: only designated side offers, reordered ICE is applied after SDP on both sides', async () => {
  const { createPeerSession } = await load();
  const a = fakePeer(); const b = fakePeer();
  const messages = [];
  const left = createPeerSession({ initiator: true, createPeer: () => a,
    sendSignal: (signal) => messages.push({ target: 'right', ...signal }) });
  const right = createPeerSession({ initiator: false, createPeer: () => b,
    sendSignal: (signal) => messages.push({ target: 'left', ...signal }) });
  assert.deepEqual(await Promise.all([left.connect(), right.connect(), left.connect()]), [true, false, false]);
  assert.equal(a.offerCount + b.offerCount, 1);
  // ICE beats the offer to the receiver, even before the receiver has a peer.
  await right.receive({ type: 'ice', candidate: candidate(1) });
  await right.receive({ type: 'ice', candidate: candidate(2) });
  assert.equal(b.candidates.length, 0);
  await right.receive(messages.shift());
  assert.deepEqual(b.candidates, [candidate(1), candidate(2)]);
  // ICE also beats the answer in the reverse direction.
  await left.receive({ type: 'ice', candidate: candidate(3) });
  assert.equal(a.candidates.length, 0);
  await left.receive(messages.shift());
  assert.deepEqual(a.candidates, [candidate(3)]);
  a.onicecandidate({ candidate: { toJSON: () => candidate(4) } });
  await right.receive(messages.shift());
  assert.deepEqual(b.candidates.at(-1), candidate(4));
  assert.equal(a.remoteDescription.type, 'answer');
  assert.equal(b.remoteDescription.type, 'offer');
  left.close(); right.close();
  assert.ok(a.closed && b.closed);
});

test('candidate rejection does not discard the remaining queue; errors never include raw SDP/ICE', async () => {
  const { createPeerSession } = await load();
  const pc = fakePeer(); const errors = [];
  const session = createPeerSession({ initiator: false, createPeer: () => pc,
    sendSignal: () => {}, onCandidateError: (error) => errors.push(error) });
  await session.receive({ type: 'ice', candidate: { ...candidate(1), fail: true } });
  await session.receive({ type: 'ice', candidate: candidate(2) });
  await session.receive({ type: 'offer', sdp: { type: 'offer', sdp: 'synthetic' } });
  assert.deepEqual(pc.candidates, [candidate(2)]);
  assert.deepEqual(errors, ['ICE_CANDIDATE_REJECTED']);
  session.close();
});

test('offer responsibility, SDP type, and candidate queue bounds are enforced', async () => {
  const { createPeerSession } = await load();
  const session = createPeerSession({ initiator: true, createPeer: fakePeer, sendSignal: () => {} });
  await assert.rejects(session.receive({ type: 'offer', sdp: { type: 'offer' } }), /UNEXPECTED_OFFER/);
  await assert.rejects(session.receive({ type: 'answer', sdp: { type: 'offer' } }), /INVALID_SDP/);
  await assert.rejects(session.receive({ type: 'answer', sdp: { type: 'answer' } }), /UNEXPECTED_ANSWER/);
  for (let i = 0; i < 128; i++) await session.receive({ type: 'ice', candidate: candidate(i) });
  await assert.rejects(session.receive({ type: 'ice', candidate: candidate(129) }), /ICE_QUEUE_FULL/);
  session.close();
  assert.equal(await session.receive({ type: 'ice', candidate: candidate(130) }), false);
});

test('closing while SDP creation is pending prevents stale outbound signals', async () => {
  const { createPeerSession } = await load();
  let finish;
  const pc = fakePeer(); const signals = [];
  pc.createOffer = () => new Promise((resolve) => { finish = resolve; });
  const session = createPeerSession({ initiator: true, createPeer: () => pc,
    sendSignal: (signal) => signals.push(signal) });
  const work = session.connect();
  await Promise.resolve();
  session.close();
  finish({ type: 'offer', sdp: 'synthetic' });
  assert.equal(await work, false);
  assert.deepEqual(signals, []);
  assert.ok(pc.closed);
});
