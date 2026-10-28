/**
 * Unit tests for mergeUserProgress in src/services/auth.js
 * (achievements + total chars stored on the account so they survive logout)
 */

jest.mock('../config', () => ({
  jwtSecret: 'test-secret',
  jwtExpiresIn: '7d',
  devAutoVerify: true,
  mail: { host: '', port: 587, user: '', pass: '', from: 'test@test.com' },
}));

const mockDb = {
  prepare: jest.fn().mockReturnThis(),
  get: jest.fn(),
  run: jest.fn(),
};

jest.mock('../db', () => ({
  getDb: jest.fn(() => mockDb),
}));

jest.mock('../services/mail', () => ({
  sendVerificationCode: jest.fn(),
}));

const { mergeUserProgress, getUserById } = require('../services/auth');

describe('mergeUserProgress', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const { getDb } = require('../db');
    getDb.mockReturnValue(mockDb);
    mockDb.prepare.mockImplementation(() => mockDb);
  });

  it('unions achievements, keeps the earliest unlock time and the larger char count', () => {
    mockDb.get.mockReturnValueOnce({
      achievements: JSON.stringify({ 'first-text': 100, 'level-5': 500 }),
      total_chars: 2000,
    });

    const result = mergeUserProgress(1, { 'level-5': 300, 'streak-50': 700 }, 1500);

    expect(result).toEqual({
      achievements: { 'first-text': 100, 'level-5': 300, 'streak-50': 700 },
      totalChars: 2000,
      keyStats: {},
      course: {},
    });
    expect(mockDb.run).toHaveBeenCalledWith(JSON.stringify(result.achievements), 2000, '{}', '{}', 1);
  });

  it('treats missing or corrupt stored achievements as empty', () => {
    mockDb.get.mockReturnValueOnce({ achievements: 'not json', total_chars: null });

    const result = mergeUserProgress(1, { 'first-text': 100 }, 50);

    expect(result).toEqual({ achievements: { 'first-text': 100 }, totalChars: 50, keyStats: {}, course: {} });
  });

  it('merges per-letter stats keeping the larger count of each', () => {
    mockDb.get.mockReturnValueOnce({
      achievements: '{}',
      total_chars: 0,
      key_stats: JSON.stringify({ 'а': { h: 50, m: 5 }, 'ы': { h: 10, m: 4 } }),
    });

    const result = mergeUserProgress(1, {}, 0, { 'а': { h: 40, m: 9 }, 'щ': { h: 3, m: 2 } });

    expect(result.keyStats).toEqual({
      'а': { h: 50, m: 9 },
      'ы': { h: 10, m: 4 },
      'щ': { h: 3, m: 2 },
    });
  });

  it('merges course progress: furthest lesson and best results win', () => {
    mockDb.get.mockReturnValueOnce({
      achievements: '{}', total_chars: 0, key_stats: '{}',
      course: JSON.stringify({ ru: { passed: 3, best: { 0: { wpm: 20, accuracy: 96 } } } }),
    });

    const result = mergeUserProgress(1, {}, 0, {}, {
      ru: { passed: 2, best: { 0: { wpm: 25, accuracy: 94 }, 1: { wpm: 18, accuracy: 99 } } },
      en: { passed: 1, best: {} },
    });

    expect(result.course).toEqual({
      ru: { passed: 3, best: { 0: { wpm: 25, accuracy: 96 }, 1: { wpm: 18, accuracy: 99 } } },
      en: { passed: 1, best: {} },
    });
  });

  it('returns null for an unknown user', () => {
    mockDb.get.mockReturnValueOnce(undefined);
    expect(mergeUserProgress(99, {}, 0)).toBeNull();
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('getUserById exposes achievements and totalChars', () => {
    mockDb.get.mockReturnValueOnce({
      id: 1, username: 'u', total_xp: 10, best_wpm: 0, best_streak: 0, session_count: 0,
      achievements: JSON.stringify({ 'first-text': 100 }), total_chars: 42,
    });

    const user = getUserById(1);

    expect(user.achievements).toEqual({ 'first-text': 100 });
    expect(user.totalChars).toBe(42);
  });
});
