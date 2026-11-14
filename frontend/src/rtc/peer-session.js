// A single peer pair: the caller supplies a prepared RTCPeerConnection and a
// signal sink. No sockets, membership service, ICE servers, credentials or tracks
// are obtained here. Tests use fake peers and an in-memory signal queue.
export function createPeerSession({ initiator, createPeer, sendSignal,
  onCandidateError = () => {} }) {
  if (typeof initiator !== 'boolean' || typeof createPeer !== 'function'
    || typeof sendSignal !== 'function' || typeof onCandidateError !== 'function') {
    throw new Error('INVALID_PEER_OPTIONS');
  }
  let pc = null;
  let closed = false;
  let chain = Promise.resolve();
  const pendingCandidates = [];
  const MAX_PENDING_CANDIDATES = 128;

  // Serialize async SDP changes and candidate delivery for this peer pair.
  function enqueue(task) {
    const result = chain.then(() => closed ? false : task());
    chain = result.catch(() => {});
    return result;
  }
  function ensurePeer() {
    if (pc) return pc;
    const created = createPeer();
    pc = created;
    created.onicecandidate = ({ candidate }) => {
      if (!closed && pc === created && candidate) {
        sendSignal({ type: 'ice', candidate: candidate.toJSON?.() ?? candidate });
      }
    };
    return created;
  }
  function isActive(peer) { return !closed && pc === peer; }
  async function addCandidate(peer, candidate) {
    try { await peer.addIceCandidate(candidate); }
    catch { if (isActive(peer)) onCandidateError('ICE_CANDIDATE_REJECTED'); }
  }
  async function flushPendingCandidates(peer) {
    while (isActive(peer) && pendingCandidates.length) {
      await addCandidate(peer, pendingCandidates.shift());
    }
  }
  function connect() {
    return enqueue(async () => {
      // Original strategy: only one side starts offers. The sample makes this
      // responsibility an explicit input; it does not implement join signaling.
      if (!initiator) return false;
      const peer = ensurePeer();
      if (peer.localDescription) return false;
      const offer = await peer.createOffer();
      if (!isActive(peer)) return false;
      await peer.setLocalDescription(offer);
      if (!isActive(peer)) return false;
      sendSignal({ type: 'offer', sdp: peer.localDescription });
      return true;
    });
  }
  function receive(signal) {
    return enqueue(async () => {
      if (!signal || !['offer', 'answer', 'ice'].includes(signal.type)) {
        throw new Error('INVALID_SIGNAL');
      }
      if (signal.type === 'ice') {
        if (!signal.candidate || typeof signal.candidate !== 'object') {
          throw new Error('INVALID_CANDIDATE');
        }
        if (!pc?.remoteDescription) {
          if (pendingCandidates.length >= MAX_PENDING_CANDIDATES) {
            throw new Error('ICE_QUEUE_FULL');
          }
          pendingCandidates.push(signal.candidate);
        } else {
          await addCandidate(pc, signal.candidate);
        }
        return true;
      }
      if (!signal.sdp || signal.sdp.type !== signal.type) throw new Error('INVALID_SDP');
      if (signal.type === 'offer') {
        if (initiator) throw new Error('UNEXPECTED_OFFER');
        const peer = ensurePeer();
        if (peer.localDescription) throw new Error('ALREADY_NEGOTIATED');
        await peer.setRemoteDescription(signal.sdp);
        if (!isActive(peer)) return false;
        await flushPendingCandidates(peer);
        if (!isActive(peer)) return false;
        const answer = await peer.createAnswer();
        if (!isActive(peer)) return false;
        await peer.setLocalDescription(answer);
        if (!isActive(peer)) return false;
        sendSignal({ type: 'answer', sdp: peer.localDescription });
      } else {
        if (!initiator || !pc?.localDescription || pc.remoteDescription) {
          throw new Error('UNEXPECTED_ANSWER');
        }
        const peer = pc;
        await peer.setRemoteDescription(signal.sdp);
        if (!isActive(peer)) return false;
        await flushPendingCandidates(peer);
      }
      return true;
    });
  }
  function close() {
    closed = true;
    pendingCandidates.length = 0;
    if (pc) {
      pc.onicecandidate = null;
      pc.close();
      pc = null;
    }
  }
  return { connect, receive, close };
}
