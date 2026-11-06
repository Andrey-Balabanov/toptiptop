/* Physical geometry of the on-screen keyboard.
 *
 * The letter rows (layout data in keyboard.js) only say WHICH characters sit
 * in each row. On a real keyboard every row also starts at a different
 * horizontal offset because of the modifier keys on its left edge
 * (` / Tab / Caps Lock / Shift), so e.g. the bottom-row И / B sits half a key
 * to the right of П / G, exactly between the two index fingers' home keys.
 *
 * keyboardFrame() wraps the letter rows with those modifier keys, giving each
 * key its width in key units (u). Every row adds up to the same total:
 *   PC (Windows)  — 15u   (Backspace 2u, ANSI \ 1.5u, Enter 2.25u, R-Shift 2.75u)
 *   Mac (MacBook) — 14.5u (delete 1.5u, ANSI \ 1u, return 1.75u, R-shift 2.25u)
 * ANSI has a long left Shift (2.25u) and a one-row Enter; ISO has a short left
 * Shift (1.25u) with an extra key next to it, an extra key left of Enter and
 * a tall, two-row Enter. The bottom row is Ctrl/Win/Alt on a PC and
 * fn/control/option/command plus the arrow cluster on a MacBook.
 *
 * Pure data, no DOM — rendering lives in keyboard.js.
 */

/** Modifier labels: a symbol (always shown) and a word (shown on wide screens). */
const PC_LABELS = {
  backspace: { sym: '⌫', word: 'Backspace' },
  tab: { sym: '⇥', word: 'Tab' },
  caps: { sym: '⇪', word: 'Caps Lock' },
  enter: { sym: '↵', word: 'Enter' },
  shift: { sym: '⇧', word: 'Shift' },
  ctrl: { sym: '', word: 'Ctrl' },
  win: { sym: '⊞', word: '' },
  alt: { sym: '', word: 'Alt' },
  menu: { sym: '☰', word: '' },
};

const MAC_LABELS = {
  backspace: { sym: '⌫', word: 'delete' },
  tab: { sym: '⇥', word: 'tab' },
  caps: { sym: '⇪', word: 'caps lock' },
  enter: { sym: '↩', word: 'return' },
  shift: { sym: '⇧', word: 'shift' },
  fn: { sym: '', word: 'fn' },
  control: { sym: '⌃', word: 'control' },
  option: { sym: '⌥', word: 'option' },
  command: { sym: '⌘', word: 'command' },
};

/** Which hand's pinky reaches each edge modifier (for its finger-zone colour). */
const MOD_FINGER = { tab: 'lp', caps: 'lp', backspace: 'rp', enter: 'rp' };

/** Key left of 1 (when the layout data starts the number row at 1). */
const TOP_LEFT = { ru: 'ё', en: '`', code: '`', de: '^', es: 'º' };
/** ISO: the extra key left of Enter on the home row. */
const ISO_HOME_EXTRA = { ru: '\\', en: '#', code: '#' };
/** ISO: the extra key right of the short left Shift, if the data lacks it. */
const ISO_SHIFT_EXTRA = '<';
/** macOS «Русская»: top-left key (ANSI ` / ISO §) and the ISO key by left Shift. */
const MAC_RU_TOP_LEFT = { ansi: ']', iso: '>' };
const MAC_RU_ISO_SHIFT_EXTRA = ']';

/** Total width of every row, in key units. */
export function boardUnits(layoutId) {
  return String(layoutId).startsWith('mac') ? 14.5 : 15;
}

const round = x => Math.round(x * 100) / 100;
const sum = row => row.reduce((s, k) => s + k.u, 0);

/**
 * Lay out the whole keyboard like the physical one.
 *
 * @param {string} layoutId - 'pc-ansi' | 'pc-iso' | 'mac-ansi' | 'mac-iso'
 * @param {string} lang - keyboard language (picks labels of decorative keys)
 * @param {string[][]} rows - 4 character rows: numbers, top, home, bottom
 * @returns {Array<Array<object>>} 5 rows of key specs, each with `u` (width):
 *   { kind: 'char', char, col }       — a key from `rows` (col = index in its data row)
 *   { kind: 'deco', label }           — a real key the layout data doesn't list
 *   { kind: 'mod', name, sym, word, finger?, part? } — modifier (part: 'top'|'bottom' of ISO Enter)
 *   { kind: 'shift', side, sym, word, finger }
 *   { kind: 'space' }
 *   { kind: 'arrows' }                — MacBook arrow cluster (← ↑↓ →)
 */
export function keyboardFrame(layoutId, lang, rows) {
  const id = String(layoutId || 'pc-ansi');
  const mac = id.startsWith('mac');
  const iso = id.endsWith('iso');
  const total = boardUnits(id);
  const labels = mac ? MAC_LABELS : PC_LABELS;

  const chars = (row, from = 0, to = row.length) =>
    row.slice(from, to).map((c, i) => ({ kind: 'char', char: c, col: from + i, u: 1 }));
  const deco = label => ({ kind: 'deco', label, u: 1 });
  const mod = (name, u, extra = {}) => ({
    kind: 'mod', name, u, ...labels[name], ...(MOD_FINGER[name] ? { finger: MOD_FINGER[name] } : {}), ...extra,
  });
  const shift = (side, u) => ({ kind: 'shift', side, u, ...labels.shift, finger: side === 'left' ? 'lp' : 'rp' });
  /** Width that brings `row` up to the full board width (never under 0.5u). */
  const rest = row => Math.max(0.5, round(total - sum(row)));

  const [numbers = [], top = [], home = [], bottom = []] = rows || [];

  // Number row: [` / ё / §] 1 … = [Backspace]
  const r0 = [];
  if (numbers[0] === '1') {
    const topLeft = mac && lang === 'ru' ? MAC_RU_TOP_LEFT[iso ? 'iso' : 'ansi']
      : mac && iso && (lang === 'en' || lang === 'code') ? '§' : (TOP_LEFT[lang] || '`');
    r0.push(deco(topLeft));
  }
  r0.push(...chars(numbers));
  r0.push(mod('backspace', rest(r0)));

  // Top row: [Tab] Q … ] then ANSI "\" (wide) or the top of the ISO Enter
  const r1 = [mod('tab', 1.5)];
  if (iso) {
    r1.push(...chars(top));
    r1.push(mod('enter', rest(r1), { part: 'top' }));
  } else if (top.length > 12) {
    r1.push(...chars(top, 0, top.length - 1));
    const last = chars(top, top.length - 1)[0];
    last.u = rest(r1);
    r1.push(last);
  } else {
    r1.push(...chars(top));
    const bs = deco('\\');
    bs.u = rest(r1);
    r1.push(bs);
  }

  // Home row: [Caps Lock] A … ' [ISO extra] [Enter]
  const r2 = [mod('caps', 1.75), ...chars(home)];
  if (iso && home.length === 11) r2.push(deco(ISO_HOME_EXTRA[lang] || '\\'));
  r2.push(mod('enter', rest(r2), iso ? { part: 'bottom', sym: '', word: '' } : {}));

  // Bottom row: ANSI [Shift 2.25] Z … /   ISO [Shift 1.25] [extra] Z … /
  const r3 = [shift('left', iso ? 1.25 : 2.25)];
  if (iso && bottom.length < 11) r3.push(deco(mac && lang === 'ru' ? MAC_RU_ISO_SHIFT_EXTRA : ISO_SHIFT_EXTRA));
  r3.push(...chars(bottom));
  r3.push(shift('right', rest(r3)));

  // Space row
  const r4 = mac
    ? [mod('fn', 1), mod('control', 1), mod('option', 1), mod('command', 1.25),
       { kind: 'space', u: 5 },
       mod('command', 1.25), mod('option', 1), { kind: 'arrows', u: 3 }]
    : [mod('ctrl', 1.25), mod('win', 1.25), mod('alt', 1.25),
       { kind: 'space', u: 6.25 },
       mod('alt', 1.25), mod('win', 1.25), mod('menu', 1.25), mod('ctrl', 1.25)];

  return [r0, r1, r2, r3, r4];
}
