/**
 * Unit tests for adaptive lessons and text picking in texts.js
 */

import { weakLetters, buildAdaptiveText, pickDistinct, buildText, modeToLang } from './texts.js';

const stats = {
  'щ': { h: 10, m: 8 },   // very weak
  'ж': { h: 20, m: 9 },   // weak
  'а': { h: 200, m: 2 },  // fine
  'о': { h: 150, m: 1 },  // fine
  'ъ': { h: 1, m: 2 },    // too little data to judge
};

describe('weakLetters', () => {
  it('returns letters missed clearly more often than average, weakest first', () => {
    expect(weakLetters(stats, 'ru')).toEqual(['щ', 'ж']);
  });

  it('ignores letters with too few presses and returns [] without data', () => {
    expect(weakLetters({ 'ъ': { h: 0, m: 3 } }, 'ru')).toEqual([]);
    expect(weakLetters({}, 'ru')).toEqual([]);
  });

  it('only considers letters of the requested language', () => {
    expect(weakLetters({ ...stats, 'q': { h: 5, m: 5 } }, 'en')).toEqual(['q']);
  });
});

describe('buildAdaptiveText', () => {
  it('builds a lesson around the weak letters', () => {
    const { text, weak } = buildAdaptiveText('ru', 'medium', stats);
    expect(weak).toEqual(['щ', 'ж']);
    const words = text.split(' ');
    expect(words).toHaveLength(24);
    // every word contains at least one weak letter (real words picked for them + drills of them)
    expect(words.every(w => /[щж]/.test(w))).toBe(true);
  });

  it('falls back to plain words when there is no data yet', () => {
    const { text, weak } = buildAdaptiveText('en', 'short', {});
    expect(weak).toEqual([]);
    expect(text.split(' ')).toHaveLength(12);
  });
});

describe('text picking', () => {
  it('pickDistinct does not repeat an item before the pool is used up', () => {
    const picked = pickDistinct(['a', 'b', 'c'], 3);
    expect(new Set(picked).size).toBe(3);
  });

  it('separates code snippets with newlines', () => {
    expect(buildText('code', 'long', 'general', 'en')).toContain('\n');
  });

  it('maps adaptive and drill modes to their language', () => {
    expect(modeToLang('adaptive-ru')).toBe('ru');
    expect(modeToLang('drill-top-ru')).toBe('ru');
    expect(modeToLang('adaptive-en')).toBe('en');
  });
});
