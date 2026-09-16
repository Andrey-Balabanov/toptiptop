/* Home-key decorator: marks home-row keys and adds finger icons + tactile bumps.
 *
 * This module follows the arrows.js pattern — all DOM access happens inside
 * functions, so it can be unit-tested with simple mocks.
 *
 * decorateKeyboard() is idempotent: re-running it (layout switch, toggle,
 * keyboard rebuild) never duplicates icons or leaves stale markers.
 */

import { homeKeyForLayout, getFingerName } from './state.js';
import { fingerIconSVG } from './fingerIcon.js';

/** Index fingers get a tactile bump (F/J on EN, А/О on RU). */
const INDEX_FINGERS = new Set(['li', 'ri']);

const HOME_CLASSES = [
  'home-key', 'home-lp', 'home-lr', 'home-lm', 'home-li',
  'home-ri', 'home-rm', 'home-rr', 'home-rp',
];

/** Remove any icons, bumps and home markers previously added to a key. */
function clearDecorations(el) {
  el.querySelectorAll('.finger-icon, .home-bump').forEach(n => n.remove());
  el.classList.remove(...HOME_CLASSES);
  delete el.dataset.homeFinger;
}

/**
 * Decorate home-row keys in #keyboard for the given layout.
 *
 * @param {string} lang - 'ru' | 'en' | 'code' (current displayed layout)
 * @param {boolean} showIcons - whether to render icons/bumps (toggle).
 *   When false, only the marker class and accessible name remain.
 */
export function decorateKeyboard(lang, showIcons = true) {
  const wrap = document.getElementById('keyboard');
  if (!wrap) return;

  const homes = homeKeyForLayout(lang);

  wrap.querySelectorAll('.key[data-key]').forEach(el => {
    clearDecorations(el);

    // Exact data-key match against the home map. This keeps '''/'э' out
    // even though they belong to the right-pinky zone.
    let finger = null;
    for (const [id, home] of Object.entries(homes)) {
      if (home === el.dataset.key) { finger = id; break; }
    }
    if (!finger) return;

    el.classList.add('home-key', 'home-' + finger);
    el.dataset.homeFinger = finger;

    // Accessibility: the icon is decorative, the meaning lives in the name.
    const name = getFingerName(finger);
    el.title = name;
    el.setAttribute('aria-label', name);

    if (!showIcons) return;

    const icon = document.createElement('span');
    icon.className = 'finger-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = fingerIconSVG(finger); // static SVG string, safe
    el.appendChild(icon);

    if (INDEX_FINGERS.has(finger)) {
      const bump = document.createElement('span');
      bump.className = 'home-bump';
      bump.setAttribute('aria-hidden', 'true');
      el.appendChild(bump);
    }
  });
}
