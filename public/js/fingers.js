/* Home-row finger markers for the on-screen keyboard.
 *
 * Helps identify the home-row keys — asdf / jkl; on the English layout,
 * фыва / олдж on the Russian layout — for ANY physical keyboard type
 * (PC/Mac, ANSI/ISO: home rows are identical across them) and provides a
 * small SVG "finger pointing down" marker that is drawn on those keys so
 * the user can see at a glance which finger rests where.
 *
 * The marker inherits its colour via `currentColor` from the key's finger
 * zone class (.key.lp, .key.ri, ...), so no per-finger colour logic is
 * needed here.
 */

import { fingerFor, homeKeyForFinger } from './state.js';

/**
 * Map a text-mode language to the layout key used by homeKeyForFinger.
 * 'code' texts are typed on the English layout.
 * @param {string} lang - 'ru' | 'en' | 'code'
 * @returns {'ru' | 'en'}
 */
function layoutKey(lang) {
  return (lang === 'en' || lang === 'code') ? 'en' : 'ru';
}

/**
 * Is `ch` a home-row key in the given keyboard layout?
 * Works for EN, RU and 'code' texts and for any physical keyboard type.
 *
 * @param {string|null} ch - single character (case-insensitive)
 * @param {string} lang - 'ru' | 'en' | 'code'
 * @returns {boolean}
 *
 * @example
 * isHomeKey('a', 'en')   // true  (left pinky home)
 * isHomeKey('j', 'en')   // true  (right index home)
 * isHomeKey('ф', 'ru')   // true
 * isHomeKey('a', 'ru')   // false (Latin 'a' is not the RU home row)
 * isHomeKey('g', 'en')   // false
 */
export function isHomeKey(ch, lang) {
  if (ch == null || typeof ch !== 'string' || ch.length !== 1) return false;
  const f = fingerFor(ch);
  if (!f) return false;
  const home = homeKeyForFinger(f);
  if (!home) return false;
  return home[layoutKey(lang)] === ch.toLowerCase();
}

/**
 * List of all home-row keys in the given layout, in reading order
 * (left pinky → right pinky).
 *
 * @param {string} lang - 'ru' | 'en' | 'code'
 * @returns {string[]}
 *
 * @example
 * homeRowKeys('en') // ['a','s','d','f','j','k','l',';']
 * homeRowKeys('ru') // ['ф','ы','в','а','о','л','д','ж']
 */
export function homeRowKeys(lang) {
  const layout = layoutKey(lang);
  const order = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];
  return order
    .map(f => homeKeyForFinger(f)?.[layout])
    .filter(Boolean);
}

/**
 * Which finger rests on this home key? Returns the finger ID
 * ('lp', 'ri', ...) or null if the character is not a home key.
 *
 * @param {string|null} ch - single character (case-insensitive)
 * @param {string} lang - 'ru' | 'en' | 'code'
 * @returns {string|null}
 *
 * @example
 * homeFingerForKey('f', 'en') // 'li' (left index)
 * homeFingerForKey('о', 'ru') // 'ri' (right index)
 * homeFingerForKey('g', 'en') // null
 */
export function homeFingerForKey(ch, lang) {
  if (ch == null || typeof ch !== 'string' || ch.length !== 1) return null;
  const f = fingerFor(ch);
  if (!f) return null;
  const home = homeKeyForFinger(f);
  if (!home) return null;
  return home[layoutKey(lang)] === ch.toLowerCase() ? f : null;
}

/**
 * Small SVG "finger pointing down" marker drawn on home-row keys.
 * Uses `currentColor` so it inherits the finger zone colour from the key.
 *
 * @returns {string} SVG markup (safe to assign to innerHTML)
 */
export function fingerMarkerSVG() {
  return '<svg viewBox="0 0 12 16" aria-hidden="true" focusable="false">' +
    '<rect x="3.5" y="0" width="5" height="9" rx="2.5" fill="currentColor"/>' +
    '<rect x="1.5" y="7" width="9" height="8" rx="4" fill="currentColor"/>' +
    '</svg>';
}
