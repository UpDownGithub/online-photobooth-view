import { escapeHtml } from './room.helpers.js';
const sampleShotHtml = '';
function pillButton({ id, label, variant }) {
  return `
    <button id="${id}" class="btn btn--${variant} btn--block" type="button">
      <span data-label>${escapeHtml(label)}</span>
    </button>
  `;
}
export function renderLandingLayout({ invited = false } = {}) {
  const sharedRoomId = invited;
  const heroHtml = sharedRoomId
    ? `
      <div class="landing-hero">
        ${sampleShotHtml}
        <div class="eyebrow">초대받았어요</div>
        <h1 class="display wordmark">Photobooth</h1>
        <p class="lede">이름만 남기면 바로 들어갈 수 있어요.</p>
      </div>
    `
    : `
      <div class="landing-hero">
        ${sampleShotHtml}
        <div class="eyebrow">online</div>
        <h1 class="display wordmark">Photobooth</h1>
        <p class="lede">
          멀리 있어도 한 사진에.<span class="lede-more"><br />방을 만들고 링크만 보내면 네 컷이 함께 찍힙니다.</span>
        </p>
      </div>
    `;

  const cardBodyHtml = sharedRoomId
    ? `
      ${pillButton({ id: 'join-submit-button', label: '참가하기', variant: 'primary' })}
      <div class="landing-join-row" aria-hidden="true" style="visibility:hidden">
        <span>또는</span><span class="link-button">방 참가하기</span>
      </div>
    `
    : `
      ${pillButton({ id: 'create-submit-button', label: '방 만들기', variant: 'primary' })}
      <div class="landing-join-row">
        <span>또는</span>
        <button id="join-open-button" class="link-button" type="button">방 참가하기</button>
      </div>
    `;

  return `
    <div class="page landing-page">
      <div id="landing-auth" class="landing-auth"></div>

      <main class="landing-main">
        ${heroHtml}

        <div class="landing-card">
          <div class="landing-card-title">${sharedRoomId ? '참가하기' : '시작하기'}</div>
          <div class="landing-card-sub">
            ${sharedRoomId ? '이름만 정하면 바로 들어가요.' : '이름만 정하면 바로 방이 열려요.'}
          </div>

          <form id="entry-form" class="landing-form">
            <div class="field">
              <label class="label" for="nickname">이름</label>
              <input
                id="nickname"
                name="nickname"
                class="input"
                type="text"
                placeholder="nickname"
                autocomplete="off"
              />
            </div>

            <p id="entry-error" class="error-text"></p>

            ${cardBodyHtml}
          </form>
        </div>
      </main>

      <footer class="site-footer">
        <span class="site-footer-copy">© 2026 Photobooth</span>
        
      </footer>
    </div>
  `;

}
export function setBusy(button, busyLabel) {
  if (!button) return;
  const label = button.querySelector('[data-label]');
  if (!button.dataset.idleLabel) button.dataset.idleLabel = label.textContent;

  if (busyLabel) {
    label.textContent = busyLabel;
    button.classList.add('is-busy');
    button.disabled = true;
  } else {
    label.textContent = button.dataset.idleLabel;
    button.classList.remove('is-busy');
    button.disabled = false;
  }
}
