import {
  escapeHtml,
  getBoothStatusText,
  getShutterHintText,
  getSlotVisualOrder,
  isSlotMirrored,
  stickerStyle,
} from './room.helpers.js';
import {
  layoutsForUserCount,
  resolveTemplate,
  getLayout,
  designsForTemplate,
  resolveDesign,
  getDesign,
  buildFrameGeometry,
} from './layouts.js';
import { getLocalStreamError, isMirrored } from '../ui/media-state.js';

import {
  ICON_BACK,
  ICON_FLIP,
  ICON_GRID,
  ICON_STICKER,
  ICON_USERS,
  ICON_PLUS,
} from '../ui/icons.js';

function pct(n, d) {
  return `${((n / d) * 100).toFixed(4)}%`;
}

function frameStyleVars(style) {
  return `--frame-card-radius:${(style.cardRadius * 100).toFixed(2)}cqmin;`
    + `--frame-title-color:${style.titleColor};`
    + `--frame-date-color:${style.dateColor};`
    + `--frame-font:${style.fontFamily}`;
}

function frameDateLabel(room) {
  const d = new Date(room.session?.startedAt || Date.now());
  const two = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())}`;
}

function renderCameraErrorUI() {
  return `
    <div class="camera-error">
      <div class="camera-error-box">
        <div class="camera-error-title">카메라를 열 수 없어요</div>
        <div class="camera-error-desc">
          브라우저 설정에서 카메라 권한을 허용한 뒤<br />
          다시 시도해 주세요.
        </div>
        <button class="btn btn--primary btn--sm" type="button" data-camera-retry>다시 시도</button>
      </div>
    </div>
  `;
}

function renderShotBadge(room, shotIndex, shotOrder) {
  const user = (room.users || []).find((u) => u.userId === shotOrder[shotIndex]);

  if (!user) {
    return `<div class="shot-slot-badge"><span class="latin">SHOT ${shotIndex + 1}</span></div>`;
  }

  return `<div class="shot-slot-badge">`
    + `<span class="latin">${shotIndex + 1}</span> · ${escapeHtml(user.nickname)}</div>`;
}

export function renderShotOverlay(room, shotIndex, shotOrder) {
  const status = room.status;
  const currentShotIndex = Number(room.session?.currentShotIndex ?? -1);
  const isCurrent = currentShotIndex === shotIndex;

  if (status === 'REVIEW') return '';

  if (status === 'COUNTDOWN' && isCurrent) {
    const seconds = Number(room.session?.countdownSeconds ?? 3);
    return `
      <div class="shot-slot-overlay countdown">
        <div class="shot-slot-number latin">${seconds}</div>
        <div class="shot-slot-text">곧 촬영</div>
      </div>
    `;
  }

  if (status === 'SHOOTING' && isCurrent) {
    return `
      <div class="shot-slot-overlay shooting">
        <div class="shot-slot-text strong">● 촬영 중</div>
      </div>
    `;
  }

  if (status === 'COUNTDOWN' || status === 'SHOOTING') {
    return '<div class="shot-slot-overlay"></div>';
  }

  return `
    <div class="shot-slot-overlay">
      ${renderShotBadge(room, shotIndex, shotOrder)}
    </div>
  `;
}

export function renderShotImageTag(imageUrl, shotIndex) {
  return `<img src="${escapeHtml(imageUrl)}" class="shot-slot-image" alt="shot ${shotIndex + 1}" />`;
}

export function createShotImageElement(imageUrl, shotIndex) {
  const img = new Image();
  img.className = 'shot-slot-image';
  img.alt = `shot ${shotIndex + 1}`;
  img.src = imageUrl;
  return img;
}

export function renderShotSlot(room, shotIndex, myUserId, shotOrder, posStyle = '', fxActive = false) {
  const status = room.status;
  const currentShotIndex = Number(room.session?.currentShotIndex ?? -1);
  const isCurrent = currentShotIndex === shotIndex;
  const targetUserId = shotOrder[shotIndex] || null;

  let slotClass = 'shot-slot';
  if (isCurrent) slotClass += ' current';

  const overlay = renderShotOverlay(room, shotIndex, shotOrder);

  const completedShot = (room.session?.completedShots || [])
    .find((s) => s.shotIndex === shotIndex);
  const imageUrl = completedShot?.imageUrl || null;

  let mediaHtml = '';

  if (imageUrl) {
     
    mediaHtml = renderShotImageTag(imageUrl, shotIndex)
      + (fxActive ? '<canvas class="shot-slot-canvas" data-fx></canvas>' : '');
  } else if (targetUserId) {

    const cameraFailed = targetUserId === myUserId && getLocalStreamError();

    if (cameraFailed) {
      mediaHtml = '<div class="shot-slot-placeholder"></div>';
    } else {
       
      const mirrored = isSlotMirrored(room, targetUserId, myUserId, isMirrored());

      mediaHtml = `
        <div class="shot-slot-placeholder">
          <div class="shot-slot-placeholder-text">카메라 연결 중</div>
        </div>
        <video
          class="shot-slot-video${mirrored ? ' mirror' : ''}"
          data-user-id="${targetUserId}"
          ${targetUserId === myUserId ? 'muted' : ''}
          autoplay
          playsinline
        ></video>
        ${fxActive ? '<canvas class="shot-slot-canvas" data-fx></canvas>' : ''}
      `;
    }
  }

  const flashHtml = status === 'SHOOTING' && isCurrent
    ? '<div class="shot-slot-flash"></div>'
    : '';

  return `
    <div class="${slotClass}" style="${posStyle}">
      <div class="shot-slot-surface">
        ${mediaHtml}
        ${overlay}
        ${flashHtml}
      </div>
    </div>
  `;
}

export function renderUsers(room, myUserId) {
  return (room.users || [])
    .map((user) => {
      const isMe = user.userId === myUserId;
      const isHost = user.userId === room.hostUserId;
      const ready = user.isReady === true;

      const tags = [isHost ? 'host' : null, isMe ? '나' : null]
        .filter(Boolean)
        .join(' · ');

      return `
        <div class="panel-user-row">
          <span class="panel-user-name">
            ${escapeHtml(user.nickname)}${tags ? ` <span class="meta-tag">${tags}</span>` : ''}
          </span>
          <span class="panel-user-status ${ready ? 'ready' : ''}">
            ${ready ? '준비 완료' : '대기 중'}
          </span>
        </div>
      `;
    })
    .join('');
}

export function renderMissingRoomLayout() {
  return `
    <div class="page">
      <div class="notice">
        <div class="eyebrow">online photobooth</div>
        <h2 class="display">방을 찾을 수 없어요</h2>
        <p class="lede">세션이 만료되었거나 방이 존재하지 않을 수 있습니다.</p>
        <button id="go-landing-button" class="btn btn--primary" type="button">처음으로</button>
      </div>
    </div>
  `;
}

export function renderSticker(sticker, geometry, { draggable }) {
  const src = sticker.src || '';
  return `
    <div class="sticker${draggable ? ' is-mine' : ''}"
         data-sticker="${sticker.id}"
         style="${stickerStyle(sticker, geometry)}">
      <img src="${escapeHtml(src)}" alt="" draggable="false">
      ${draggable ? `
      <button class="sticker-handle" type="button" data-sticker-handle aria-label="크기·각도"></button>
      <button class="sticker-remove" type="button" data-sticker-remove aria-label="스티커 떼기">×</button>` : ''}
    </div>
  `;
}

export function renderStickerLayer(room, geometry, registry, myUserId, { editable }) {
  const stickers = room.stickers || [];
  if (!stickers.length) return '';

  const srcById = new Map(registry.map((item) => [item.id, item.src]));

  const html = stickers
    .map((sticker) => renderSticker(
      { ...sticker, src: srcById.get(sticker.stickerId) },
      geometry,
      { draggable: editable && sticker.userId === myUserId },
    ))
    .join('');

  return `<div class="sticker-layer">${html}</div>`;
}

export function renderFrameCard({
  room, myUserId, shotOrder, geometry, template, filterCss, fxActive, stickerRegistry = [],
}) {
   
  const visualOrder = getSlotVisualOrder(template, shotOrder);
  const slotsHtml = shotOrder
    .map((_, index) => {
      const g = geometry.slots[visualOrder[index]];
      const posStyle = `left:${pct(g.x, geometry.width)};top:${pct(g.y, geometry.height)};`
        + `width:${pct(g.w, geometry.width)};height:${pct(g.h, geometry.height)}`;
      return renderShotSlot(room, index, myUserId, shotOrder, posStyle, fxActive);
    })
    .join('');

  const styleVars = `--shot-filter:${filterCss};${frameStyleVars(geometry.style)}`;

  return `
    <div class="frame-card${geometry.overlay ? ' has-overlay' : ''}" style="${styleVars}">
      ${geometry.header > 0 && !geometry.overlay ? `
      <div class="frame-header" style="height:${pct(geometry.header, geometry.height)}">
        <div class="frame-title">${escapeHtml(geometry.style.title)}</div>
        <div class="frame-date">${frameDateLabel(room)}</div>
      </div>` : ''}
      ${slotsHtml}
      ${geometry.overlay ? `<img class="frame-overlay" src="${escapeHtml(geometry.overlay)}" alt="" aria-hidden="true">` : ''}
      ${renderStickerLayer(room, geometry, stickerRegistry, myUserId, { editable: room.status === 'LOBBY' })}
    </div>
  `;
}

function renderFrameMock(template) {
  const geometry = buildFrameGeometry(template);
  const ar = geometry.width / geometry.height;

  const cells = geometry.slots
    .map((slot) => `<span style="left:${pct(slot.x, geometry.width)};top:${pct(slot.y, geometry.height)};`
      + `width:${pct(slot.w, geometry.width)};height:${pct(slot.h, geometry.height)}"></span>`)
    .join('');

  return `<span class="frame-mock" style="--mock-ar:${ar.toFixed(3)}">${cells}</span>`;
}

function renderDesignThumb(template, designId) {
  const geometry = buildFrameGeometry(template, designId);
  const ar = geometry.width / geometry.height;

  return `
    <span class="design-thumb" style="--mock-ar:${ar.toFixed(3)};background:${geometry.style.frameColor}">
      ${geometry.overlay ? `<img src="${escapeHtml(geometry.overlay)}" alt="" aria-hidden="true" data-hide-on-error>` : ''}
    </span>
  `;
}

function inviteButton(className) {
  return `
    <button class="btn btn--ghost btn--sm invite-button ${className}" type="button" data-invite>
      ${ICON_PLUS}초대하기
    </button>
  `;
}

function renderStickerSection(registry, mine, limits) {
  if (!registry.length) return '';

  const full = mine >= (limits?.maxPerUser ?? Infinity);

  return `
    <div class="panel-divider"></div>

    <div class="panel-section" id="panel-sticker">
      <div class="section-title">스티커</div>
      <div class="sticker-picker">
        ${registry
          .map((sticker) => `
        <button class="sticker-pick" type="button" data-sticker-add="${sticker.id}"
                title="${escapeHtml(sticker.label)}" ${full ? 'disabled' : ''}>
          <img src="${escapeHtml(sticker.src)}" alt="${escapeHtml(sticker.label)}">
        </button>`)
          .join('')}
      </div>
      <div class="sticker-status">
        <span class="panel-mini-note" data-sticker-count>
          ${full ? '더 붙일 수 없어요' : `내가 붙인 것 ${mine}개`}
        </span>
        <button class="btn btn--quiet btn--sm" type="button" data-sticker-clear ${mine ? '' : 'hidden'}>
          전부 떼기
        </button>
      </div>
    </div>
  `;
}

function renderPanelBody({ room, myUserId, template, design, userCount, stickers, stickerLimits }) {
  const isLobby = room.status === 'LOBBY';
  const designIds = designsForTemplate(template);

  const layoutSection = isLobby ? `
    <div class="panel-divider"></div>

    <div class="panel-section" id="panel-frame">
      <div class="section-title">레이아웃</div>
      <div class="layout-toggle">
        ${layoutsForUserCount(userCount)
          .map((id) => `
        <button class="layout-toggle-button layout-option ${id === template ? 'active' : ''}" data-template="${id}" type="button">
          <span class="mock-slot">${renderFrameMock(id)}</span>
          <span>${escapeHtml(getLayout(id).label)}</span>
        </button>`)
          .join('')}
      </div>
      ${designIds.length > 1 ? `
      <div class="panel-subsection">
        <div class="panel-mini-label">디자인</div>
        <div class="layout-toggle">
          ${designIds
            .map((id) => `
          <button class="layout-toggle-button layout-option ${id === design ? 'active' : ''}" data-design="${id}" type="button">
            <span class="mock-slot">${renderDesignThumb(template, id)}</span>
            <span>${escapeHtml(getDesign(template, id).label)}</span>
          </button>`)
            .join('')}
        </div>
      </div>` : ''}
    </div>
  ` : '';

  const myStickerCount = (room.stickers || []).filter((s) => s.userId === myUserId).length;
  const stickerSection = isLobby ? renderStickerSection(stickers, myStickerCount, stickerLimits) : '';

  return `
    ${isLobby ? inviteButton('booth-panel-invite') : ''}

    <div class="panel-section" id="panel-users">
      <div class="section-title">참가자</div>
      <div class="panel-users">
        ${renderUsers(room, myUserId)}
      </div>
    </div>
    ${layoutSection}
    ${stickerSection}
  `;
}

function renderConsoleBody({ myReady, canStart, chipsHtml = '' }) {
  return `
    ${chipsHtml}

    <div class="dock-row" data-ready="${String(myReady)}">
      <div class="dock-cell">
        <button class="icon-btn" type="button" title="카메라 전환" data-flip hidden>
          ${ICON_FLIP}
        </button>
      </div>

      <div class="dock-shutter">
        <button class="shutter-pill latin" type="button" data-ready-toggle>Ready</button>
        <button class="shutter" type="button" data-start
                title="${canStart ? '촬영 시작' : '다른 참가자를 기다리는 중'}"
                ${canStart ? '' : 'disabled'}>
          <span class="shutter-core"></span>
        </button>
      </div>

      <div class="dock-cell">
        <button class="btn btn--ghost btn--sm" type="button" data-ready-cancel
                ${myReady ? '' : 'hidden'}>Ready 해제</button>
      </div>
    </div>

    <div class="dock-hint" data-shutter-hint ${myReady ? 'hidden' : ''}>
      ${escapeHtml(getShutterHintText())}
    </div>
  `;
}

export function renderRoomLayout({ room, myUserId, shotOrder, stickers = [], stickerLimits = null }) {
  const users = room.users || [];
  const me = users.find((user) => user.userId === myUserId);
  const myReady = me?.isReady === true;

  const userCount = users.length;
  const template = resolveTemplate(room.settings?.template, userCount);
   
  const design = resolveDesign(template, room.settings?.design);
   
  const geometry = buildFrameGeometry(template, design);

  const canStart = users.every((user) => user.isReady === true);
  const isLobby = room.status === 'LOBBY';

  const chipsHtml = `
    <div class="booth-controls" ${myReady ? 'hidden' : ''}>
      <button class="btn btn--sm" type="button" data-panel="frame">
        ${ICON_GRID}${escapeHtml(getLayout(template).label)}
      </button>
      ${stickers.length ? `
      <button class="btn btn--sm" type="button" data-panel="sticker">
        ${ICON_STICKER}스티커
      </button>` : ''}
      <button class="btn btn--sm" type="button" data-panel="users">
        ${ICON_USERS}${userCount}명
      </button>
    </div>
  `;

  const cameraFailed = Boolean(getLocalStreamError());

  return `
    <div class="page booth-page${cameraFailed ? ' has-camera-error' : ''}"
         style="--frame-color:${geometry.style.frameColor}">
      <div class="booth-layout">
        <section class="booth-stage">
          <div class="booth-topbar">
            ${isLobby ? `
            <button id="leave-room-button" class="icon-btn icon-btn--sm" type="button" title="나가기">
              ${ICON_BACK}
            </button>` : ''}

            <div class="booth-titles">
              <div class="booth-status" data-status-text>${escapeHtml(getBoothStatusText(room, myUserId))}</div>
            </div>

            ${isLobby ? inviteButton('booth-topbar-invite') : ''}
          </div>

          <div class="booth-console booth-console--board">
            <div class="photo-board" style="--ar:${(geometry.width / geometry.height).toFixed(4)}">
              ${renderFrameCard({
                room, myUserId, shotOrder, geometry, template,
                filterCss: 'none', fxActive: false, stickerRegistry: stickers,
              })}
            </div>

            ${isLobby ? `
            <div class="console-divider"></div>
            ${renderConsoleBody({ myReady, canStart, chipsHtml })}` : ''}
          </div>
        </section>

        <aside class="booth-panel" id="side-panel" data-locked="${!isLobby}">
          <div class="booth-panel-body" id="side-panel-content">
            ${renderPanelBody({ room, myUserId, template, design, userCount, stickers, stickerLimits })}
          </div>
        </aside>

        ${isLobby ? `
        <div class="booth-console booth-console--panel">
          ${renderConsoleBody({ myReady, canStart })}
        </div>` : ''}
      </div>

      <div class="booth-scrim" hidden></div>
      ${cameraFailed ? renderCameraErrorUI() : ''}
    </div>
  `;
}
