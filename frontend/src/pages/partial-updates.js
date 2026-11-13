import { getRoomState } from '../store/room.store.js';
import { resolveTemplate, buildFrameGeometry } from './layouts.js';
import { getFrameZoom, getEffectiveShotOrder, getBoothStatusText } from './room.helpers.js';
import { renderUsers } from './room.view.js';
export function updateFrameZoom() {
  const { room } = getRoomState();
  const board = document.querySelector('.photo-board');
  if (!room || !board) return;

  const template = resolveTemplate(room.settings?.template, (room.users || []).length);
  const geometry = buildFrameGeometry(template, room.settings?.design);
  const zoom = getFrameZoom(room, geometry, template, getEffectiveShotOrder(room));

  board.classList.toggle('is-zoomed', Boolean(zoom));

  if (zoom) {
    board.style.setProperty('--zoom-cw', zoom.cw.toFixed(4));
    board.style.setProperty('--zoom-ch', zoom.ch.toFixed(4));
    board.style.setProperty('--focus-x', zoom.x.toFixed(3));
    board.style.setProperty('--focus-y', zoom.y.toFixed(3));
  } else {
    ['--zoom-cw', '--zoom-ch', '--focus-x', '--focus-y']
      .forEach((name) => board.style.removeProperty(name));
  }
}
export function enterFrameZoomNextFrame() {
  requestAnimationFrame(() => requestAnimationFrame(updateFrameZoom));
}
export function updateStatusText(room, myUserId) {
  const statusEl = document.querySelector('[data-status-text]');
  if (statusEl) {
    statusEl.textContent = getBoothStatusText(room, myUserId);
  }
}
export function updateReadyControls(myUserId) {
  const { room } = getRoomState();

  if (!room || room.status !== 'LOBBY') return;

  const users = room.users || [];

  const usersEl = document.querySelector('.panel-users');
  if (usersEl) {
    usersEl.innerHTML = renderUsers(room, myUserId);
  }

  const me = users.find((user) => user.userId === myUserId);
  const myReady = me?.isReady === true;

  document.querySelectorAll('.dock-row')
    .forEach((row) => row.setAttribute('data-ready', String(myReady)));
  document.querySelectorAll('[data-ready-cancel]').forEach((b) => { b.hidden = !myReady; });

  document.querySelectorAll('[data-shutter-hint]').forEach((el) => { el.hidden = myReady; });

  const controls = document.querySelector('.booth-controls');
  if (controls) controls.hidden = myReady;

  const canStart = users.every((user) => user.isReady === true);
  document.querySelectorAll('[data-start]').forEach((b) => {
    b.disabled = !canStart;
    b.title = canStart ? '촬영 시작' : '다른 참가자를 기다리는 중';
  });

  updateStatusText(room, myUserId);
}
