/**
 * Mini hand icons for home-row keys.
 *
 * Renders a small palm-down hand (as seen hovering over the keyboard) with
 * the finger assigned to a home-row key highlighted in the finger's zone
 * color. The icon is placed on the home-row keys ("asdf" / "jkl;" in EN,
 * "фыва" / "олдж" in RU, and in any other layout) so the user immediately
 * sees which finger should rest on which key.
 *
 * The caller maps the rendered key character to a finger id via
 * homeKeyForFinger() / isHomeKey(), so this module is layout-agnostic.
 */

import { homeKeyForFinger } from './state.js';

/* Finger order on a palm-down hand, left → right.
 * Left hand:  pinky → ring → middle → index  (thumb on the right side)
 * Right hand: index → middle → ring → pinky  (thumb on the left side)
 */
const LEFT_HAND_ORDER = ['lp', 'lr', 'lm', 'li'];
const RIGHT_HAND_ORDER = ['ri', 'rm', 'rr', 'rp'];

/* Geometry (viewBox 0 0 50 31) */
const FINGER_X = [6, 16, 26, 36];
const FINGER_Y = 0;
const FINGER_W = 8;
const FINGER_H = 13;

const PALM = { x: 2, y: 11, w: 46, h: 19, rx: 6 };

const THUMB_LEFT = { x: 1, y: 17, w: 12, h: 9, rx: 4.5 };  // right hand (left side)
const THUMB_RIGHT = { x: 37, y: 17, w: 12, h: 9, rx: 4.5 }; // left hand (right side)

/* Dim colors — neutral gray that works on both dark and light themes */
const DIM = 'rgba(128,128,128,0.40)';
const DIM_THUMB = 'rgba(128,128,128,0.22)';

function rect(x, y, w, h, rx, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
}

/**
 * Build an SVG string of a small hand with the given finger highlighted.
 * The highlighted finger uses `currentColor`, so the key's zone color
 * (e.g. `var(--lp)`) is picked up automatically via CSS.
 *
 * @param {string} fingerId - 'lp'|'lr'|'lm'|'li'|'ri'|'rm'|'rr'|'rp'
 * @returns {string|null} SVG markup, or null for unknown / thumb ids
 */
export function fingerHandSVG(fingerId) {
  const leftIdx = LEFT_HAND_ORDER.indexOf(fingerId);
  const rightIdx = RIGHT_HAND_ORDER.indexOf(fingerId);
  if (leftIdx === -1 && rightIdx === -1) return null;

  const isLeft = leftIdx !== -1;
  const highlightIdx = isLeft ? leftIdx : rightIdx;
  const order = isLeft ? LEFT_HAND_ORDER : RIGHT_HAND_ORDER;

  // Palm first (behind the fingers)
  let body = rect(PALM.x, PALM.y, PALM.w, PALM.h, PALM.rx, DIM);

  // Fingers on top of the palm; the assigned finger gets the zone color
  order.forEach((_, i) => {
    body += rect(FINGER_X[i], FINGER_Y, FINGER_W, FINGER_H, 4, i === highlightIdx ? 'currentColor' : DIM);
  });

  // Thumb (subtle, home-row keys are pressed by fingers, not thumbs)
  const thumb = isLeft ? THUMB_RIGHT : THUMB_LEFT;
  body += rect(thumb.x, thumb.y, thumb.w, thumb.h, thumb.rx, DIM_THUMB);

  return `<svg class="home-hand" viewBox="0 0 50 31" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * Check whether a key character is the home key of the given finger
 * in the given layout. Works for any layout ('ru', 'en', 'code' → en).
 *
 * @param {string} ch - key character as rendered on the keyboard
 * @param {string} fingerId - finger id (e.g. 'lp')
 * @param {string} lang - layout language
 * @returns {boolean}
 */
export function isHomeKey(ch, fingerId, lang) {
  if (ch == null || ch === '' || !fingerId) return false;
  const layout = (lang === 'en' || lang === 'code') ? 'en' : 'ru';
  const home = homeKeyForFinger(fingerId);
  return !!(home && home[layout] === ch);
}
