/**
 * Unit tests for src/services/antiCheat.js (server-side session plausibility)
 */

const {
  MAX_HUMAN_WPM,
  impliedWpm,
  checkSessionPlausibility,
  capStreak,
  maxXpForSession,
  sanitizeSession,
} = require('../services/antiCheat');

// 300 chars in 60 s = 60 WPM
const normal = { wpm: 60, durationMs: 60000, textLength: 300, xpEarned: 400, streakMax: 120, accuracy: 98 };

describe('antiCheat', () => {
  it('derives WPM from text length and duration', () => {
    expect(impliedWpm(300, 60000)).toBe(60);
  });

  it('accepts a normal session', () => {
    expect(checkSessionPlausibility(normal)).toBeNull();
  });

  it('rejects inhuman speeds', () => {
    // 300 chars in 10 s = 360 WPM
    expect(checkSessionPlausibility({ ...normal, durationMs: 10000, wpm: 360 })).toMatch(/humanly/);
    expect(impliedWpm(300, 10000)).toBeGreaterThan(MAX_HUMAN_WPM);
  });

  it('rejects a reported WPM higher than the text and duration allow', () => {
    expect(checkSessionPlausibility({ ...normal, wpm: 150 })).toMatch(/exceeds/);
  });

  it('rejects sub-second sessions', () => {
    expect(checkSessionPlausibility({ ...normal, durationMs: 500 })).toMatch(/short/);
  });

  it('caps the streak at the stored best plus this text', () => {
    expect(capStreak(5000, 100, 300)).toBe(400);
    expect(capStreak(50, 100, 300)).toBe(50);
  });

  it('caps XP at what a perfect run could earn', () => {
    const max = maxXpForSession(300, 60, 300);
    expect(max).toBeGreaterThan(300);
    const { session } = sanitizeSession({ ...normal, xpEarned: 1e9 }, 0);
    expect(session.xpEarned).toBeLessThanOrEqual(maxXpForSession(300, 60, 300));
  });

  it('keeps honest XP unchanged and never negative', () => {
    expect(sanitizeSession(normal, 100).session.xpEarned).toBe(400);
    expect(sanitizeSession({ ...normal, xpEarned: -50 }, 100).session.xpEarned).toBe(0);
  });

  it('returns the rejection reason instead of a session', () => {
    expect(sanitizeSession({ ...normal, wpm: 999, durationMs: 1000 }, 0)).toEqual({ error: expect.any(String) });
  });
});
