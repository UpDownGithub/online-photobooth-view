let currentScrim = null;
let lastFocused = null;

export function closeModal() {
  if (!currentScrim) return;

  currentScrim.remove();
  currentScrim = null;
  document.removeEventListener('keydown', onKeydown);

  lastFocused?.focus?.();
  lastFocused = null;
}

function onKeydown(event) {
  if (event.key === 'Escape') closeModal();
}

export function openModal({
  title,
  description = '',
  bodyHtml = '',
  actions = [],
  dismissible = true,
} = {}) {
  closeModal();
  lastFocused = document.activeElement;

  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';

  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = `
    <div class="modal-title">${title}</div>
    ${description ? `<div class="modal-desc">${description}</div>` : ''}
    ${bodyHtml}
    ${actions.length ? '<div class="modal-actions"></div>' : ''}
  `;

  const actionsEl = dialog.querySelector('.modal-actions');
  actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn--${action.variant || 'quiet'}`;
    button.textContent = action.label;
    button.addEventListener('click', async () => {
       
      const result = await action.onClick?.(dialog);
       
      if (!action.keepOpen && result !== false) closeModal();
    });
    actionsEl.appendChild(button);
  });

  dialog.addEventListener('click', (event) => event.stopPropagation());
  if (dismissible) {
    scrim.addEventListener('click', closeModal);
    document.addEventListener('keydown', onKeydown);
  }

  scrim.appendChild(dialog);
  document.body.appendChild(scrim);
  currentScrim = scrim;

  const firstField = dialog.querySelector('input, textarea, select');
  (firstField || dialog.querySelector('.modal-actions .btn'))?.focus();

  return dialog;
}
