import { encodeShotForUpload, retryShotUpload } from './shot-upload.js';

// SHOT_STARTED captures synchronously; SHOT_COMPLETED encodes that same canvas.
// Delivery is an injected callback: there is no HTTP client, URL or persistence.
export function createShotPipeline({ capture, deliver, isCurrent }) {
  const pending = new Map();
  const jobs = new Map();
  const keyFor = (generation, shotIndex) => `${generation}:${shotIndex}`;

  function onShotStarted({ generation, shotIndex, userId }) {
    if (!isCurrent(generation)) return false;
    const key = keyFor(generation, shotIndex);
    if (pending.has(key) || jobs.has(key)) return false;
    const canvas = capture({ userId, shotIndex });
    if (!canvas) throw new Error('CAPTURE_UNAVAILABLE');
    pending.set(key, canvas);
    return true;
  }
  function onShotCompleted({ generation, shotIndex, userId }) {
    const key = keyFor(generation, shotIndex);
    if (jobs.has(key)) return jobs.get(key);
    const canvas = pending.get(key);
    pending.delete(key);
    if (!isCurrent(generation)) return Promise.resolve(null);
    if (!canvas) return Promise.reject(new Error('CAPTURE_NOT_FOUND'));
    const job = (async () => {
      const blob = await encodeShotForUpload(canvas);
      if (!isCurrent(generation)) return null;
      return retryShotUpload(deliver, { generation, shotIndex, userId, blob }, {
        isCurrent: () => isCurrent(generation),
      });
    })();
    // Keep each result until reset so repeated completion events share one job.
    jobs.set(key, job);
    return job;
  }
  function reset() { pending.clear(); jobs.clear(); }
  return { onShotStarted, onShotCompleted, reset };
}
