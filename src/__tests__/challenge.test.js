/**
 * Unit tests for the week key of src/services/challenge.js
 */

jest.mock('../db', () => ({ getDb: jest.fn() }));

const { weekKey, weeklyMode } = require('../services/challenge');

describe('weekly challenge', () => {
  it('uses ISO-8601 week numbers', () => {
    expect(weekKey(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01'); // Thursday
    expect(weekKey(new Date(Date.UTC(2021, 0, 3)))).toBe('2020-W53'); // Sunday of the last 2020 week
    expect(weekKey(new Date(Date.UTC(2026, 9, 27)))).toBe('2026-W44');
  });

  it('names the session mode per language and week', () => {
    expect(weeklyMode('en', '2026-W44')).toBe('weekly-en@2026-W44');
    expect(weeklyMode('xx', '2026-W44')).toBe('weekly-ru@2026-W44');
  });
});
