/* First-visit guide: a few short cards on finger placement, the colour
 * coding and good habits, ending with an offer to start the course.
 * Shown once automatically; reopened from the sidebar (event 'open-onboarding').
 */

const SEEN_KEY = 'toptip-onboarded';

const STEPS = [
  { icon: '🖐️', titleKey: 'onb.home.title', textKey: 'onb.home.text' },
  { icon: '🎨', titleKey: 'onb.colors.title', textKey: 'onb.colors.text' },
  { icon: '👀', titleKey: 'onb.look.title', textKey: 'onb.look.text' },
  { icon: '🎓', titleKey: 'onb.start.title', textKey: 'onb.start.text' },
];

export function hasSeenOnboarding() {
  try { return localStorage.getItem(SEEN_KEY) === 'true'; } catch { return true; }
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, 'true'); } catch {}
}

/**
 * @param {{ t: (key: string) => string, onStartCourse: () => void }} opts
 */
export function showOnboarding({ t, onStartCourse }) {
  if (document.querySelector('.onboarding')) return;
  let step = 0;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay onboarding';
  document.body.appendChild(overlay);

  const close = () => {
    markSeen();
    overlay.remove();
  };

  const render = () => {
    const s = STEPS[step];
    const last = step === STEPS.length - 1;
    overlay.innerHTML = `
      <div class="modal onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onb-title">
        <div class="onb-icon" aria-hidden="true">${s.icon}</div>
        <h2 id="onb-title">${t(s.titleKey)}</h2>
        <p class="onb-text">${t(s.textKey)}</p>
        <div class="onb-dots" aria-hidden="true">${STEPS.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>
        <div class="modal-actions">
          <button id="onb-skip">${t(last ? 'onb.later' : 'onb.skip')}</button>
          ${step > 0 ? `<button id="onb-back">${t('onb.back')}</button>` : ''}
          <button class="primary-btn" id="onb-next">${t(last ? 'onb.start_course' : 'onb.next')}</button>
        </div>
      </div>`;
    overlay.querySelector('#onb-skip').onclick = close;
    const back = overlay.querySelector('#onb-back');
    if (back) back.onclick = () => { step--; render(); };
    overlay.querySelector('#onb-next').onclick = () => {
      if (last) {
        close();
        onStartCourse();
      } else {
        step++;
        render();
      }
    };
    overlay.querySelector('#onb-next').focus();
  };
  render();
}
