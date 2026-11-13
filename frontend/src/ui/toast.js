const LIFETIME_MS = 1700;
const FADE_MS = 200;  

let current = null;
let hideTimer = null;
let removeTimer = null;

export function showToast(message) {
  if (!message) return;

  dismissToast();

  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');  
  el.textContent = message;
  document.body.appendChild(el);
  current = el;

  hideTimer = setTimeout(() => {
    el.classList.add('leaving');
    removeTimer = setTimeout(() => {
      el.remove();
      if (current === el) current = null;
    }, FADE_MS);
  }, LIFETIME_MS);
}

export function dismissToast() {
  clearTimeout(hideTimer);
  clearTimeout(removeTimer);
  current?.remove();
  current = null;
}
