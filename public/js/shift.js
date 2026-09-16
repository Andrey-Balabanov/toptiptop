/**
 * Shift-key detection utilities.
 *
 * Determines whether a character requires holding Shift to type,
 * and maps shifted characters back to their base (unshifted) key.
 *
 * IMPORTANT: Some characters (e.g. `;`) are shifted on one keyboard layout
 * (RU: Shift+4) but unshifted on another (EN: semicolon key).  In those
 * cases `needsShift` returns `false` because we cannot know the user's
 * active layout — the English layout is the safest default.
 */

/**
 * Map of characters that require Shift to type, mapped to their base key.
 * Covers both English (ANSI/ISO) and Russian keyboard layouts.
 *
 * When a character appears under multiple layouts (e.g. `;` is Shift+4
 * on RU but unshifted on EN), the *last* entry wins in the object literal.
 * For `;` this means it maps to `'4'` (RU section written before Other),
 * so `baseKeyFor` returns the RU base key.
 */
const SHIFTED_TO_BASE = {
  // Uppercase English
  'A':'a','B':'b','C':'c','D':'d','E':'e','F':'f','G':'g',
  'H':'h','I':'i','J':'j','K':'k','L':'l','M':'m','N':'n',
  'O':'o','P':'p','Q':'q','R':'r','S':'s','T':'t','U':'u',
  'V':'v','W':'w','X':'x','Y':'y','Z':'z',
  // Uppercase Russian (Ё handled below as dedicated key)
  'А':'а','Б':'б','В':'в','Г':'г','Д':'д','Е':'е',
  'Ж':'ж','З':'з','И':'и','Й':'й','К':'к','Л':'л','М':'м',
  'Н':'н','О':'о','П':'п','Р':'р','С':'с','Т':'т','У':'у',
  'Ф':'ф','Х':'х','Ц':'ц','Ч':'ч','Ш':'ш','Щ':'щ','Ъ':'ъ',
  'Ы':'ы','Ь':'ь','Э':'э','Ю':'ю','Я':'я',
  // Number row symbols (EN)
  '!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7',
  '*':'8','(':'9',')':'0',
  // Number row symbols (RU)
  '"':'2','№':'3',';':'4',':':'6','?':'7',
  // Other symbols (EN base keys take priority — written last)
  '_':'-','+':'=','{':'[','}':']','|':'\\',
  ':':';','"':"'",'<':',','>':'.','?':'/',
};

/**
 * Set of characters that ALWAYS require Shift to type, regardless of
 * keyboard layout.  Used by `needsShift` to avoid false-positives for
 * characters like `;` (unshifted on EN, shifted on RU).
 *
 * This deliberately excludes characters that are shifted on some layouts
 * but unshifted on others (e.g. `;`).
 */
const ALWAYS_NEEDS_SHIFT = new Set([
  // Number row symbols (EN)
  '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
  // Punctuation symbols that are ALWAYS shifted on both EN and RU layouts
  '_', '+', '{', '}', '|', ':', '"', '<', '>', '?',
  // Number row symbols (RU) — only exist as shifted characters
  '№',
]);

/**
 * Check if a character requires holding Shift to type it.
 *
 * NOTE: Ё and ё are separate dedicated keys on the Russian keyboard
 * layout (to the left of «1»), so they do NOT require Shift — unlike
 * all other uppercase Cyrillic letters.
 *
 * Characters that are shifted on some layouts but not others (e.g. `;`)
 * are considered NOT needing Shift (English layout default).
 *
 * @param {string} ch - The character to check (single character string)
 * @returns {boolean} true if the character needs Shift
 *
 * @example
 * needsShift('A')  // true (uppercase letter)
 * needsShift('!')  // true (shift+1)
 * needsShift('a')  // false
 * needsShift('1')  // false
 * needsShift('Ё')  // false (dedicated key on RU layout)
 * needsShift('ё')  // false
 * needsShift(';')  // false (unshifted on EN layout)
 * needsShift(' ')  // false
 * needsShift('')   // false
 */
function needsShift(ch) {
  if (!ch || typeof ch !== 'string' || ch.length !== 1) return false;
  // Ё and ё are separate dedicated keys on the Russian layout — no Shift needed
  if (ch === 'Ё' || ch === 'ё') return false;
  // Uppercase letters need Shift (both Latin and Cyrillic)
  if (ch !== ch.toLowerCase() && /[A-Za-zА-Яа-яЁё]/.test(ch)) return true;
  // Symbols that always need Shift (regardless of keyboard layout)
  return ALWAYS_NEEDS_SHIFT.has(ch);
}

/**
 * Get the base (unshifted) key for a character that needs Shift.
 * E.g., for 'A' returns 'a', for '!' returns '1'.
 * If the character does not need Shift, returns the character itself.
 *
 * NOTE: `baseKeyFor` uses the full `SHIFTED_TO_BASE` map which includes
 * characters that are layout-dependent (e.g. `;` maps to `'4'` for RU).
 * This is useful for keyboard-mapping purposes even when `needsShift`
 * reports `false` for the same character.
 *
 * @param {string} ch - The potentially-shifted character
 * @returns {string} The base key on the keyboard
 *
 * @example
 * baseKeyFor('A')  // 'a'
 * baseKeyFor('!')  // '1'
 * baseKeyFor('a')  // 'a' (no shift needed)
 * baseKeyFor('1')  // '1'
 * baseKeyFor(' ')  // ' '
 * baseKeyFor('Ё')  // 'ё'
 */
function baseKeyFor(ch) {
  if (!ch || typeof ch !== 'string' || ch.length !== 1) return ch;
  // Uppercase → lowercase for letters (including Ё→ё via toLowerCase)
  if (ch !== ch.toLowerCase() && /[A-Za-zА-Яа-яЁё]/.test(ch)) return ch.toLowerCase();
  // Look up in symbol map
  return SHIFTED_TO_BASE[ch] || ch;
}

export { SHIFTED_TO_BASE, ALWAYS_NEEDS_SHIFT, needsShift, baseKeyFor };
