/* Background skins: one per text profile, picked by hand or following the profile.
 * The choice is kept per device in localStorage; <html data-skin> drives the CSS.
 * index.html applies the saved skin before first paint (see AUTO_KEY).
 */

import { t } from './i18n.js';

export const SKINS = ['general', 'writer', 'programmer', 'accountant', 'journalist', 'student', 'doctor', 'lawyer'];
const KEY = 'toptip-skin';           // 'none' | 'auto' | a skin id
const AUTO_KEY = 'toptip-skin-auto'; // the skin 'auto' last resolved to, for the anti-flash script

let currentProfile = 'general';

export function getSkinChoice() {
  try { return localStorage.getItem(KEY) || 'none'; } catch { return 'none'; }
}

/** The skin to show for a choice: 'auto' follows the profile, 'none' shows none. */
export function resolveSkin(choice, profile) {
  if (choice === 'auto') return SKINS.includes(profile) ? profile : 'general';
  return SKINS.includes(choice) ? choice : null;
}

/** Show a skin without saving it (live preview in the settings modal). */
export function previewSkin(choice, profile = currentProfile) {
  const skin = resolveSkin(choice, profile);
  const root = document.documentElement;
  if (skin) root.dataset.skin = skin;
  else delete root.dataset.skin;
  return skin;
}

/** Re-apply the saved choice, e.g. after a preview was cancelled. */
export function applySkin() {
  const choice = getSkinChoice();
  const skin = previewSkin(choice);
  if (choice === 'auto') {
    try { localStorage.setItem(AUTO_KEY, skin); } catch {}
  }
}

export function setSkinChoice(choice) {
  try { localStorage.setItem(KEY, choice); } catch {}
  applySkin();
}

/** The text profile changed: an 'auto' skin follows it. */
export function setSkinProfile(profile) {
  currentProfile = SKINS.includes(profile) ? profile : 'general';
  applySkin();
}

/** <option>s for the settings select: none, auto, then one per profile. */
export function skinOptions(selected) {
  const opts = [
    { value: 'none', label: t('skin.none') },
    { value: 'auto', label: t('skin.auto') },
    ...SKINS.map(id => ({ value: id, label: `${t('profile.' + id)} — ${t('skin.' + id)}` })),
  ];
  return opts
    .map(o => `<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${o.label}</option>`)
    .join('');
}
