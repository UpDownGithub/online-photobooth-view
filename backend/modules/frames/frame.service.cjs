// 실제 응답 변환 흐름을 공개 샘플로 단순화했습니다.
// 메모리의 예시 레지스트리만 사용하며 디자인은 표시용 필드만 선택합니다.
const layouts = require('./layouts.cjs');

function framesForClient() {
  const out = {};
  for (const [id, spec] of Object.entries(layouts.getLayouts())) {
    if (spec.enabled === false) continue;
    const designs = {};
    for (const [designId, design] of Object.entries(spec.designs || {})) {
      if (design.enabled === false) continue;
      const { label, style, overlay, isDefault, sortOrder, enabled } = design;
      designs[designId] = { label, style, overlay, isDefault, sortOrder, enabled };
    }
    const { shots, rows, cols, canvas, header, label, format, userCounts, isDefault, sortOrder } = spec;
    out[id] = { shots, rows, cols, canvas, header, label, format, userCounts, isDefault, sortOrder, designs };
  }
  return out;
}
module.exports = { framesForClient };
