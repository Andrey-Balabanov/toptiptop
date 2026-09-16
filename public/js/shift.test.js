/**
 * Unit tests for shift.js — Shift-key detection utilities.
 *
 * Tests the exported functions:
 *   - needsShift(ch)   — whether a character requires the Shift key
 *   - baseKeyFor(ch)   — maps a shifted character to its unshifted base key
 */
import { needsShift, baseKeyFor } from './shift.js';

/* ==========================================================================
 *  needsShift()
 * ========================================================================== */

describe('needsShift()', () => {
  // ── Characters that DO need Shift ──

  describe('detects uppercase English letters', () => {
    test('all uppercase A-Z return true', () => {
      expect(needsShift('A')).toBe(true);
      expect(needsShift('Z')).toBe(true);
      expect(needsShift('M')).toBe(true);
    });

    test('all lowercase a-z return false', () => {
      expect(needsShift('a')).toBe(false);
      expect(needsShift('z')).toBe(false);
      expect(needsShift('m')).toBe(false);
    });
  });

  describe('detects uppercase Russian letters', () => {
    test('А-Я except Ё return true', () => {
      expect(needsShift('А')).toBe(true);
      expect(needsShift('Я')).toBe(true);
      expect(needsShift('Ж')).toBe(true);
    });

    test('Ё returns false — dedicated key on RU layout', () => {
      expect(needsShift('Ё')).toBe(false);
    });

    test('lowercase а-я and ё return false', () => {
      expect(needsShift('а')).toBe(false);
      expect(needsShift('я')).toBe(false);
      expect(needsShift('ё')).toBe(false);
    });
  });

  describe('detects number-row symbols (EN)', () => {
    const symbols = [
      ['!', '1'], ['@', '2'], ['#', '3'], ['$', '4'],
      ['%', '5'], ['^', '6'], ['&', '7'], ['*', '8'],
      ['(', '9'], [')', '0'],
    ];
    symbols.forEach(([sym]) => {
      test(`Shift+${sym} is detected`, () => {
        expect(needsShift(sym)).toBe(true);
      });
    });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach(d => {
      test(`digit ${d} returns false`, () => {
        expect(needsShift(d)).toBe(false);
      });
    });
  });

  describe('detects punctuation symbols needing Shift', () => {
    // NOTE: ';' is excluded from this list because on a Russian keyboard
    // layout, ';' is Shift+4, so needsShift(';') correctly returns true.
    // See "detects Russian number-row symbols" below.
    const cases = [
      ['_', '-'], ['+', '='], ['{', '['], ['}', ']'],
      ['|', '\\'], ['<', ','],
      ['>', '.'], ['"', "'"], ['?', '/'],
    ];
    cases.forEach(([sym, base]) => {
      test(`shifted ${sym} is detected`, () => {
        expect(needsShift(sym)).toBe(true);
      });
      test(`unshifted ${base} returns false`, () => {
        expect(needsShift(base)).toBe(false);
      });
    });
  });

  describe('detects Russian number-row symbols', () => {
    test('" (RU shift+2) returns true', () => {
      expect(needsShift('"')).toBe(true);
    });
    test('№ (RU shift+3) returns true', () => {
      expect(needsShift('№')).toBe(true);
    });
    test('; (RU shift+4) returns true', () => {
      expect(needsShift(';')).toBe(true);
    });
    test(': (RU shift+6) returns true', () => {
      expect(needsShift(':')).toBe(true);
    });
    test('? (RU shift+7) returns true', () => {
      expect(needsShift('?')).toBe(true);
    });
  });

  // ── Characters that DO NOT need Shift ──

  test('space returns false', () => {
    expect(needsShift(' ')).toBe(false);
  });

  test('newline returns false', () => {
    expect(needsShift('\n')).toBe(false);
  });

  test('tab returns false', () => {
    expect(needsShift('\t')).toBe(false);
  });

  // ── Edge cases ──

  describe('handles invalid / edge inputs gracefully', () => {
    test('empty string returns false', () => {
      expect(needsShift('')).toBe(false);
    });

    test('null returns false', () => {
      expect(needsShift(null)).toBe(false);
    });

    test('undefined returns false', () => {
      expect(needsShift(undefined)).toBe(false);
    });

    test('multi-character string returns false', () => {
      expect(needsShift('Ab')).toBe(false);
      expect(needsShift('!!')).toBe(false);
    });

    test('number returns false', () => {
      expect(needsShift(42)).toBe(false);
    });

    test('object returns false', () => {
      expect(needsShift({})).toBe(false);
    });

    test('array returns false', () => {
      expect(needsShift([])).toBe(false);
    });
  });
});

/* ==========================================================================
 *  baseKeyFor()
 * ========================================================================== */

describe('baseKeyFor()', () => {
  // ── Shifted → unshifted mapping ──

  describe('maps uppercase English to lowercase', () => {
    test('A → a', () => { expect(baseKeyFor('A')).toBe('a'); });
    test('Z → z', () => { expect(baseKeyFor('Z')).toBe('z'); });
    test('H → h', () => { expect(baseKeyFor('H')).toBe('h'); });
  });

  describe('maps uppercase Russian to lowercase', () => {
    test('А → а', () => { expect(baseKeyFor('А')).toBe('а'); });
    test('Я → я', () => { expect(baseKeyFor('Я')).toBe('я'); });
    test('Ё → ё', () => { expect(baseKeyFor('Ё')).toBe('ё'); });
    test('Ж → ж', () => { expect(baseKeyFor('Ж')).toBe('ж'); });
  });

  describe('maps number-row symbols to their digit', () => {
    const cases = [
      ['!', '1'], ['@', '2'], ['#', '3'], ['$', '4'],
      ['%', '5'], ['^', '6'], ['&', '7'], ['*', '8'],
      ['(', '9'], [')', '0'],
    ];
    cases.forEach(([sym, digit]) => {
      test(`${sym} → ${digit}`, () => {
        expect(baseKeyFor(sym)).toBe(digit);
      });
    });
  });

  describe('maps punctuation symbols to base key', () => {
    const cases = [
      ['_', '-'], ['+', '='], ['{', '['], ['}', ']'],
      ['|', '\\'], ['<', ','],
      ['>', '.'], ['"', "'"], ['?', '/'],
    ];
    cases.forEach(([sym, base]) => {
      test(`${sym} → ${base}`, () => {
        expect(baseKeyFor(sym)).toBe(base);
      });
    });
  });

  describe('maps Russian number-row symbols', () => {
    // Note: SHIFTED_TO_BASE has key collisions between RU and Other sections.
    // The "Other symbols" section comes last, so for duplicate keys it wins:
    //   '"' → "'"  (not '2'),  ':' → ';' (not '6'),  '?' → '/' (not '7')
    // Only ';' and '№' are unique to the RU section.
    test('№ → 3', () => { expect(baseKeyFor('№')).toBe('3'); });
    test('; → 4 (RU layout)', () => { expect(baseKeyFor(';')).toBe('4'); });
  });

  // ── Characters that don't need Shift ──

  describe('returns same char for unshifted characters', () => {
    test('lowercase a → a', () => { expect(baseKeyFor('a')).toBe('a'); });
    test('digit 5 → 5', () => { expect(baseKeyFor('5')).toBe('5'); });
    test('dash - → -', () => { expect(baseKeyFor('-')).toBe('-'); });
    test('equals = → =', () => { expect(baseKeyFor('=')).toBe('='); });
    test('dot . → .', () => { expect(baseKeyFor('.')).toBe('.'); });
    test('space → space', () => { expect(baseKeyFor(' ')).toBe(' '); });
  });

  // ── Edge cases ──

  describe('handles invalid / edge inputs gracefully', () => {
    test('empty string returns empty string', () => {
      expect(baseKeyFor('')).toBe('');
    });

    test('null returns null', () => {
      expect(baseKeyFor(null)).toBe(null);
    });

    test('undefined returns undefined', () => {
      expect(baseKeyFor(undefined)).toBe(undefined);
    });

    test('multi-character string passes through', () => {
      expect(baseKeyFor('Hello')).toBe('Hello');
    });
  });
});
