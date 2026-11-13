const LUMA = [
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722],
];

const SEPIA = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
];

const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function mix(matrix, amount) {
  return matrix.map((row, r) =>
    row.map((value, c) => IDENTITY[r][c] * (1 - amount) + value * amount)
  );
}

function saturate(s) {
  return [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
}

function multiply(a, b) {
  return a.map((row) =>
    row.map((_, c) => row[0] * b[0][c] + row[1] * b[1][c] + row[2] * b[2][c])
  );
}

const FILTERS = {
  none: { label: '원본', css: 'none', recipe: null },
  bw: {
    label: '흑백',
    css: 'grayscale(1)',
    recipe: { matrix: mix(LUMA, 1) },
  },
  warm: {
    label: '웜톤',
    css: 'sepia(0.25) saturate(1.4)',
    recipe: { matrix: multiply(saturate(1.4), mix(SEPIA, 0.25)) },
  },

  film: {
    label: '필름',
    css: 'none',
    recipe: {
      preBlur: 0.6,           
      linear: [1.06, -14],    
      matrix: saturate(0.78),
      aberration: 3,          
      glow: 0.3,              
      wash: 0.12,             
      scanline: 0.05,         
      grain: 0.3,            
      grainAmp: 70,          
    },

    fx: {
      preBlur: 1.2,           
      linear: [1.1, -28],     
      matrix: saturate(0.95),
      aberration: 7,
      glow: 0.3,
      wash: 0.12,
      scanline: 0.13,
      grain: 0.3,
      grainAmp: 70,
    },
  },
};

function filtersForClient() {
  return Object.entries(FILTERS).map(([id, filter]) => ({
    id,
    label: filter.label,
    css: filter.css,
    fx: filter.fx || null,
  }));
}

module.exports = { FILTERS, filtersForClient };
