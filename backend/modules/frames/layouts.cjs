const DEFAULT_STYLE = Object.freeze({
  frameColor: '#FDFDFB',  
  cornerRadius: 0.045,    
  cardRadius: 0.03,       

  title: 'photobooth',    
  titleColor: '#2f2e29',  
  dateColor: '#86826f',   
  fontFamily: "'Newsreader', Georgia, 'Times New Roman', serif",
});

const basicDesign = (id) => ({
  [`${id}_basic`]: { label: '기본', overlay: `/frames/${id}.png`, style: DEFAULT_STYLE, isDefault: true, sortOrder: 10 },
});

const DEFAULT_LAYOUTS = Object.freeze({
  strip: { shots: 4, rows: 4, cols: 1, canvas: { w: 1200, h: 3324 }, header: 300, label: '스트립', format: 'strip', userCounts: [1, 2, 4], isDefault: false, sortOrder: 10, designs: basicDesign('strip') },
  grid2x2: { shots: 4, rows: 2, cols: 2, canvas: { w: 2188, h: 3108 }, header: 300, label: '2×2', format: 'grid2x2', userCounts: [1, 2, 4], isDefault: true, sortOrder: 20, designs: basicDesign('grid2x2') },
  trio_v: { shots: 3, rows: 3, cols: 1, canvas: { w: 1240, h: 3776 }, header: 300, label: '세로 3컷', format: 'strip', userCounts: [3], isDefault: true, sortOrder: 30, designs: basicDesign('trio_v') },
  trio_h: { shots: 3, rows: 1, cols: 3, canvas: { w: 3536, h: 1400 }, header: 220, label: '가로 3컷', format: 'grid2x2', userCounts: [3], isDefault: false, sortOrder: 40, designs: basicDesign('trio_h') },
  six: { shots: 6, rows: 3, cols: 2, canvas: { w: 2388, h: 3776 }, header: 300, label: '6컷', format: 'grid2x2', userCounts: [3], isDefault: false, sortOrder: 50, designs: basicDesign('six') },
});

let activeLayouts = DEFAULT_LAYOUTS;

function setLayouts(next) {
  if (!next || Object.keys(next).length === 0) return false;
  activeLayouts = Object.freeze(next);
  return true;
}

function getLayouts() {
  return activeLayouts;
}

function getLayout(id) {
  return activeLayouts[id];
}

function designsForTemplate(template) {
  const designs = activeLayouts[template]?.designs || {};
  return Object.entries(designs)
    .filter(([, design]) => design.enabled !== false)
    .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0))
    .map(([id]) => id);
}

function defaultDesign(template) {
  const candidates = designsForTemplate(template);
  const designs = activeLayouts[template]?.designs || {};
  return candidates.find((id) => designs[id].isDefault) || candidates[0] || null;
}

function resolveDesign(template, stored) {
  return designsForTemplate(template).includes(stored) ? stored : defaultDesign(template);
}

function getDesign(template, stored) {
  const id = resolveDesign(template, stored);
  return id ? activeLayouts[template]?.designs?.[id] : undefined;
}

const FRAME_MARGIN = 60;
const FRAME_GAP = 28;

function buildFrameGeometry(template, design) {
  const spec = activeLayouts[template];
  const { w: width, h: height } = spec.canvas;
  const header = spec.header || 0;
  const topInset = spec.header ?? FRAME_MARGIN;  

  const cellW = Math.floor((width - FRAME_MARGIN * 2 - FRAME_GAP * (spec.cols - 1)) / spec.cols);
  const cellH = Math.floor((height - topInset - FRAME_MARGIN - FRAME_GAP * (spec.rows - 1)) / spec.rows);

  const slots = [];
  for (let r = 0; r < spec.rows; r += 1) {
    for (let c = 0; c < spec.cols; c += 1) {
      slots.push({
        x: FRAME_MARGIN + c * (cellW + FRAME_GAP),
        y: topInset + r * (cellH + FRAME_GAP),
        w: cellW,
        h: cellH,
      });
    }
  }

  const designId = resolveDesign(template, design);
  const designSpec = designId ? spec.designs[designId] : null;

  const overlay = designSpec ? designSpec.overlay || `/frames/${designId}.png` : null;

  return {
    width,
    height,
    header,
    style: designSpec?.style || DEFAULT_STYLE,
    design: designId,
    overlay,
    slots,
  };
}

function slotOrder(template, shotOrder) {
  const userCount = new Set((shotOrder || []).filter(Boolean)).size;

  if (template === 'grid2x2' && userCount === 2) {
    return [0, 1, 3, 2];
  }

  return (shotOrder || []).map((_, i) => i);
}

function layoutsForUserCount(n) {
  return Object.entries(activeLayouts)
    .filter(([, spec]) => spec.enabled !== false && (spec.userCounts || []).includes(n))
    .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0))
    .map(([id]) => id);
}

function defaultTemplate(n) {
  const candidates = layoutsForUserCount(n);
  const preferred = candidates.find((id) => activeLayouts[id].isDefault);
  return preferred || candidates[0] || Object.keys(activeLayouts)[0];
}

function resolveTemplate(stored, n) {
  return layoutsForUserCount(n).includes(stored) ? stored : defaultTemplate(n);
}

function getShotsForTemplate(stored, n) {
  return activeLayouts[resolveTemplate(stored, n)].shots;
}

function getFormatForTemplate(stored, n) {
  return activeLayouts[resolveTemplate(stored, n)].format;
}

module.exports = {
  DEFAULT_STYLE,
  DEFAULT_LAYOUTS,
  setLayouts,
  getLayouts,
  getLayout,
  designsForTemplate,
  defaultDesign,
  resolveDesign,
  getDesign,
  layoutsForUserCount,
  defaultTemplate,
  resolveTemplate,
  getShotsForTemplate,
  getFormatForTemplate,
  buildFrameGeometry,
  slotOrder,
};
