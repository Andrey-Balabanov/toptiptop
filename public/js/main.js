/* Main entry point – bootstraps the typing trainer */

import { FINGER_NAMES, refreshFingerNames, fingerFor, fingerMovement, homeKeyForFinger, createState } from './state.js';
import { buildText, modeToLang } from './texts.js';
import * as sound from './sound.js';
import * as effects from './effects.js';
import * as progress from './progress.js';
import * as api from './api.js';
import { renderAuthBar, showAuthModal, setAuthChangeCallback } from './auth.js';
import { t, setLanguage, applyLanguageToDOM, getLanguage } from './i18n.js';
import { needsShift, baseKeyFor } from './shift.js';
import { initArrowOverlay, destroyArrowOverlay, drawArrow, clearArrow, isReady } from './arrows.js';

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

function getCurrentKBRows() {
  const layoutDef = KB_LAYOUTS[currentKeyboardLayout] || KB_LAYOUTS['pc-ansi'];
  return layoutDef;
}

/* ============ DOM shortcuts ============ */
const $ = id => document.getElementById(id);
const textEl = $('text');

/* Current keyboard layout preference */
let currentKeyboardLayout = 'pc-ansi';

/* Current user profile (for text selection) — default 'general' */
let currentProfile = 'general';

/* Movement arrows toggle — persisted in localStorage */
let showMovementArrows = true;
try {
  showMovementArrows = localStorage.getItem('toptip-show-arrows') !== 'false';
} catch {}

/* Listen for arrow toggle events from sidebar buttons (auth.js) */
window.addEventListener('arrows-toggled', (e) => {
  showMovementArrows = e.detail.show;
  if (state) {
    const ch = state.text[state.pos];
    const lang = modeToLang($('mode').value);
    updateKeyboardArrow(ch, lang);
  } else {
    // If no state, just clear any lingering arrows
    if (isReady()) clearArrow();
  }
});

/* ============ LAYOUT OVERRIDE (mixed-language support) ============ */

/**
 * Detect if a text contains characters from both Cyrillic (RU) and Latin (EN) layouts.
 * @param {string} text
 * @returns {{ hasCyrillic: boolean, hasLatin: boolean, isMixed: boolean }}
 */
function detectMixedLanguage(text) {
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  return { hasCyrillic, hasLatin, isMixed: hasCyrillic && hasLatin };
}

/**
 * Determine which keyboard layout a character belongs to.
 * @param {string} ch - Single character
 * @returns {'ru' | 'en' | null} - null for neutral chars (space, newline, digits)
 */
function charLayout(ch) {
  if (ch == null || ch === '\n') return null;
  if (ch === ' ') return null;
  // Cyrillic (including Ё/ё)
  if (/[\u0400-\u04FF]/.test(ch) || ch === 'Ё' || ch === 'ё') return 'ru';
  // Latin letters
  if (/[a-zA-Z]/.test(ch)) return 'en';
  // Digits and symbols are ambiguous — don't force a switch
  return null;
}

/**
 * Get the effective keyboard layout currently displayed.
 * For single-language texts this matches modeToLang.
 * For mixed-language texts this uses the user's current override.
 */
function getEffectiveLayout() {
  if (isMixedLanguage && currentDisplayLayout) {
    return currentDisplayLayout;
  }
  return modeToLang($('mode').value);
}

/** Flag: does the current text contain both RU and EN characters? */
let isMixedLanguage = false;

/**
 * The user's current layout override (only meaningful when isMixedLanguage is true).
 * 'ru' = keyboard showing Russian layout, 'en' = keyboard showing English layout.
 * Persisted to localStorage so it survives page reloads.
 */
let currentDisplayLayout = null;

/** Persist the layout override to localStorage */
function persistLayoutOverride() {
  try {
    if (currentDisplayLayout) {
      localStorage.setItem('toptip-kb-layout-override', currentDisplayLayout);
    } else {
      localStorage.removeItem('toptip-kb-layout-override');
    }
  } catch {}
}

/** Load persisted layout override */
function loadLayoutOverride() {
  try {
    const saved = localStorage.getItem('toptip-kb-layout-override');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {}
  return null;
}

/**
 * Toggle the on-screen keyboard between RU and EN layouts.
 * Only meaningful for mixed-language texts.
 */
function toggleKeyboardLayout() {
  if (!isMixedLanguage) return;

  // Flip layout
  currentDisplayLayout = currentDisplayLayout === 'ru' ? 'en' : 'ru';
  persistLayoutOverride();

  const lang = currentDisplayLayout;
  buildKeyboard(lang);

  // Re-evaluate indicator and next-key highlight
  if (state) {
    const ch = state.text[state.pos];
    setNextKey(ch);
    updateKeyboardArrow(ch, lang);
    updateLayoutIndicator();
  }
}

/**
 * Update the on-screen layout indicator badge and toggle button visibility/text.
 * Shows a pulsing badge when the next character needs a different layout,
 * and always shows the toggle button for mixed-language texts.
 */
function updateLayoutIndicator() {
  const indicator = $('layout-indicator');
  const toggleBtn = $('layout-toggle');
  const layoutRow = $('layout-row');

  if (!state || !isMixedLanguage || state.finished) {
    if (layoutRow) layoutRow.classList.add('hidden');
    return;
  }

  // Show the row (always visible in mixed mode)
  if (layoutRow) layoutRow.classList.remove('hidden');

  // Update toggle button text
  if (toggleBtn) {
    toggleBtn.textContent = currentDisplayLayout === 'ru' ? 'EN' : 'РУ';
    toggleBtn.title = currentDisplayLayout === 'ru'
      ? t('layout.switch_to_en')
      : t('layout.switch_to_ru');
  }

  // Determine what layout the next character needs
  const nextChar = state.text[state.pos];
  const neededLayout = charLayout(nextChar);

  if (indicator) {
    if (neededLayout && neededLayout !== currentDisplayLayout) {
      // User needs to switch — show pulsing badge
      indicator.textContent = neededLayout === 'ru' ? '🔤 РУ' : '🔤 EN';
      indicator.className = 'layout-indicator ' + neededLayout;
      indicator.classList.remove('hidden');
    } else {
      // Current layout matches next char — hide badge
      indicator.classList.add('hidden');
    }
  }
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

function buildKeyboard(lang) {
  const wrap = $('keyboard');
  if (!wrap) return;

  // Destroy existing arrow overlay before rebuilding keyboard
  destroyArrowOverlay();

  wrap.innerHTML = '';

  const layoutDef = KB_LAYOUTS[currentKeyboardLayout] || KB_LAYOUTS['pc-ansi'];
  const layout = (lang === 'en' || lang === 'code') ? layoutDef.en : layoutDef.ru;

  // Which language's home-row keys should show a drawn finger
  const homeLang = (lang === 'en' || lang === 'code') ? 'en' : 'ru';

  // Render all 4 rows: numbers (row 0) + 3 letter rows
  layout.forEach(row => {
    const r = document.createElement('div'); r.className = 'kb-row';
    row.forEach(k => {
      const el = document.createElement('div');
      const f = fingerFor(k);
      el.className = 'key ' + (f || '');
      el.dataset.key = k;

      // Home-row keys get a finger pad so users see which finger rests where.
      const home = f ? homeKeyForFinger(f) : null;
      const isHomeKey = home && home[homeLang] === k;

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
  if (state) {
    const ch = state.text[state.pos];
    setShiftHighlight(needsShift(ch));
    updateKeyboardArrow(ch, lang);
  }
}

/**
 * CSS-escape special characters in data-key selectors.
 */
function cssEscape(s) {
  return s.replace(/[\\"']/g, '\\$&');
}

function findKeyEl(ch) {
  if (!ch || ch === '\n') return null;
  if (ch === 'Shift') {
    return document.querySelector('.key[data-key="Shift"]');
  }
  return document.querySelector('.key[data-key="' + cssEscape(ch.toLowerCase()) + '"]');
}

function findKeyElByActual(ch) {
  if (!ch || ch === 'Enter') return null;
  if (ch === ' ') return document.querySelector('.key[data-key=" "]');
  if (ch === 'Shift') return document.querySelector('.key[data-key="Shift"]');
  return document.querySelector('.key[data-key="' + cssEscape(ch.toLowerCase()) + '"]');
}

/**
 * Highlight the next key to press.
 */
function setNextKey(ch) {
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
  const home = homeKeyForFinger(finger);
  if (!home) return null;
  const layout = (lang === 'en' || lang === 'code') ? 'en' : 'ru';
  return home[layout] || home.en;
}

/**
 * Draw an SVG arrow from the finger's home-row position to the target key.
 * Only draws when showMovementArrows is true and the finger must actually move.
 */
function updateKeyboardArrow(ch, lang) {
  // Clear previous SVG arrow
  if (isReady()) clearArrow();

  // Also remove old data-dir attribute (kept for backward compat / cleanup)
  document.querySelectorAll('.key').forEach(el => el.removeAttribute('data-dir'));

  if (!showMovementArrows || !ch || ch === ' ' || ch === '\n') return;

  const f = fingerFor(ch);
  if (!f || f === 'tt') return;

  // Home-row key — no arrow needed
  const layoutDef = getCurrentKBRows();
  const rows = (lang === 'en' || lang === 'code') ? layoutDef.en : layoutDef.ru;
  const movement = fingerMovement(ch, lang, rows);
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

/* ============ APP STATE ============ */

let state = null;

function render() {
  textEl.innerHTML = '';
  for (let i = 0; i < state.text.length; i++) {
    const span = document.createElement('span');
    span.className = 'char';
    const ch = state.text[i];
    span.textContent = ch === '\n' ? '↵\n' : ch;
    // Prevent browser from collapsing whitespace — make spaces visible
    if (ch === ' ') {
      // Use inline-block + min-width so spaces always have visible width,
      // even inside a flex container (focus mode .text-display is display:flex)
      span.style.display = 'inline-block';
      span.style.minWidth = '0.6em';
      span.style.whiteSpace = 'pre';
    } else if (ch === '\n') {
      span.style.display = 'inline-block';
      span.style.whiteSpace = 'pre';
    }
    if (i < state.pos) span.classList.add(state.errors[i] ? 'wrong' : 'correct');
    else if (i === state.pos) span.classList.add('current');
    textEl.appendChild(span);
  }
  updateNext();
}

function updateNext() {
  const ch = state.text[state.pos];
  const lang = modeToLang($('mode').value);

  updateKeyboardArrow(ch, lang);
  setNextKey(ch);

  // Update hint text
  const hint = $('hint');
  if (!hint) return;
  if (ch == null) {
    hint.innerHTML = t('hint.done');
  } else if (ch === ' ') {
    hint.innerHTML = `${t('hint.next')} <b>${t('hint.finger_space')}</b> — ${t('hint.thumb')}`;
  } else if (ch === '\n') {
    hint.innerHTML = `${t('hint.next')} <b>Enter</b> — ${t('hint.right_pinky')}`;
  } else {
    const f = fingerFor(ch);
    let hintText = `${t('hint.next')} <b>${ch}</b> — ${f ? FINGER_NAMES[f] : '—'}`;
    if (needsShift(ch)) {
      const base = baseKeyFor(ch);
      hintText += ' <span style="color:var(--accent)">[⇧ + ' + base + ']</span>';
    }
    hint.innerHTML = hintText;
  }
}

function updateStats() {
  const elapsed = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
  const minutes = elapsed / 60;
  const wpm = minutes > 0 ? Math.round((state.pos / 5) / minutes) : 0;
  const wrongCount = state.errors.filter(Boolean).length;
  const accuracy = state.pos > 0 ? Math.round(((state.pos - wrongCount) / state.pos) * 100) : 100;

  // Update main stats row (visible in start-mode)
  const wpmEl = $('wpm');
  const accEl = $('accuracy');
  const timeEl = $('time');
  const errEl = $('errors');
  if (wpmEl) wpmEl.textContent = wpm;
  if (accEl) accEl.textContent = accuracy + '%';
  if (timeEl) timeEl.textContent = Math.floor(elapsed) + 's';
  if (errEl) errEl.textContent = state.totalErrors;

  // Update focus-mode stats
  const fsWpm = $('fs-wpm');
  const fsAccuracy = $('fs-accuracy');
  const fsTime = $('fs-time');
  const fsErrors = $('fs-errors');
  if (fsWpm) fsWpm.textContent = wpm;
  if (fsAccuracy) fsAccuracy.textContent = accuracy + '%';
  if (fsTime) fsTime.textContent = Math.floor(elapsed) + 's';
  if (fsErrors) fsErrors.textContent = state.totalErrors;

  return wpm;
}

function reset() {
  const mode = $('mode').value;
  const length = $('length').value;
  const lang = modeToLang(mode);
  state = createState(buildText(mode, length, currentProfile, lang));

  // Detect if the text contains mixed languages
  const detected = detectMixedLanguage(state.text);
  isMixedLanguage = detected.isMixed;

  // Initialize or restore layout override for mixed texts
  if (isMixedLanguage) {
    currentDisplayLayout = loadLayoutOverride() || lang;
  } else {
    currentDisplayLayout = null;
  }

  progress.onWrongChar(); // reset streak
  buildKeyboard(lang);
  updateStreakDisplay();
  render();
  updateStats();
  updateLayoutIndicator();

  if (document.activeElement !== textEl) {
    textEl.classList.add('blurred');
  } else {
    textEl.classList.remove('blurred');
  }
}

function flashKey(ch, correct, combo) {
  const el = findKeyEl(ch);
  if (el) {
    el.classList.remove('correct-hit', 'wrong-hit', 'combo-hit');
    void el.offsetWidth;
    el.classList.add(combo ? 'combo-hit' : (correct ? 'correct-hit' : 'wrong-hit'));

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    if (correct) {
      const streak = progress.getCurrentStreak();
      let text = '+1', color = '#9ece6a';
      if (streak >= 10)  { text = '+2'; color = '#e0af68'; }
      if (streak >= 25)  { text = '+3'; color = '#ff9e64'; }
      if (streak >= 50)  { text = '+5'; color = '#f7768e'; }
      if (streak >= 100) { text = '+8'; color = '#bb9af7'; }
      effects.showParticle(x, y, text, color);
      if (combo) effects.showSparks(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        color, 12
      );
    } else {
      effects.showParticle(x, y, '✗', '#f7768e');
    }
  }
}

function flashActualKey(actualChar) {
  if (!actualChar) return;
  const el = findKeyElByActual(actualChar);
  if (!el) return;

  document.querySelectorAll('.key.actual-pressed').forEach(k => k.classList.remove('actual-pressed'));
  el.classList.add('actual-pressed');
  setTimeout(() => {
    if (el) el.classList.remove('actual-pressed');
  }, 600);
}

function updateStreakDisplay() {
  const el = $('streak');
  if (!el) return;
  const streak = progress.getCurrentStreak();
  el.classList.remove('on', 'hot');
  if (streak === 0) { el.textContent = '—'; return; }
  el.textContent = (streak >= 10 ? '🔥 ' : '') + streak;
  if (streak > 0) el.classList.add('on');
  if (streak >= 10) el.classList.add('hot');

  // Update focus-mode streak
  const fsStreak = $('fs-streak');
  if (fsStreak) {
    fsStreak.textContent = streak > 0 ? streak : '—';
  }
}

function updateHeader() {
  const lvl = progress.currentLevel();
  const progXp = progress.getProgress().xp - lvl.totalAtStart;
  const pct = Math.min(100, (progXp / lvl.needed) * 100);
  const levelNum = $('level-num');
  const levelTitleEl = $('level-title');
  const xpFill = $('xp-fill');
  const xpText = $('xp-text');
  const score = $('score');
  if (levelNum) levelNum.textContent = lvl.level;
  if (levelTitleEl) levelTitleEl.textContent = progress.levelTitle(lvl.level);
  if (xpFill) xpFill.style.width = pct + '%';
  if (xpText) xpText.textContent = `${progXp} / ${lvl.needed} XP`;
  if (score) score.textContent = progress.getProgress().xp.toLocaleString('ru-RU');
}

function renderAchievements() {
  const grid = $('ach-grid');
  if (!grid) return;
  grid.innerHTML = '';
  let unlocked = 0;
  progress.getAchievements().forEach(a => {
    const has = !!progress.getProgress().achievements[a.id];
    if (has) unlocked++;
    const cell = document.createElement('div');
    cell.className = 'ach-cell' + (has ? ' unlocked' : '');
    cell.innerHTML = `${has ? a.icon : '🔒'}<div class="ach-tip"><b>${a.name}</b><br>${a.desc}</div>`;
    grid.appendChild(cell);
  });
  const count = $('ach-count');
  if (count) count.textContent = `${unlocked} / ${progress.getAchievements().length}`;
}

async function finishSession() {
  if (!state) return;
  const wpm = updateStats();
  const mode = $('mode').value;

  const elapsed = state.startTime ? (Date.now() - state.startTime) : 0;
  const wrongCount = state.errors.filter(Boolean).length;
  const accuracy = state.pos > 0 ? Math.round(((state.pos - wrongCount) / state.pos) * 100) : 100;

  const xpEarned = progress.finishSession(wpm, mode);
  updateHeader();
  renderAchievements();

  // Show completion overlay
  showCompletionOverlay(wpm, accuracy, wrongCount, xpEarned, elapsed);

  const clientSessionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  if (api.isLoggedIn()) {
    try {
      await api.saveSession({
        wpm,
        accuracy,
        totalErrors: state.totalErrors,
        xpEarned,
        durationMs: elapsed,
        textLength: state.text.length,
        streakMax: progress.getProgress().bestStreak,
        mode,
        clientSessionId,
      });
    } catch (err) {
      console.warn('Session save to server failed, queued:', err.message);
    }
  }
}

/* ============ COMPLETION OVERLAY ============ */

function showCompletionOverlay(wpm, accuracy, errors, xp, elapsed) {
  const overlay = $('completion-overlay');
  if (!overlay) return;

  const cWpm = $('c-wpm');
  const cAccuracy = $('c-accuracy');
  const cTime = $('c-time');
  const cErrors = $('c-errors');
  const cXp = $('c-xp');

  if (cWpm) cWpm.textContent = wpm;
  if (cAccuracy) cAccuracy.textContent = accuracy + '%';
  if (cTime) cTime.textContent = Math.floor(elapsed / 1000) + 's';
  if (cErrors) cErrors.textContent = errors;
  if (cXp) cXp.textContent = '+ ' + xp;

  overlay.classList.remove('hidden');
}

function hideCompletionOverlay() {
  const overlay = $('completion-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/* ============ FOCUS / START MODE SWITCHING ============ */

function enterFocusMode() {
  const app = document.querySelector('.app');
  if (!app) return;

  app.classList.remove('start-mode');
  app.classList.add('focus-mode');

  const backBtn = $('btn-back');
  if (backBtn) backBtn.classList.remove('hidden');

  const focusStats = $('focus-stats');
  if (focusStats) focusStats.classList.remove('hidden');

  // Generate and show the text
  reset();
  textEl.focus();
}

function exitFocusMode() {
  const app = document.querySelector('.app');
  if (!app) return;

  app.classList.remove('focus-mode');
  app.classList.add('start-mode');

  // Hide completion overlay (just in case)
  hideCompletionOverlay();

  // Hide back button and focus stats
  const backBtn = $('btn-back');
  if (backBtn) backBtn.classList.add('hidden');

  const focusStats = $('focus-stats');
  if (focusStats) focusStats.classList.add('hidden');

  // Destroy SVG arrow overlay (cleanup)
  destroyArrowOverlay();

  // Reset state
  state = null;

  // Clear text display and reset stats
  textEl.innerHTML = '';
  textEl.classList.add('blurred');
  const wpmEl = $('wpm');
  const accEl = $('accuracy');
  const timeEl = $('time');
  const errEl = $('errors');
  const streakEl = $('streak');
  if (wpmEl) wpmEl.textContent = '0';
  if (accEl) accEl.textContent = '100%';
  if (timeEl) timeEl.textContent = '0s';
  if (errEl) errEl.textContent = '0';
  if (streakEl) {
    streakEl.textContent = '—';
    streakEl.classList.remove('on', 'hot');
  }
}

/* ============ EVENT HANDLERS ============ */

function handleKey(e) {
  if (e.key === 'Tab' && document.querySelector('.modal-overlay')) {
    return;
  }

  // Only handle keys when in focus-mode with active state
  if (!state || !document.querySelector('.app.focus-mode')) return;
  if (e.key === 'Escape') { reset(); textEl.focus(); return; }
  if (e.key === 'Tab') { e.preventDefault(); reset(); textEl.focus(); return; }
  if (state.finished) return;
  if (document.activeElement !== textEl) return;

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (state.pos > 0) {
      state.pos--;
      state.errors[state.pos] = false;
      render();
      updateStats();
    }
    return;
  }

  let key = e.key;
  if (e.key === 'Enter') key = '\n';
  if (key.length !== 1 && key !== '\n') return;

  e.preventDefault();

  if (!state.startTime) {
    state.startTime = Date.now();
  }

  const expected = state.text[state.pos];
  const isCorrect = key === expected;

  if (isCorrect) {
    state.errors[state.pos] = false;
    sound.playCorrect();
    const result = progress.onCorrectChar(expected);
    if (result.combo) {
      sound.playCombo();
      effects.flyGift(result.streak);
      progress.awardXp(result.streak);
      effects.showBigComboText(result.streak);
      checkAchievements();
    }
  } else {
    state.errors[state.pos] = true;
    state.totalErrors++;
    sound.playWrong();
    progress.onWrongChar();
    flashActualKey(key);
  }

  flashKey(expected, isCorrect,
    isCorrect && progress.getCurrentStreak() >= 10 &&
    (progress.getCurrentStreak() === 10 || progress.getCurrentStreak() === 25 ||
     progress.getCurrentStreak() === 50 || progress.getCurrentStreak() === 100 ||
     progress.getCurrentStreak() % 50 === 0)
  );

  state.pos++;
  if (state.pos >= state.text.length) {
    state.finished = true;
    sound.playAchievement();
    finishSession();
  }

  render();
  updateStats();
  updateStreakDisplay();
  updateHeader();
  updateLayoutIndicator();
}

function checkAchievements() {
  const unlocked = progress.checkAchievements();
  unlocked.forEach(a => {
    sound.playAchievement();
    effects.showAchievementToast(a.icon, a.name, a.desc);
  });
  if (unlocked.length > 0) renderAchievements();
}

/* ============ KEYBOARD LAYOUT SELECTOR ============ */

function buildKeyboardLayoutSelector() {
  const controls = $('controls');
  if (!controls) return;

  const existing = document.getElementById('keyboard-layout-select');
  if (existing) existing.remove();

  const select = document.createElement('select');
  select.id = 'keyboard-layout-select';
  select.innerHTML = `
    <option value="pc-ansi">🖥 PC — ANSI</option>
    <option value="pc-iso">🖥 PC — ISO</option>
    <option value="mac-ansi">🍎 Mac — ANSI</option>
    <option value="mac-iso">🍎 Mac — ISO</option>
  `;
  select.value = currentKeyboardLayout;
  select.addEventListener('change', () => {
    currentKeyboardLayout = select.value;
    try { localStorage.setItem('toptip-keyboard-layout', currentKeyboardLayout); } catch {}
    const lang = modeToLang($('mode').value);
    buildKeyboard(lang);
    if (state) {
      setNextKey(state.text[state.pos]);
    }
    if (api.isLoggedIn()) {
      api.updateKeyboardLayout(currentKeyboardLayout).catch(() => {});
    }
  });

  const resetProgressBtn = document.getElementById('reset-progress');
  if (resetProgressBtn) {
    controls.insertBefore(select, resetProgressBtn);
  } else {
    controls.appendChild(select);
  }
}

/* ============ PROGRESS CALLBACKS ============ */

progress.setCallbacks({
  onLevelUp(level) {
    sound.playLevelUp();
    effects.triggerLevelUpEffect(level, progress.levelTitle(level));
    updateHeader();
    renderAchievements();
  },
  onAchievement(a) {
    sound.playAchievement();
    effects.showAchievementToast(a.icon, a.name, a.desc);
    renderAchievements();
  },
  onXpChange() {
    updateHeader();
  },
});

/* ============ AUTH CALLBACKS ============ */

setAuthChangeCallback(() => {
  renderAuthBar();
});

/* ============ AUTH EVENTS ============ */

window.addEventListener('auth-login', (e) => {
  const user = e.detail.user;

  // Reload progress from server
  progress.initFromServer(user);
  updateHeader();
  renderAchievements();

  // Apply user language & profile
  if (user.language) {
    setLanguage(user.language);
    applyLanguageToDOM();
    refreshFingerNames();
    updateHeader(); // re-render level title with new language
  }
  if (user.profile) {
    currentProfile = user.profile;
  }
  if (user.keyboardLayout) {
    currentKeyboardLayout = user.keyboardLayout;
    const layoutSelect = document.getElementById('keyboard-layout-select');
    if (layoutSelect) layoutSelect.value = currentKeyboardLayout;
  }

  // If currently in focus-mode, refresh the text
  if (document.querySelector('.app.focus-mode')) {
    reset();
    textEl.focus();
  }
});

window.addEventListener('auth-logout', () => {
  progress.resetProgress();
  currentProfile = 'general';
  updateHeader();
  renderAchievements();

  // If in focus-mode, exit to menu
  if (document.querySelector('.app.focus-mode')) {
    exitFocusMode();
  }
});

/* ============ PROFILE-CHANGED EVENT ============ */

window.addEventListener('profile-changed', (e) => {
  const { language, profile, keyboardLayout } = e.detail;

  // Apply language change
  setLanguage(language);
  applyLanguageToDOM();
  refreshFingerNames();
  updateHeader(); // re-render level title with new language

  // Update profile for text selection
  currentProfile = profile;

  // Update keyboard layout
  if (keyboardLayout) {
    currentKeyboardLayout = keyboardLayout;
    const layoutSelect = document.getElementById('keyboard-layout-select');
    if (layoutSelect) layoutSelect.value = currentKeyboardLayout;
    const lang = modeToLang($('mode').value);
    buildKeyboard(lang);
  }

  // If in focus-mode, refresh the text with new profile
  if (document.querySelector('.app.focus-mode')) {
    reset();
    textEl.focus();
  }
});

/* ============ GAME LOOP ============ */

let lastTick = 0;
function tick() {
  if (state && state.startTime && !state.finished) {
    const now = Date.now();
    if (now - lastTick > 200) {
      updateStats();
      lastTick = now;
    }
  }
  requestAnimationFrame(tick);
}

/* ============ MUTE BUTTON (in auth-bar) ============ */

function initMuteButton() {
  const bar = document.getElementById('auth-bar');
  if (!bar) return;
  // Remove old mute button if present
  const old = document.getElementById('mute-btn');
  if (old) old.remove();

  const btn = document.createElement('button');
  btn.id = 'mute-btn';
  btn.className = 'mute-btn';
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
  btn.title = sound.isMuted() ? 'Выключить звук' : 'Включить звук';
  btn.onclick = () => {
    const muted = sound.toggleMuted();
    btn.textContent = muted ? '🔇' : '🔊';
    btn.title = muted ? 'Включить звук' : 'Выключить звук';
  };
  bar.prepend(btn);
}

/* ============ INITIALIZATION ============ */

function init() {
  initMuteButton();
  buildKeyboardLayoutSelector();
  renderAuthBar();
  updateHeader();
  renderAchievements();

  // Restore layout override from localStorage
  const savedLayout = loadLayoutOverride();
  if (savedLayout) {
    currentDisplayLayout = savedLayout;
  }

  // Start button → enter focus mode
  const startBtn = $('btn-start');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      enterFocusMode();
    });
  }

  // Back button → exit focus mode
  const backBtn = $('btn-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      exitFocusMode();
    });
  }

  // Layout toggle button → switch keyboard layout
  const layoutToggle = $('layout-toggle');
  if (layoutToggle) {
    layoutToggle.addEventListener('click', () => {
      toggleKeyboardLayout();
    });
  }

  // Alt+Shift keyboard shortcut for layout switching (registered before handleKey)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && e.altKey && isMixedLanguage && document.querySelector('.app.focus-mode')) {
      e.preventDefault();
      e.stopPropagation();
      toggleKeyboardLayout();
    }
  });

  // Completion overlay: "Next Text" → reset text, stay in focus mode
  const nextTextBtn = $('btn-next-text');
  if (nextTextBtn) {
    nextTextBtn.addEventListener('click', () => {
      hideCompletionOverlay();
      reset();
      textEl.focus();
    });
  }

  // Completion overlay: "To Menu" → exit to start menu
  const toMenuBtn = $('btn-to-menu');
  if (toMenuBtn) {
    toMenuBtn.addEventListener('click', () => {
      exitFocusMode();
    });
  }

  // Text display events
  textEl.addEventListener('focus', () => textEl.classList.remove('blurred'));
  textEl.addEventListener('blur', () => {
    if (state && state.pos === 0) textEl.classList.add('blurred');
  });
  textEl.addEventListener('click', () => textEl.focus());

  // Global keyboard handler (main typing logic)
  document.addEventListener('keydown', handleKey);

  // "New Text" button in controls row
  const resetBtn = $('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (document.querySelector('.app.focus-mode')) {
        reset();
        textEl.focus();
      }
    });
  }

  // Mode / length selectors — only affect next focus session
  const modeSelect = $('mode');
  const lengthSelect = $('length');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      if (document.querySelector('.app.focus-mode')) {
        reset();
        textEl.focus();
      }
    });
  }
  if (lengthSelect) {
    lengthSelect.addEventListener('change', () => {
      if (document.querySelector('.app.focus-mode')) {
        reset();
        textEl.focus();
      }
    });
  }

  // Reset progress button
  const resetProgressBtn = $('reset-progress');
  if (resetProgressBtn) {
    resetProgressBtn.addEventListener('click', () => {
      if (confirm(t('confirm.reset_progress'))) {
        progress.resetProgress();
        updateHeader();
        renderAchievements();
      }
    });
  }

  requestAnimationFrame(tick);

  if (api.isLoggedIn()) {
    api.syncQueue();
  }
}

// Bootstrap
init();
