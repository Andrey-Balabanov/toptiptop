/**
 * Unit tests for state.js — Finger mapping, keyboard layout, game state.
 *
 * Tests cover:
 *   - refreshFingerNames() – Bug 1: must exist, be exported, and refresh FINGER_NAMES
 *   - getFingerName() / getFingerShortLabel()
 *   - fingerFor() – character → finger ID mapping
 *   - homeKeyForFinger()
 *   - fingerMovement() – home-row distance estimation
 *   - createState() – game session state factory
 *   - KEY_TO_FINGER, KB_ROWS_*_DEFAULT data integrity
 */

/* ===================================================================
 *  MOCKS
 * =================================================================== */

let mockLang = 'ru';
const mockDict = {
  ru: {
    'finger.lp': 'Лев. мизинец',
    'finger.lr': 'Лев. безым.',
    'finger.lm': 'Лев. средний',
    'finger.li': 'Лев. указат.',
    'finger.tt': 'Большой',
    'finger.ri': 'Пр. указат.',
    'finger.rm': 'Пр. средний',
    'finger.rr': 'Пр. безым.',
    'finger.rp': 'Пр. мизинец',
  },
  en: {
    'finger.lp': 'Left pinky',
    'finger.lr': 'Left ring',
    'finger.lm': 'Left middle',
    'finger.li': 'Left index',
    'finger.tt': 'Thumb',
    'finger.ri': 'Right index',
    'finger.rm': 'Right middle',
    'finger.rr': 'Right ring',
    'finger.rp': 'Right pinky',
  },
};

jest.mock('./i18n.js', () => {
  const actual = jest.requireActual('./i18n.js');
  return {
    ...actual,
    t: jest.fn((key) => {
      const dict = mockDict[mockLang] || mockDict.ru;
      return dict[key] || key;
    }),
  };
});

/* ===================================================================
 *  IMPORTS
 * =================================================================== */

import {
  FINGER_NAMES, FINGER_KEYS, KEY_TO_FINGER,
  fingerFor, homeKeyForFinger, fingerMovement,
  KB_ROWS_RU_DEFAULT, KB_ROWS_EN_DEFAULT,
  createState, getFingerName, getFingerShortLabel,
  refreshFingerNames,
} from './state.js';

import { t } from './i18n.js';

/* ===================================================================
 *  TESTS
 * =================================================================== */

describe('state.js', () => {
  beforeEach(() => {
    mockLang = 'ru';
  });

  /* ============================
   *  refreshFingerNames() — Bug 1
   * ============================ */
  describe('refreshFingerNames()', () => {
    test('is defined and is a function', () => {
      expect(refreshFingerNames).toBeDefined();
      expect(typeof refreshFingerNames).toBe('function');
    });

    test('can be called without error (initial RU state)', () => {
      expect(() => refreshFingerNames()).not.toThrow();
    });

    test('refreshes FINGER_NAMES when language changes (RU → EN)', () => {
      // Start with RU
      mockLang = 'ru';
      refreshFingerNames();
      expect(FINGER_NAMES.lp).toBe('Лев. мизинец');
      expect(FINGER_NAMES.rp).toBe('Пр. мизинец');
      expect(FINGER_NAMES.tt).toBe('Большой');

      // Switch to EN
      mockLang = 'en';
      refreshFingerNames();
      expect(FINGER_NAMES.lp).toBe('Left pinky');
      expect(FINGER_NAMES.rp).toBe('Right pinky');
      expect(FINGER_NAMES.tt).toBe('Thumb');
    });

    test('calls t() for each finger key', () => {
      (t).mockClear();
      mockLang = 'ru';
      refreshFingerNames();
      // Should call t() for each of the 9 fingers
      expect(t).toHaveBeenCalled();
      const fingerKeys = Object.values(FINGER_KEYS);
      fingerKeys.forEach(key => {
        expect(t).toHaveBeenCalledWith(key);
      });
    });
  });

  /* ============================
   *  getFingerName()
   * ============================ */
  describe('getFingerName()', () => {
    test('returns translated name for known finger IDs (RU)', () => {
      mockLang = 'ru';
      expect(getFingerName('lp')).toBe('Лев. мизинец');
      expect(getFingerName('rp')).toBe('Пр. мизинец');
      expect(getFingerName('tt')).toBe('Большой');
    });

    test('returns translated name for known finger IDs (EN)', () => {
      mockLang = 'en';
      expect(getFingerName('li')).toBe('Left index');
      expect(getFingerName('ri')).toBe('Right index');
      expect(getFingerName('tt')).toBe('Thumb');
    });

    test('returns fingerId as-is for unknown finger IDs', () => {
      expect(getFingerName('unknown')).toBe('unknown');
      expect(getFingerName('abc')).toBe('abc');
    });
  });

  /* ============================
   *  getFingerShortLabel()
   * ============================ */
  describe('getFingerShortLabel()', () => {
    test('returns last word of translated name (RU)', () => {
      mockLang = 'ru';
      expect(getFingerShortLabel('lp')).toBe('мизинец');
      expect(getFingerShortLabel('lr')).toBe('безым.');
      expect(getFingerShortLabel('tt')).toBe('Большой');
    });

    test('returns last word of translated name (EN)', () => {
      mockLang = 'en';
      expect(getFingerShortLabel('ri')).toBe('index');
      expect(getFingerShortLabel('rr')).toBe('ring');
      expect(getFingerShortLabel('rp')).toBe('pinky');
    });

    test('returns fingerId for unknown IDs', () => {
      expect(getFingerShortLabel('xyz')).toBe('xyz');
    });
  });

  /* ============================
   *  fingerFor()
   * ============================ */
  describe('fingerFor()', () => {
    describe('EN letters', () => {
      test('a → lp (left pinky)', () => {
        expect(fingerFor('a')).toBe('lp');
      });
      test('q → lp', () => {
        expect(fingerFor('q')).toBe('lp');
      });
      test('f → li (left index)', () => {
        expect(fingerFor('f')).toBe('li');
      });
      test('j → ri (right index)', () => {
        expect(fingerFor('j')).toBe('ri');
      });
      test('; → rp (right pinky)', () => {
        expect(fingerFor(';')).toBe('rp');
      });
    });

    describe('RU letters', () => {
      test('ф → lp', () => {
        expect(fingerFor('ф')).toBe('lp');
      });
      test('а → li', () => {
        expect(fingerFor('а')).toBe('li');
      });
      test('о → ri', () => {
        expect(fingerFor('о')).toBe('ri');
      });
      test('ж → rp', () => {
        expect(fingerFor('ж')).toBe('rp');
      });
    });

    describe('specials', () => {
      test('space → tt (thumb)', () => {
        expect(fingerFor(' ')).toBe('tt');
      });
      test('newline → rp', () => {
        expect(fingerFor('\n')).toBe('rp');
      });
      test('tab → rp', () => {
        expect(fingerFor('\t')).toBe('rp');
      });
    });

    describe('digits and symbols', () => {
      test('1 → lp', () => expect(fingerFor('1')).toBe('lp'));
      test('5 → li', () => expect(fingerFor('5')).toBe('li'));
      test('6 → ri', () => expect(fingerFor('6')).toBe('ri'));
      test('0 → rp', () => expect(fingerFor('0')).toBe('rp'));
      test('= → rp', () => expect(fingerFor('=')).toBe('rp'));
    });

    describe('edge cases', () => {
      test('null returns null', () => {
        expect(fingerFor(null)).toBeNull();
      });
      test('undefined returns null', () => {
        expect(fingerFor(undefined)).toBeNull();
      });
      test('unknown char returns null', () => {
        expect(fingerFor('±')).toBeNull();
      });
      test('uppercase returns same as lowercase', () => {
        expect(fingerFor('A')).toBe(fingerFor('a'));
        expect(fingerFor('Ф')).toBe(fingerFor('ф'));
      });
    });
  });

  /* ============================
   *  homeKeyForFinger()
   * ============================ */
  describe('homeKeyForFinger()', () => {
    test('returns correct home keys for all fingers', () => {
      expect(homeKeyForFinger('lp')).toEqual({ ru: 'ф', en: 'a' });
      expect(homeKeyForFinger('lr')).toEqual({ ru: 'ы', en: 's' });
      expect(homeKeyForFinger('lm')).toEqual({ ru: 'в', en: 'd' });
      expect(homeKeyForFinger('li')).toEqual({ ru: 'а', en: 'f' });
      expect(homeKeyForFinger('ri')).toEqual({ ru: 'о', en: 'j' });
      expect(homeKeyForFinger('rm')).toEqual({ ru: 'л', en: 'k' });
      expect(homeKeyForFinger('rr')).toEqual({ ru: 'д', en: 'l' });
      expect(homeKeyForFinger('rp')).toEqual({ ru: 'ж', en: ';' });
    });

    test('returns null for thumb', () => {
      expect(homeKeyForFinger('tt')).toBeNull();
    });

    test('returns null for unknown finger', () => {
      expect(homeKeyForFinger('xyz')).toBeNull();
    });
  });

  /* ============================
   *  fingerMovement()
   * ============================ */
  describe('fingerMovement()', () => {
    test('returns null for space', () => {
      expect(fingerMovement(' ', 'en')).toBeNull();
    });

    test('returns null for newline', () => {
      expect(fingerMovement('\n', 'en')).toBeNull();
    });

    test('returns null for null/undefined', () => {
      expect(fingerMovement(null, 'en')).toBeNull();
      expect(fingerMovement(undefined, 'en')).toBeNull();
    });

    test('returns movement data for a reachable key (EN)', () => {
      // 'q' is on row 1 (top), left pinky home ('a') is on row 2
      const result = fingerMovement('q', 'en');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('rowDiff');
      expect(result).toHaveProperty('colDiff');
      expect(result).toHaveProperty('homePos');
      expect(result).toHaveProperty('targetPos');
      // q is above a: rowDiff should be -1
      expect(result.rowDiff).toBe(-1);
    });

    test('returns movement for RU keys', () => {
      // 'й' is on row 1 (top), left pinky home ('ф') is on row 2
      const result = fingerMovement('й', 'ru');
      expect(result).not.toBeNull();
      expect(result.rowDiff).toBe(-1);
    });

    test('returns movement for digit keys', () => {
      // '1' is on row 0 (number row), left pinky home ('a') is on row 2
      const result = fingerMovement('1', 'en');
      expect(result).not.toBeNull();
      expect(result.rowDiff).toBe(-2);
    });

    test('returns null for thumb finger (space-like) handled earlier', () => {
      expect(fingerMovement(' ', 'en')).toBeNull();
    });

    test('uses provided custom keyboard rows', () => {
      const customRows = [
        ['1','2'],
        ['q','w'],
        ['a','s'],
        ['z','x'],
      ];
      // 'w' should be finger lr, home is 's'
      const result = fingerMovement('w', 'en', customRows);
      expect(result).not.toBeNull();
      // w (row 1) relative to s (row 2)
      expect(result.rowDiff).toBe(-1);
    });

    test('returns null for unmapped character', () => {
      expect(fingerMovement('±', 'en')).toBeNull();
    });

    test('detects zero movement for home row key', () => {
      // 'a' is home for left pinky
      const result = fingerMovement('a', 'en');
      if (result) {
        expect(result.rowDiff).toBe(0);
        expect(result.colDiff).toBe(0);
      }
    });
  });

  /* ============================
   *  createState()
   * ============================ */
  describe('createState()', () => {
    test('creates initial state with given text', () => {
      const text = 'Hello world';
      const state = createState(text);
      expect(state.text).toBe(text);
      expect(state.pos).toBe(0);
      expect(state.errors).toEqual([]);
      expect(state.totalErrors).toBe(0);
      expect(state.startTime).toBeNull();
      expect(state.finished).toBe(false);
    });

    test('creates state for empty text', () => {
      const state = createState('');
      expect(state.text).toBe('');
      expect(state.pos).toBe(0);
      expect(state.errors).toEqual([]);
    });

    test('creates state for text with newlines', () => {
      const state = createState('line1\nline2\n');
      expect(state.text).toBe('line1\nline2\n');
      expect(state.errors.length).toBe(0);
    });
  });

  /* ============================
   *  Data integrity checks
   * ============================ */
  describe('data integrity', () => {
    test('FINGER_KEYS has all 9 finger identifiers', () => {
      expect(Object.keys(FINGER_KEYS)).toEqual([
        'lp', 'lr', 'lm', 'li', 'tt', 'ri', 'rm', 'rr', 'rp',
      ]);
    });

    test('FINGER_NAMES has entries for all finger IDs', () => {
      Object.keys(FINGER_KEYS).forEach(id => {
        expect(FINGER_NAMES[id]).toBeDefined();
        expect(typeof FINGER_NAMES[id]).toBe('string');
        expect(FINGER_NAMES[id].length).toBeGreaterThan(0);
      });
    });

    test('KB_ROWS_EN_DEFAULT has 4 rows with correct keys', () => {
      expect(KB_ROWS_EN_DEFAULT.length).toBe(4);
      // Row 0: number row
      expect(KB_ROWS_EN_DEFAULT[0]).toContain('1');
      expect(KB_ROWS_EN_DEFAULT[0]).toContain('0');
      // Row 1: top letter row
      expect(KB_ROWS_EN_DEFAULT[1]).toContain('q');
      expect(KB_ROWS_EN_DEFAULT[1]).toContain('p');
      // Row 2: home row
      expect(KB_ROWS_EN_DEFAULT[2]).toContain('a');
      expect(KB_ROWS_EN_DEFAULT[2]).toContain(';');
      // Row 3: bottom row
      expect(KB_ROWS_EN_DEFAULT[3]).toContain('z');
      expect(KB_ROWS_EN_DEFAULT[3]).toContain('/');
    });

    test('KB_ROWS_RU_DEFAULT has 4 rows with correct keys', () => {
      expect(KB_ROWS_RU_DEFAULT.length).toBe(4);
      expect(KB_ROWS_RU_DEFAULT[0]).toContain('1');
      expect(KB_ROWS_RU_DEFAULT[0]).toContain('=');
      expect(KB_ROWS_RU_DEFAULT[1]).toContain('й');
      expect(KB_ROWS_RU_DEFAULT[1]).toContain('ъ');
      expect(KB_ROWS_RU_DEFAULT[2]).toContain('ф');
      expect(KB_ROWS_RU_DEFAULT[2]).toContain('э');
      expect(KB_ROWS_RU_DEFAULT[3]).toContain('я');
      expect(KB_ROWS_RU_DEFAULT[3]).toContain('.');
    });
  });

  /* ============================
   *  KEY_TO_FINGER coverage
   * ============================ */
  describe('KEY_TO_FINGER mapping', () => {
    test('all EN lowercase letters are mapped', () => {
      'abcdefghijklmnopqrstuvwxyz'.split('').forEach(ch => {
        expect(KEY_TO_FINGER[ch]).toBeDefined();
      });
    });

    test('all RU lowercase letters (а-я, ё) are mapped', () => {
      'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.split('').forEach(ch => {
        expect(KEY_TO_FINGER[ch]).toBeDefined();
      });
    });

    test('all digits 0-9 are mapped', () => {
      '0123456789'.split('').forEach(ch => {
        expect(KEY_TO_FINGER[ch]).toBeDefined();
      });
    });

    test('common symbols are mapped', () => {
      ['`', '-', '=', '[', ']', '\\', ';', '\'', ',', '.', '/'].forEach(ch => {
        expect(KEY_TO_FINGER[ch]).toBeDefined();
      });
    });

    test('space and newline are mapped', () => {
      expect(KEY_TO_FINGER[' ']).toBe('tt');
      expect(KEY_TO_FINGER['\n']).toBe('rp');
    });
  });

  /* ============================
   *  Export verification
   * ============================ */
  describe('exports', () => {
    test('all expected exports are present', () => {
      // Bug 1: refreshFingerNames must be exported
      expect(refreshFingerNames).toBeDefined();

      // Others
      expect(FINGER_NAMES).toBeDefined();
      expect(FINGER_KEYS).toBeDefined();
      expect(KEY_TO_FINGER).toBeDefined();
      expect(fingerFor).toBeDefined();
      expect(homeKeyForFinger).toBeDefined();
      expect(fingerMovement).toBeDefined();
      expect(KB_ROWS_RU_DEFAULT).toBeDefined();
      expect(KB_ROWS_EN_DEFAULT).toBeDefined();
      expect(createState).toBeDefined();
      expect(getFingerName).toBeDefined();
      expect(getFingerShortLabel).toBeDefined();
    });
  });
});
