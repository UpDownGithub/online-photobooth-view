import { getShotsForTemplate, slotOrder, resolveTemplate, buildFrameGeometry } from './layouts.js';

export function captureSizeFor(storedTemplate, design, userCount) {
  const template = resolveTemplate(storedTemplate, userCount);  
  const cell = buildFrameGeometry(template, design).slots[0];
  return Math.max(cell.w, cell.h);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getStatusLabel(status) {
  switch (status) {
    case 'LOBBY':
      return '준비 중';
    case 'COUNTDOWN':
      return '카운트다운';
    case 'SHOOTING':
      return '촬영 중';
    case 'REVIEW':
      return '결과 확인';
    default:
      return status;
  }
}

export function getBoothStatusText(room, myUserId) {
  if (room.status !== 'LOBBY') return getStatusLabel(room.status);

  const users = room.users || [];
  const me = users.find((user) => user.userId === myUserId);

  if (users.every((user) => user.isReady === true)) return '준비 완료! 셔터를 누르세요';
  if (me?.isReady === true) return '다른 참가자를 기다리는 중';
  return '프레임을 골라 시작해보세요';
}

export function getShutterHintText() {
  return '모두 준비되면 시작할 수 있어요';
}

export function getPreviewShotOrder(room) {
  const users = room.users || [];
  const n = users.length;
  const shots = getShotsForTemplate(room.settings?.template, n);

  if (n === 0) {
    return Array.from({ length: shots }, () => null);
  }

  const ids = users.map((u) => u.userId);
  return Array.from({ length: shots }, (_, i) => ids[i % ids.length]);
}

export function getEffectiveShotOrder(room) {
  const actual = room.session?.shotOrder;

  if (Array.isArray(actual) && actual.length > 0) {
    return actual;
  }

  return getPreviewShotOrder(room);
}

export function getSlotVisualOrder(template, shotOrder) {
  return slotOrder(template, shotOrder);
}

const FRAME_ZOOM_FILL = 0.92;

export function getFrameZoom(room, geometry, template, shotOrder) {
  const shooting = room.status === 'COUNTDOWN' || room.status === 'SHOOTING';
  if (!shooting) return null;

  const shotIndex = Number(room.session?.currentShotIndex ?? -1);
  if (shotIndex < 0) return null;

  const slot = geometry.slots[getSlotVisualOrder(template, shotOrder)[shotIndex] ?? shotIndex];
  if (!slot) return null;

  const ar = geometry.width / geometry.height;

  return {
    cw: (geometry.width / slot.w) * FRAME_ZOOM_FILL,
    ch: ar * (geometry.height / slot.h) * FRAME_ZOOM_FILL,
    x: (0.5 - (slot.x + slot.w / 2) / geometry.width) * 100,
    y: (0.5 - (slot.y + slot.h / 2) / geometry.height) * 100,
  };
}

export function isMyShotSlot(shotOrder, shotIndex, myUserId) {
  const targetUserId = shotOrder[shotIndex];
  return Boolean(targetUserId && myUserId && targetUserId === myUserId);
}

export function isSlotMirrored(room, targetUserId, myUserId, myMirrored) {
  if (targetUserId === myUserId) return myMirrored;

  const user = (room.users || []).find((u) => u.userId === targetUserId);
  return user?.facingMode !== 'environment';
}

export function stickerWidthPercent(scale, geometry) {
  const shortSide = Math.min(geometry.width, geometry.height);
  return (scale * shortSide) / geometry.width * 100;
}

export function stickerStyle(sticker, geometry) {
  return `left:${(sticker.x * 100).toFixed(3)}%;`
    + `top:${(sticker.y * 100).toFixed(3)}%;`
    + `width:${stickerWidthPercent(sticker.scale, geometry).toFixed(3)}%;`
    + `transform:translate(-50%,-50%) rotate(${sticker.rotation}deg)`;
}

const GOLDEN_ANGLE = 2.399963;  
export function nextStickerSpot(count) {
  const radius = 0.13 * Math.sqrt(count);
  const angle = count * GOLDEN_ANGLE;
  return {
    x: Math.min(0.9, Math.max(0.1, 0.5 + radius * Math.cos(angle))),
    y: Math.min(0.9, Math.max(0.1, 0.5 + radius * Math.sin(angle))),
  };
}

export function allShotsUploaded(room) {
  const fallback = room?.session?.shotOrder?.length || 4;
  const totalShots = Number(room?.session?.totalShots ?? fallback);
  const completedShots = room?.session?.completedShots || [];
  const uploaded = completedShots.filter((s) => s && s.imageUrl).length;
  return uploaded >= totalShots;
}
