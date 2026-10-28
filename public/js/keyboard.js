/* On-screen keyboard: layouts, finger-coloured keys with finger pads on the
 * home row, next-key / Shift highlighting and the movement arrow from the
 * finger's home key to the next key. Extracted from main.js.
 */

import { FINGER_NAMES, fingerFor, fingerMovement, homeKeyForFinger, setFingerLanguage } from './state.js';
import { t } from './i18n.js';
import { needsShift, baseKeyFor } from './shift.js';
import { initArrowOverlay, destroyArrowOverlay, drawArrow, clearArrow, isReady } from './arrows.js';

const $ = id => document.getElementById(id);

/** Set by main.js: PC/Mac layout variant and whether movement arrows are shown. */
export const keyboardSettings = { layout: 'pc-ansi', showArrows: true };

/* ============ KEYBOARD LAYOUT DEFINITIONS ============ */

const KB_LAYOUTS = {
  'pc-ansi': {
    ru: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
      ['ф','ы','в','а','п','р','о','л','д','ж','э'],
      ['я','ч','с','м','и','т','ь','б','ю','.'],
    ],
    en: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['q','w','e','r','t','y','u','i','o','p','[',']','\\'],
      ['a','s','d','f','g','h','j','k','l',';','\''],
      ['z','x','c','v','b','n','m',',','.','/'],
    ],
  },
  'pc-iso': {
    ru: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
      ['ф','ы','в','а','п','р','о','л','д','ж','э'],
      ['\\','я','ч','с','м','и','т','ь','б','ю','.'],
    ],
    en: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['q','w','e','r','t','y','u','i','o','p','[',']'],
      ['a','s','d','f','g','h','j','k','l',';','\''],
      ['\\','z','x','c','v','b','n','m',',','.','/'],
    ],
  },
  'mac-ansi': {
    ru: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
      ['ф','ы','в','а','п','р','о','л','д','ж','э'],
      ['я','ч','с','м','и','т','ь','б','ю','.'],
    ],
    en: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['q','w','e','r','t','y','u','i','o','p','[',']','\\'],
      ['a','s','d','f','g','h','j','k','l',';','\''],
      ['z','x','c','v','b','n','m',',','.','/'],
    ],
  },
  'mac-iso': {
    ru: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
      ['ф','ы','в','а','п','р','о','л','д','ж','э'],
      ['\\','я','ч','с','м','и','т','ь','б','ю','.'],
    ],
    en: [
      ['1','2','3','4','5','6','7','8','9','0','-','='],
      ['q','w','e','r','t','y','u','i','o','p','[',']'],
      ['a','s','d','f','g','h','j','k','l',';','\''],
      ['\\','z','x','c','v','b','n','m',',','.','/'],
    ],
  },
};

/** Keyboards of the extra text languages (same rows for every PC/Mac variant). */
const EXTRA_LANG_ROWS = {
  uk: [
    ['1','2','3','4','5','6','7','8','9','0','-','='],
    ['й','ц','у','к','е','н','г','ш','щ','з','х','ї','ґ'],
    ['ф','і','в','а','п','р','о','л','д','ж','є'],
    ['я','ч','с','м','и','т','ь','б','ю','.'],
  ],
  de: [
    ['1','2','3','4','5','6','7','8','9','0','ß'],
    ['q','w','e','r','t','z','u','i','o','p','ü','+'],
    ['a','s','d','f','g','h','j','k','l','ö','ä','#'],
    ['y','x','c','v','b','n','m',',','.','-'],
  ],
  es: [
    ['1','2','3','4','5','6','7','8','9','0','\'','¡'],
    ['q','w','e','r','t','y','u','i','o','p','`','+'],
    ['a','s','d','f','g','h','j','k','l','ñ','´','ç'],
    ['z','x','c','v','b','n','m',',','.','-'],
  ],
};
/** Home-row positions (row 2, columns of the eight fingers) for keyboards without homeKeyForFinger data. */
const HOME_COLUMNS = new Set([0, 1, 2, 3, 6, 7, 8, 9]);

/** Rows of the on-screen keyboard for `lang` under the current PC/Mac layout variant. */
function rowsFor(lang) {
  if (EXTRA_LANG_ROWS[lang]) return EXTRA_LANG_ROWS[lang];
  const layoutDef = KB_LAYOUTS[keyboardSettings.layout] || KB_LAYOUTS['pc-ansi'];
  return (lang === 'en' || lang === 'code') ? layoutDef.en : layoutDef.ru;
}

/* ============ HOME-ROW KEY FINGER MARKS ============ */

/** Fingers of each hand — used to tilt the pad toward the pressing hand. */
const LEFT_HAND_FINGERS = new Set(['lp', 'lr', 'lm', 'li']);
const RIGHT_HAND_FINGERS = new Set(['ri', 'rm', 'rr', 'rp']);

/**
 * Inline SVG of a fingertip pad (подушка пальца) drawn "on the button" for
 * every home-row key (A S D F / J K L ; and RU: Ф Ы В А / О Л Д Ж) and the
 * space key, in ANY keyboard layout.
 *
 * Instead of a whole finger, each home key shows just the soft rounded
 * fingertip pad, as if you were looking down at the hand resting on the
 * keyboard: the pad oval with the fingernail near its top edge and a hint of
 * fingerprint ridges, so the shape reads as a finger pad at a glance.
 *
 * The pads are then arranged in a natural semicircular arc across the home
 * row by CSS (each finger class sets its own `top` offset and `width`):
 * pinky sits lowest & smallest → ring a bit higher & larger → middle
 * highest & largest, index just below the middle — mirrored for the right
 * hand. The thumb gets the biggest pad of all, resting on the lowest key
 * (the space bar).
 *
 * Colored with the key's finger-zone color via `currentColor`; the string is
 * fully static (no user input) so it is safe for innerHTML.
 *
 * @param {string} finger - 'lp'|'lr'|'lm'|'li'|'ri'|'rm'|'rr'|'rp'|'tt'
 * @returns {string} SVG markup
 */
function fingerPadSVG(finger) {
  const isThumb = finger === 'tt';
  // Slight tilt mirrors the natural orientation of each hand.
  const tilt = LEFT_HAND_FINGERS.has(finger) ? -6 : (RIGHT_HAND_FINGERS.has(finger) ? 6 : 0);
  // The thumb pad is wider relative to its height (viewBox 36x20 vs 24x22).
  const vb = isThumb ? '0 0 36 20' : '0 0 24 22';

  // Pad silhouette — a soft oval
  const pad = isThumb
    ? 'M2.2 10.5 C2.2 5 7 3 18 3 C29 3 33.8 5 33.8 10.5 C33.8 16 29 19 18 19 C7 19 2.2 16 2.2 10.5 Z'
    : 'M3.5 9.5 C3.5 4.9 7.3 2.8 12 2.8 C16.7 2.8 20.5 4.9 20.5 9.5 C20.5 14.8 17.1 18.8 12 18.8 C6.9 18.8 3.5 14.8 3.5 9.5 Z';

  // Fingernail visible near the top edge of the pad
  const nail = isThumb
    ? 'M9 5.8 C9 4 11.5 3.4 18 3.4 C24.5 3.4 27 4 27 5.8 C27 7.6 24.6 8.6 18 8.6 C11.4 8.6 9 7.6 9 5.8 Z'
    : 'M7.2 5.6 C7.2 3.9 9 3.3 12 3.3 C15 3.3 16.8 3.9 16.8 5.6 C16.8 7.3 15.2 8.2 12 8.2 C8.8 8.2 7.2 7.3 7.2 5.6 Z';

  // Fingerprint ridges — make the shape read as a "подушка пальца"
  const ridges = isThumb
    ? ['M6.5 12.6 C9 15 13.5 16.6 18 16.6 C22.5 16.6 27 15 29.5 12.6',
       'M9.5 15.6 C12 17.2 15 18 18 18 C21 18 24 17.2 26.5 15.6']
    : ['M6.8 12.2 C8.3 14.2 10.2 15.2 12 15.2 C13.8 15.2 15.7 14.2 17.2 12.2',
       'M8.2 15 C9.4 16.3 10.7 16.9 12 16.9 C13.3 16.9 14.6 16.3 15.8 15'];

  // Glossy highlight on the upper-left edge
  const highlight = isThumb
    ? 'M5 7.6 C6 5.4 9 3.9 12.5 3.5'
    : 'M4.8 7.4 C5.3 5.1 7.5 3.7 10.2 3.3';

  return [
    '<svg class="finger-pad" viewBox="' + vb + '" aria-hidden="true" focusable="false">',
    '  <g transform="rotate(' + tilt + ' 12 11)" fill="currentColor">',
    '    <path d="' + pad + '" stroke="rgba(0,0,0,0.35)" stroke-width="1" stroke-linejoin="round"/>',
    '    <path d="' + nail + '" fill="rgba(255,255,255,0.55)"/>',
    '    <path d="' + ridges[0] + '" stroke="rgba(0,0,0,0.22)" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
    '    <path d="' + ridges[1] + '" stroke="rgba(0,0,0,0.18)" stroke-width="1" fill="none" stroke-linecap="round"/>',
    '    <path d="' + highlight + '" stroke="rgba(255,255,255,0.35)" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
    '  </g>',
    '</svg>',
  ].join('\n');
}

/** Build the finger-pad indicator placed on a home-row key (or space key). */
function makeFingerMark(finger) {
  const mark = document.createElement('span');
  mark.className = 'finger-mark ' + finger;
  mark.title = (FINGER_NAMES[finger] || finger) + ' — ' + t('hint.home_key');
  mark.innerHTML = fingerPadSVG(finger);
  return mark;
}

/* ============ SHIFT KEY DETECTION ============ */

/**
 * Highlight or unhighlight both Shift keys on the keyboard.
 * Called whenever the next character changes.
 */
function setShiftHighlight(show) {
  const shiftKeys = document.querySelectorAll('.key[data-key="Shift"]');
  shiftKeys.forEach(el => {
    el.classList.toggle('next', show);
  });
}

/* ============ KEYBOARD UI ============ */

export function buildKeyboard(lang, currentChar = null) {
  const wrap = $('keyboard');
  if (!wrap) return;

  // Destroy existing arrow overlay before rebuilding keyboard
  destroyArrowOverlay();

  wrap.innerHTML = '';

  const extraRows = EXTRA_LANG_ROWS[lang];
  const layout = rowsFor(lang);
  setFingerLanguage(lang);

  // Which language's home-row keys should show a drawn finger
  const homeLang = (lang === 'en' || lang === 'code') ? 'en' : 'ru';

  // Render all 4 rows: numbers (row 0) + 3 letter rows
  layout.forEach((row, rowIdx) => {
    const r = document.createElement('div'); r.className = 'kb-row';
    row.forEach((k, colIdx) => {
      const el = document.createElement('div');
      const f = fingerFor(k);
      el.className = 'key ' + (f || '');
      el.dataset.key = k;

      // Home-row keys get a finger pad so users see which finger rests where.
      const home = f ? homeKeyForFinger(f) : null;
      const isHomeKey = extraRows
        ? rowIdx === 2 && HOME_COLUMNS.has(colIdx) && !!f
        : home && home[homeLang] === k;

      if (isHomeKey) {
        // Keep the letter readable at the bottom of the key, pad above it
        const cap = document.createElement('span');
        cap.className = 'key-cap';
        cap.textContent = k;
        el.appendChild(cap);
        el.appendChild(makeFingerMark(f));
        // Physical keyboard nubs on the left/right index home keys (F/J, А/О)
        if (f === 'li' || f === 'ri') el.classList.add('finger-bump');
      } else {
        el.textContent = k;
      }

      r.appendChild(el);
    });
    wrap.appendChild(r);
  });

  // Bottom row: Shift + Space + Shift
  const r = document.createElement('div'); r.className = 'kb-row';
  const shiftL = document.createElement('div');
  shiftL.className = 'key shift rp'; shiftL.textContent = '⇧'; shiftL.dataset.key = 'Shift';
  r.appendChild(shiftL);
  const sp = document.createElement('div'); sp.className = 'key space tt';
  sp.dataset.key = ' ';
  // The thumb pad — biggest and lowest of all — rests on the space bar
  const spCap = document.createElement('span');
  spCap.className = 'key-cap';
  spCap.textContent = '␣';
  sp.appendChild(spCap);
  sp.appendChild(makeFingerMark('tt'));
  r.appendChild(sp);
  const shiftR = shiftL.cloneNode(true);
  r.appendChild(shiftR);
  wrap.appendChild(r);

  // Initialize SVG arrow overlay on the keyboard container
  initArrowOverlay(wrap);

  // Apply Shift highlighting if current char needs it
  if (currentChar != null) {
    setShiftHighlight(needsShift(currentChar));
    updateKeyboardArrow(currentChar, lang);
  }
}

/**
 * CSS-escape special characters in data-key selectors.
 */
function cssEscape(s) {
  return s.replace(/[\\"']/g, '\\$&');
}

export function findKeyEl(ch) {
  if (!ch || ch === '\n') return null;
  if (ch === 'Shift') {
    return document.querySelector('.key[data-key="Shift"]');
  }
  return document.querySelector('.key[data-key="' + cssEscape(ch.toLowerCase()) + '"]');
}

export function findKeyElByActual(ch) {
  if (!ch || ch === 'Enter') return null;
  if (ch === ' ') return document.querySelector('.key[data-key=" "]');
  if (ch === 'Shift') return document.querySelector('.key[data-key="Shift"]');
  return document.querySelector('.key[data-key="' + cssEscape(ch.toLowerCase()) + '"]');
}

/**
 * Highlight the next key to press.
 */
export function setNextKey(ch) {
  // First clear all 'next' classes from regular keys AND Shift keys
  document.querySelectorAll('.key').forEach(el => el.classList.remove('next'));

  // Show Shift if needed — both keys get highlighted
  const shiftNeeded = needsShift(ch);
  setShiftHighlight(shiftNeeded);

  // If Shift is needed, highlight the BASE key (e.g. '1' for '!')
  const displayKey = shiftNeeded ? baseKeyFor(ch) : ch;
  const el = findKeyEl(displayKey || ch);
  if (el) el.classList.add('next');
}

/**
 * Get the home key character for a finger in the current layout.
 * @param {string} finger - finger ID (e.g. 'lp', 'ri')
 * @param {string} lang - layout language ('ru', 'en', 'code')
 * @returns {string|null} - the home key character
 */
function getHomeKeyChar(finger, lang) {
  if (EXTRA_LANG_ROWS[lang]) {
    // Home row by position: pinky..index on columns 0-3, index..pinky on 6-9
    const col = { lp: 0, lr: 1, lm: 2, li: 3, ri: 6, rm: 7, rr: 8, rp: 9 }[finger];
    return col == null ? null : EXTRA_LANG_ROWS[lang][2][col];
  }
  const home = homeKeyForFinger(finger);
  if (!home) return null;
  const layout = (lang === 'en' || lang === 'code') ? 'en' : 'ru';
  return home[layout] || home.en;
}

/**
 * Draw an SVG arrow from the finger's home-row position to the target key.
 * Only draws when showMovementArrows is true and the finger must actually move.
 */
export function updateKeyboardArrow(ch, lang) {
  // Clear previous SVG arrow
  if (isReady()) clearArrow();

  // Also remove old data-dir attribute (kept for backward compat / cleanup)
  document.querySelectorAll('.key').forEach(el => el.removeAttribute('data-dir'));

  if (!keyboardSettings.showArrows || !ch || ch === ' ' || ch === '\n') return;

  const f = fingerFor(ch);
  if (!f || f === 'tt') return;

  // Home-row key — no arrow needed
  const movement = fingerMovement(ch, lang, rowsFor(lang));
  if (!movement) return;
  if (movement.rowDiff === 0 && movement.colDiff === 0) return;

  // Find home key element and target key element
  const homeKeyChar = getHomeKeyChar(f, lang);
  if (!homeKeyChar) return;

  const shiftNeeded = needsShift(ch);
  const displayKey = shiftNeeded ? baseKeyFor(ch) : ch;
  const targetKeyChar = displayKey || ch;

  const keyboardEl = document.getElementById('keyboard');
  const homeKeyEl = findKeyEl(homeKeyChar);
  const targetKeyEl = findKeyEl(targetKeyChar);

  if (homeKeyEl && targetKeyEl && keyboardEl) {
    drawArrow(homeKeyEl, targetKeyEl, f, keyboardEl);
  }
}

