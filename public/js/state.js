/* Finger map and game state */

import { t } from './i18n.js';

/**
 * Finger name i18n keys.
 */
const FINGER_KEYS = {
  lp: 'finger.lp', lr: 'finger.lr', lm: 'finger.lm', li: 'finger.li',
  tt: 'finger.tt',
  ri: 'finger.ri', rm: 'finger.rm', rr: 'finger.rr', rp: 'finger.rp',
};

/** Get translated finger name by finger ID */
export function getFingerName(fingerId) {
  const key = FINGER_KEYS[fingerId];
  return key ? t(key) : fingerId;
}

/** Get short label (last word of translated finger name) for hand UI */
export function getFingerShortLabel(fingerId) {
  return getFingerName(fingerId).split(' ').pop();
}

// Keep FINGER_NAMES for backward compatibility (used by main.js for hint text)
const FINGER_NAMES = {};
for (const [id, key] of Object.entries(FINGER_KEYS)) {
  FINGER_NAMES[id] = t(key);
}

/**
 * Refresh FINGER_NAMES after language change.
 * Called from main.js on auth-login and profile-changed events.
 * Re-populates the static map with current translations.
 */
export function refreshFingerNames() {
  for (const [id, key] of Object.entries(FINGER_KEYS)) {
    FINGER_NAMES[id] = t(key);
  }
}

const KEY_TO_FINGER = {
  '`':'lp','1':'lp','q':'lp','a':'lp','z':'lp',
  '2':'lr','w':'lr','s':'lr','x':'lr',
  '3':'lm','e':'lm','d':'lm','c':'lm',
  '4':'li','5':'li','r':'li','t':'li','f':'li','g':'li','v':'li','b':'li',
  '6':'ri','7':'ri','y':'ri','u':'ri','h':'ri','j':'ri','n':'ri','m':'ri',
  '8':'rm','i':'rm','k':'rm',',':'rm',
  '9':'rr','o':'rr','l':'rr','.':'rr',
  '0':'rp','-':'rp','=':'rp','p':'rp','[':'rp',']':'rp','\\':'rp',
  ';':'rp','\'':'rp','/':'rp',
  'й':'lp','ф':'lp','я':'lp','ё':'lp',
  'ц':'lr','ы':'lr','ч':'lr',
  'у':'lm','в':'lm','с':'lm',
  'к':'li','е':'li','а':'li','п':'li','м':'li','и':'li',
  'н':'ri','г':'ri','р':'ri','о':'ri','т':'ri','ь':'ri',
  'ш':'rm','л':'rm','б':'rm',
  'щ':'rr','д':'rr','ю':'rr',
  'з':'rp','х':'rp','ъ':'rp','ж':'rp','э':'rp',
  ' ':'tt', '\n':'rp',
};

function fingerFor(ch) {
  if (ch == null) return null;
  if (ch === ' ') return 'tt';
  if (ch === '\n' || ch === '\t') return 'rp';
  return KEY_TO_FINGER[ch.toLowerCase()] || null;
}

/**
 * Return the home-row key for a given finger (for movement visualization).
 */
function homeKeyForFinger(finger) {
  const homes = {
    lp: { ru: 'ф', en: 'a' },
    lr: { ru: 'ы', en: 's' },
    lm: { ru: 'в', en: 'd' },
    li: { ru: 'а', en: 'f' },
    ri: { ru: 'о', en: 'j' },
    rm: { ru: 'л', en: 'k' },
    rr: { ru: 'д', en: 'l' },
    rp: { ru: 'ж', en: ';' },
  };
  return homes[finger] || null;
}

/**
 * Fingers that have a home-row key (thumb excluded).
 */
const HOME_FINGERS = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];

/**
 * Map of home-row keys for a given keyboard layout.
 * 'code' mode falls back to the EN layout.
 * Note: for the right pinky the home key is ';' (EN) / 'ж' (RU) —
 * the adjacent ''' / 'э' keys are NOT home keys and are excluded.
 *
 * @param {string} lang - 'ru' | 'en' | 'code'
 * @returns {{ lp: string, lr: string, lm: string, li: string,
 *             ri: string, rm: string, rr: string, rp: string }}
 */
export function homeKeyForLayout(lang) {
  const layout = (lang === 'en' || lang === 'code') ? 'en' : 'ru';
  const map = {};
  for (const f of HOME_FINGERS) {
    const home = homeKeyForFinger(f);
    if (home) map[f] = home[layout] || home.en;
  }
  return map;
}

/**
 * Default keyboard rows (ANSI) fallback — used when no explicit rows are passed.
 * Includes the number row so fingerMovement can properly locate digit keys.
 */
const KB_ROWS_RU_DEFAULT = [
  ['1','2','3','4','5','6','7','8','9','0','-','='],
  ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
  ['ф','ы','в','а','п','р','о','л','д','ж','э'],
  ['я','ч','с','м','и','т','ь','б','ю','.'],
];

const KB_ROWS_EN_DEFAULT = [
  ['1','2','3','4','5','6','7','8','9','0','-','='],
  ['q','w','e','r','t','y','u','i','o','p','[',']','\\'],
  ['a','s','d','f','g','h','j','k','l',';','\''],
  ['z','x','c','v','b','n','m',',','.','/'],
];

/**
 * Estimate movement distance (in keyboard rows) from home position to target char.
 * @param {string} ch - Target character
 * @param {string} lang - Language ('ru', 'en', 'code')
 * @param {string[][]} [rows] - Optional keyboard row definition (for accurate ISO/ANSI column positions). If omitted, uses default ANSI rows.
 * @returns {{ rowDiff, colDiff, homePos, targetPos } | null}
 */
function fingerMovement(ch, lang, rows) {
  if (ch == null || ch === ' ' || ch === '\n') return null;
  const f = fingerFor(ch);
  if (!f || f === 'tt') return null;

  const home = homeKeyForFinger(f);
  if (!home) return null;

  const layout = (lang === 'en' || lang === 'code') ? 'en' : 'ru';
  const homeKey = home[layout] || home.en;
  const target = ch.toLowerCase();

  // Use provided rows (from actual rendered keyboard) or fallback to defaults
  const kbLayout = rows || ((layout === 'en') ? KB_ROWS_EN_DEFAULT : KB_ROWS_RU_DEFAULT);

  let homePos = null;
  let targetPos = null;

  for (let row = 0; row < kbLayout.length; row++) {
    for (let col = 0; col < kbLayout[row].length; col++) {
      if (kbLayout[row][col] === homeKey) homePos = { row, col };
      if (kbLayout[row][col] === target) targetPos = { row, col };
    }
  }

  if (!homePos || !targetPos) return null;

  return {
    rowDiff: targetPos.row - homePos.row,
    colDiff: targetPos.col - homePos.col,
    homePos,
    targetPos,
  };
}

/* Game session state */
function createState(text) {
  return {
    text,
    pos: 0,
    errors: [],
    totalErrors: 0,
    startTime: null,
    finished: false,
  };
}

export {
  FINGER_NAMES, FINGER_KEYS, KEY_TO_FINGER, fingerFor,
  homeKeyForFinger, HOME_FINGERS, fingerMovement,
  KB_ROWS_RU_DEFAULT, KB_ROWS_EN_DEFAULT,
  createState,
};
