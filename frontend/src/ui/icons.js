const SVG_OPEN = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
  + ' stroke-linecap="round" stroke-linejoin="round"';

const svg = (size, body) => `<svg width="${size}" height="${size}" ${SVG_OPEN}>${body}</svg>`;

export const ICON_BACK = svg(17, '<path d="m15 18-6-6 6-6"/>');

export const ICON_FLIP = svg(
  20,
  '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'
    + '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
);

export const ICON_GRID = svg(
  15,
  '<path d="M12 3v18"/><path d="M3 12h18"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
);

export const ICON_FILTER = svg(
  15,
  '<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
);

export const ICON_STICKER = svg(
  15,
  '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l7-7V5a2 2 0 0 0-2-2Z"/>'
    + '<path d="M14 21v-5a2 2 0 0 1 2-2h5"/>',
);

export const ICON_USERS = svg(
  15,
  '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/>'
    + '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
);

export const ICON_PLUS = svg(15, '<path d="M5 12h14"/><path d="M12 5v14"/>');

export const ICON_DOWNLOAD = svg(
  17,
  '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
);
