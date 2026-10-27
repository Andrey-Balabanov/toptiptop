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
    });
    expect(mockDb.run).toHaveBeenCalledWith(JSON.stringify(result.achievements), 2000, 1);
  });

  it('treats missing or corrupt stored achievements as empty', () => {
    mockDb.get.mockReturnValueOnce({ achievements: 'not json', total_chars: null });

    const result = mergeUserProgress(1, { 'first-text': 100 }, 50);

    expect(result).toEqual({ achievements: { 'first-text': 100 }, totalChars: 50 });
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
