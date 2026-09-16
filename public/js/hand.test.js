/**
 * Unit tests for hand.js — Mini hand icons for home-row keys.
 *
 * Tests cover:
 *   - fingerHandSVG()  — SVG generation, hand orientation, finger highlight
 *   - isHomeKey()      — home-key detection across RU / EN / code layouts
 */

import { fingerHandSVG, isHomeKey } from './hand.js';

const FINGERS = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];

/* ==========================================================================
 *  fingerHandSVG()
 * ========================================================================== */

describe('fingerHandSVG()', () => {
  test('returns an SVG string for every home-row finger', () => {
    FINGERS.forEach(id => {
      const svg = fingerHandSVG(id);
      expect(svg).toBeTruthy();
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('viewBox="0 0 50 31"');
      expect(svg.endsWith('</svg>')).toBe(true);
    });
  });

  test('returns null for unknown / thumb finger ids', () => {
    expect(fingerHandSVG('tt')).toBeNull();
    expect(fingerHandSVG('xyz')).toBeNull();
    expect(fingerHandSVG('')).toBeNull();
    expect(fingerHandSVG(null)).toBeNull();
    expect(fingerHandSVG(undefined)).toBeNull();
  });

  test('renders 4 fingers + palm + thumb (6 rects total)', () => {
    const svg = fingerHandSVG('li');
    const rects = svg.match(/<rect /g);
    expect(rects).toHaveLength(6);
  });

  test('highlights exactly one finger with currentColor', () => {
    FINGERS.forEach(id => {
      const svg = fingerHandSVG(id);
      const highlighted = svg.match(/fill="currentColor"/g) || [];
      expect(highlighted).toHaveLength(1);
    });
  });

  describe('hand orientation', () => {
    // Left hand: fingers left→right = pinky, ring, middle, index
    test('left pinky (lp) highlights the leftmost finger', () => {
      const svg = fingerHandSVG('lp');
      const idx = svg.indexOf('currentColor');
      expect(idx).toBeGreaterThan(svg.indexOf('x="6"'));
      expect(idx).toBeLessThan(svg.indexOf('x="16"'));
    });

    test('left index (li) highlights the rightmost finger of the left hand', () => {
      const svg = fingerHandSVG('li');
      const idx = svg.indexOf('currentColor');
      expect(idx).toBeGreaterThan(svg.indexOf('x="36"'));
    });

    // Right hand: fingers left→right = index, middle, ring, pinky
    test('right index (ri) highlights the leftmost finger of the right hand', () => {
      const svg = fingerHandSVG('ri');
      const idx = svg.indexOf('currentColor');
      expect(idx).toBeGreaterThan(svg.indexOf('x="6"'));
      expect(idx).toBeLessThan(svg.indexOf('x="16"'));
    });

    test('right pinky (rp) highlights the rightmost finger', () => {
      const svg = fingerHandSVG('rp');
      const idx = svg.indexOf('currentColor');
      expect(idx).toBeGreaterThan(svg.indexOf('x="36"'));
    });
  });

  test('left hand draws the thumb on the right, right hand on the left', () => {
    const leftSvg = fingerHandSVG('lp');
    const rightSvg = fingerHandSVG('rp');
    // Left-hand thumb rect starts at x=37; right-hand thumb at x=1
    expect(leftSvg).toContain('x="37"');
    expect(rightSvg).toContain('x="1"');
  });

  test('all finger ids produce unique but valid markup', () => {
    const svgs = FINGERS.map(id => fingerHandSVG(id));
    expect(new Set(svgs).size).toBe(FINGERS.length);
  });
});

/* ==========================================================================
 *  isHomeKey()
 * ========================================================================== */

describe('isHomeKey()', () => {
  test('detects EN home keys', () => {
    expect(isHomeKey('a', 'lp', 'en')).toBe(true);
    expect(isHomeKey('s', 'lr', 'en')).toBe(true);
    expect(isHomeKey('d', 'lm', 'en')).toBe(true);
    expect(isHomeKey('f', 'li', 'en')).toBe(true);
    expect(isHomeKey('j', 'ri', 'en')).toBe(true);
    expect(isHomeKey('k', 'rm', 'en')).toBe(true);
    expect(isHomeKey('l', 'rr', 'en')).toBe(true);
    expect(isHomeKey(';', 'rp', 'en')).toBe(true);
  });

  test('detects RU home keys', () => {
    expect(isHomeKey('ф', 'lp', 'ru')).toBe(true);
    expect(isHomeKey('ы', 'lr', 'ru')).toBe(true);
    expect(isHomeKey('в', 'lm', 'ru')).toBe(true);
    expect(isHomeKey('а', 'li', 'ru')).toBe(true);
    expect(isHomeKey('о', 'ri', 'ru')).toBe(true);
    expect(isHomeKey('л', 'rm', 'ru')).toBe(true);
    expect(isHomeKey('д', 'rr', 'ru')).toBe(true);
    expect(isHomeKey('ж', 'rp', 'ru')).toBe(true);
  });

  test('code layout maps to English home keys', () => {
    expect(isHomeKey('a', 'lp', 'code')).toBe(true);
    expect(isHomeKey('j', 'ri', 'code')).toBe(true);
    expect(isHomeKey(';', 'rp', 'code')).toBe(true);
  });

  test('unknown language defaults to Russian home keys', () => {
    expect(isHomeKey('ф', 'lp', 'de')).toBe(true);
    expect(isHomeKey('а', 'li', null)).toBe(true);
  });

  test('non-home keys are rejected', () => {
    expect(isHomeKey('q', 'lp', 'en')).toBe(false);
    expect(isHomeKey('g', 'li', 'en')).toBe(false);
    expect(isHomeKey('h', 'ri', 'en')).toBe(false);
    expect(isHomeKey('й', 'lp', 'ru')).toBe(false);
    expect(isHomeKey('п', 'li', 'ru')).toBe(false); // index-finger extended key, not the anchor
    expect(isHomeKey('1', 'lp', 'en')).toBe(false);
    expect(isHomeKey(' ', 'tt', 'en')).toBe(false);
  });

  test('wrong finger for a home key is rejected', () => {
    expect(isHomeKey('f', 'lp', 'en')).toBe(false);
    expect(isHomeKey('a', 'li', 'en')).toBe(false);
    expect(isHomeKey('о', 'rm', 'ru')).toBe(false);
  });

  test('handles edge inputs gracefully', () => {
    expect(isHomeKey(null, 'lp', 'en')).toBe(false);
    expect(isHomeKey(undefined, 'lp', 'en')).toBe(false);
    expect(isHomeKey('', 'lp', 'en')).toBe(false);
    expect(isHomeKey('a', null, 'en')).toBe(false);
    expect(isHomeKey('a', undefined, 'en')).toBe(false);
    expect(isHomeKey('a', 'tt', 'en')).toBe(false); // thumb has no home key
    expect(isHomeKey('a', 'xyz', 'en')).toBe(false);
  });
});
