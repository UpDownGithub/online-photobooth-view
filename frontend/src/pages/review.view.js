import { escapeHtml, allShotsUploaded, isSlotMirrored, getEffectiveShotOrder } from './room.helpers.js';
import { isMirrored } from '../ui/media-state.js';
import { resolveTemplate, resolveDesign, buildFrameGeometry, getLayout } from './layouts.js';
import { renderFrameCard } from './room.view.js';

import { ICON_BACK, ICON_DOWNLOAD, ICON_FILTER } from '../ui/icons.js';

function renderTopbar({ headline, subhead = '', showLeave }) {
  return `
    <div class="review-topbar">
      ${showLeave ? `
      <button id="review-leave-button" class="icon-btn icon-btn--sm" type="button" title="나가기">
        ${ICON_BACK}
      </button>` : ''}
      <div class="review-titles">
        <div class="review-headline">${escapeHtml(headline)}</div>
        ${subhead ? `<div class="review-subhead">${escapeHtml(subhead)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderCams(room, myUserId) {
  return (room.users || [])
    .map((user) => {
      const isMe = user.userId === myUserId;
      const mirrored = isSlotMirrored(room, user.userId, myUserId, isMirrored());
      return `
        <div class="review-cam" title="${escapeHtml(user.nickname)}">
          <div class="review-cam-fallback">${escapeHtml(user.nickname.slice(0, 1))}</div>
          <video
            class="review-cam-video ${mirrored ? 'mirror' : ''}"
            data-user-id="${user.userId}"
            ${isMe ? 'muted' : ''}
            autoplay
            playsinline
          ></video>
        </div>
      `;
    })
    .join('');
}

function renderMeta(room) {
  const users = room.users || [];
  const template = resolveTemplate(room.settings?.template, users.length);
  const d = new Date(room.session?.startedAt || Date.now());
  const two = (v) => String(v).padStart(2, '0');

  const rows = [
    ['레이아웃', getLayout(template)?.label || template],
    ['참가자', `${users.length}명`],
    ['촬영', `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())}`],
  ];

  return `
    <dl class="review-meta">
      ${rows
        .map(([key, value]) => `
      <div class="review-meta-row">
        <dt class="review-meta-key">${escapeHtml(key)}</dt>
        <dd class="review-meta-value" style="margin:0">${escapeHtml(String(value))}</dd>
      </div>`)
        .join('')}
    </dl>
  `;
}

function renderFilters(filters, activeFilter) {
  if (!filters.length) return '';

  const activeMeta = filters.find((filter) => filter.id === activeFilter);

  return `
    <div class="review-controls">
      <button class="btn btn--sm review-filter-chip" type="button" data-review-panel="filter">
        ${ICON_FILTER}<span data-chip-filter>${escapeHtml(activeMeta?.label || '원본')}</span>
      </button>

      <div class="review-sheet" id="review-filter-sheet" hidden>
        <div class="review-sheet-label">필터</div>
        <div class="layout-toggle">
          ${filters
            .map((filter) => `
          <button class="layout-toggle-button ${filter.id === activeFilter ? 'active' : ''}"
                  data-filter="${filter.id}" type="button">${escapeHtml(filter.label)}</button>`)
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderPrint(room, myUserId, filters, stickerRegistry) {
  const users = room.users || [];
  const template = resolveTemplate(room.settings?.template, users.length);
  const design = resolveDesign(template, room.settings?.design);
  const geometry = buildFrameGeometry(template, design);
  const shotOrder = getEffectiveShotOrder(room);

  const activeFilter = room.settings?.filter || 'none';
  const filterMeta = filters.find((filter) => filter.id === activeFilter);
  const filterCss = filterMeta?.css || 'none';
  const fxActive = Boolean(filterMeta?.fx);

  return `
    <div class="review-print" style="--frame-color:${geometry.style.frameColor}">
      <div class="photo-board" style="--ar:${(geometry.width / geometry.height).toFixed(4)}">
        ${renderFrameCard({ room, myUserId, shotOrder, geometry, template, filterCss, fxActive, stickerRegistry })}
      </div>
    </div>
  `;
}

function renderChoosing(room, myUserId, filters, stickerRegistry) {
  const activeFilter = room.settings?.filter || 'none';

  return `
    <div class="page review-page">
      ${renderTopbar({
        headline: '어떻게 남길까요',
        subhead: '필터를 고르면 모두의 화면이 같이 바뀝니다',
        showLeave: true,
      })}

      <div class="review-stage">
        <div class="review-ready">
          <div class="review-cams">${renderCams(room, myUserId)}</div>

          ${renderPrint(room, myUserId, filters, stickerRegistry)}

          <div class="review-info">
            <div class="review-info-head">
              <div class="eyebrow">고르는 중</div>
              <div class="review-info-title">어떻게 남길까요</div>
              <p class="lede" style="margin-top:8px">마음에 드는 색을 고르고 확정하세요.</p>
            </div>

            ${renderMeta(room)}
            ${renderFilters(filters, activeFilter)}

            <div class="review-actions">
              <button id="review-confirm-button" class="btn btn--primary" type="button">
                <span data-label>이대로 확정</span>
              </button>
            </div>
            <div class="review-confirm-hint">확정하면 모두의 화면이 결과로 넘어갑니다</div>
          </div>
        </div>
      </div>

      <div class="review-scrim" hidden></div>
    </div>
  `;
}

function renderFinal(room, myUserId, filters, stickerRegistry) {
  return `
    <div class="page review-page">
      ${renderTopbar({
        headline: '완성됐어요',
        subhead: '한 장의 사진으로',
        showLeave: true,
      })}

      <div class="review-stage">
        <div class="review-ready">
          <div class="review-cams">${renderCams(room, myUserId)}</div>

          ${renderPrint(room, myUserId, filters, stickerRegistry)}

          <div class="review-info">
            <div class="review-info-head">
              <div class="eyebrow">완성</div>
              <div class="review-info-title">완성됐어요</div>
              <p class="lede" style="margin-top:8px">다운로드하고 공유해보세요.</p>
            </div>

            ${renderMeta(room)}

            <div class="review-actions">
              <button id="review-retake-button" class="btn btn--ghost" type="button">다시 촬영</button>
              <button id="review-download-button" class="btn btn--primary" type="button">
                ${ICON_DOWNLOAD}<span data-label>다운로드</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderComposing() {
  return `
    <div class="page review-page">
      ${renderTopbar({
        headline: '현상 중',
        subhead: '컷을 모으고 있어요.',
        showLeave: false,
      })}

      <div class="review-stage">
        <div class="review-composing">
          <div class="review-skeleton">
            <div class="review-skeleton-bar"></div>
            <div class="review-skeleton-bar"></div>
            <div class="review-skeleton-bar"></div>
            <div class="review-skeleton-bar"></div>
          </div>
          <div>
            <div class="review-composing-title">Developing…</div>
            <div class="review-composing-sub">stitching frames</div>
            <div class="review-composing-wait">잠시만요 — 곧 한 장으로 나옵니다.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFailed(room, renderPreview) {
  return `
    <div class="page review-page">
      ${renderTopbar({
        headline: '결과 확인',
        showLeave: true,
      })}

      <div class="review-stage">
        <div class="review-failed">
          <div class="review-failed-mark">✕</div>
          <div>
            <div class="review-failed-title">사진이 완성되지 못했어요</div>
            <div class="review-failed-desc">
              ${escapeHtml(renderPreview?.error || '잠시 무언가 끊겼어요.')}
            </div>
          </div>

          <div class="review-actions">
            <button id="review-retake-button" class="btn btn--ghost" type="button">다시 촬영</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderReviewLayout({ room, renderPreview, myUserId, filters = [], stickers = [] }) {

  if (!allShotsUploaded(room)) {
    return renderPreview?.status === 'error'
      ? renderFailed(room, renderPreview)
      : renderComposing();
  }

  return room.session?.confirmedAt
    ? renderFinal(room, myUserId, filters, stickers)
    : renderChoosing(room, myUserId, filters, stickers);
}
