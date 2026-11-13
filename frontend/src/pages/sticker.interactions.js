import { getRoomState } from '../store/room.store.js';
import { stickerStyle } from './room.helpers.js';
import { resolveTemplate, buildFrameGeometry } from './layouts.js';
let selectedId = null;
let draggingId = null;
export function getDraggingStickerId() {
  return draggingId;
}
export function getSelectedStickerId() {
  return selectedId;
}
export function clearStickerSelection() {
  selectedId = null;
  document.querySelectorAll('.sticker.is-selected').forEach((el) => el.classList.remove('is-selected'));
}
function currentGeometry(room) {
  const template = resolveTemplate(room.settings?.template, (room.users || []).length);
  return buildFrameGeometry(template, room.settings?.design);
}
function stickerById(id) {
  return (getRoomState().room?.stickers || []).find((sticker) => sticker.id === id) || null;
}
export function bindStickerInteractions({ onChange = () => {}, onRemove = () => {} } = {}) {
  const card = document.querySelector('.frame-card');
  if (!card) return;

  card.addEventListener('pointerdown', (event) => {
    const stickerEl = event.target.closest('.sticker.is-mine');

    if (!stickerEl) {
      clearStickerSelection();
      return;
    }

    if (event.target.closest('[data-sticker-remove]')) return;  

    const id = stickerEl.dataset.sticker;
    const sticker = stickerById(id);
    const { room } = getRoomState();
    if (!sticker || !room) return;

    clearStickerSelection();
    selectedId = id;
    stickerEl.classList.add('is-selected');

    const geometry = currentGeometry(room);
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const onHandle = Boolean(event.target.closest('[data-sticker-handle]'));

    const centerX = rect.left + sticker.x * rect.width;
    const centerY = rect.top + sticker.y * rect.height;

    const start = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: sticker.x,
      y: sticker.y,
      scale: sticker.scale,
      rotation: sticker.rotation,

      distance: Math.hypot(event.clientX - centerX, event.clientY - centerY),
      angle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    };

    if (onHandle && start.distance < 1) return;

    let next = { ...sticker };
    draggingId = id;
    stickerEl.setPointerCapture?.(event.pointerId);
     
    event.preventDefault();

    const onMove = (moveEvent) => {
      if (onHandle) {
        const distance = Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY);
        const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
         
        const scale = Math.min(0.5, Math.max(0.05, start.scale * (distance / start.distance)));
        const rotation = Math.round((start.rotation + (angle - start.angle) * (180 / Math.PI)) * 10) / 10;
        next = { ...next, scale, rotation };
      } else {

        const dx = (moveEvent.clientX - start.pointerX) / rect.width;
        const dy = (moveEvent.clientY - start.pointerY) / rect.height;
        next = {
          ...next,
          x: Math.min(1, Math.max(0, start.x + dx)),
          y: Math.min(1, Math.max(0, start.y + dy)),
        };
      }

      stickerEl.setAttribute('style', stickerStyle(next, geometry));
    };

    const onUp = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      draggingId = null;

      const moved = next.x !== sticker.x || next.y !== sticker.y
        || next.scale !== sticker.scale || next.rotation !== sticker.rotation;
      if (!moved) return;

      await onChange({ id, x: next.x, y: next.y, scale: next.scale, rotation: next.rotation });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  card.addEventListener('click', async (event) => {
    const removeButton = event.target.closest('[data-sticker-remove]');
    if (!removeButton) return;

    const stickerEl = removeButton.closest('.sticker');
    const id = stickerEl?.dataset.sticker;
    const { room } = getRoomState();
    if (!id || !room) return;

    if (selectedId === id) selectedId = null;

    await onRemove(id);
  });
}
