/**
 * Unit tests for the client side of the weekly challenge
 */

import { weekKey, weeklyMode, weeklyText } from './challenge.js';

describe('weekly challenge (client)', () => {
  it('matches the server week key', () => {
    expect(weekKey(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01');
    expect(weekKey(new Date(Date.UTC(2021, 0, 3)))).toBe('2020-W53');
    expect(weeklyMode('ru', '2026-W44')).toBe('weekly-ru@2026-W44');
  });

  it('gives everyone the same text for a week, and a different one next week', () => {
    expect(weeklyText('ru', '2026-W44')).toBe(weeklyText('ru', '2026-W44'));
    expect(weeklyText('ru', '2026-W44')).not.toBe(weeklyText('ru', '2026-W45'));
    expect(weeklyText('en', '2026-W44')).toMatch(/[a-z]/);
  });
});
