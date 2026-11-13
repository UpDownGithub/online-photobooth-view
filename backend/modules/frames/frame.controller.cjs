// 실제 목록 컨트롤러를 발췌하고 공개 예시 모듈 경로로 변경했습니다.
const service = require('./frame.service.cjs');
exports.getFrames = (req, res) => {
  return res.json({ ok: true, frames: service.framesForClient() });
};
