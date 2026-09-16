/**
 * Unit tests for src/services/auth.js
 *
 * Tests: registerUser, loginWithEmail, verifyEmail,
 *        getUserById, updateUserLanguage, updateUserProfile, updateUserStats
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock config BEFORE requiring auth service
jest.mock('../config', () => ({
  jwtSecret: 'test-secret',
  jwtExpiresIn: '7d',
  devAutoVerify: true,
  mail: { host: '', port: 587, user: '', pass: '', from: 'test@test.com' },
}));

// Mock db
const mockDb = {
  prepare: jest.fn().mockReturnThis(),
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn(),
};

jest.mock('../db', () => ({
  getDb: jest.fn(() => mockDb),
}));

// Mock mail
jest.mock('../services/mail', () => ({
  sendVerificationCode: jest.fn(),
}));

const {
  registerUser,
  loginWithEmail,
  verifyEmail,
  getUserById,
  updateUserLanguage,
  updateUserProfile,
  updateUserStats,
} = require('../services/auth');

describe('auth service', () => {
  beforeEach(() => {
    // Reset all mocks including implementations and queued return values,
    // then re-establish the required mock implementations
    jest.resetAllMocks();
    const { getDb } = require('../db');
    getDb.mockReturnValue(mockDb);
    mockDb.prepare.mockImplementation(() => mockDb);
  });

  /* ============ registerUser ============ */

  describe('registerUser', () => {
    it('registers a new user with valid data and returns token (devAutoVerify=true)', async () => {
      mockDb.get
        .mockReturnValueOnce(null)  // no existing username
        .mockReturnValueOnce(null); // no existing email
      mockDb.run.mockReturnValue({ lastInsertRowid: 42 });

      const result = await registerUser('testuser', 'test@test.com', 'password123');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'));
      expect(mockDb.run).toHaveBeenCalledWith(
        'testuser', 'test@test.com', expect.any(String), 1
      );
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('test@test.com');
    });

    it('throws USERNAME_TAKEN when username already exists', async () => {
      mockDb.get
        .mockReturnValueOnce({ id: 1 }) // username taken
        .mockReturnValueOnce(null);

      await expect(
        registerUser('existing', 'new@test.com', 'password123')
      ).rejects.toThrow('USERNAME_TAKEN');
    });

    it('throws EMAIL_TAKEN when email already exists', async () => {
      mockDb.get
        .mockReturnValueOnce(null)  // username free
        .mockReturnValueOnce({ id: 2 }); // email taken

      await expect(
        registerUser('newuser', 'used@test.com', 'password123')
      ).rejects.toThrow('EMAIL_TAKEN');
    });

    it('returns needVerification when devAutoVerify=false', async () => {
      const config = require('../config');
      config.devAutoVerify = false;

      mockDb.get
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);
      mockDb.run.mockReturnValue({ lastInsertRowid: 43 });

      const result = await registerUser('verifyuser', 'verify@test.com', 'password123');

      expect(result).toHaveProperty('needVerification', true);
      expect(result.email).toBe('verify@test.com');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe('verifyuser');

      config.devAutoVerify = true; // restore
    });
  });

  /* ============ loginWithEmail ============ */

  describe('loginWithEmail', () => {
    it('logs in with valid email and password', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      mockDb.get.mockReturnValue({
        id: 1,
        username: 'testuser',
        email: 'test@test.com',
        password: hashedPassword,
        email_verified: 1,
        language: 'ru',
        profile: 'general',
        keyboard_layout: 'pc-ansi',
        total_xp: 100,
        best_wpm: 45,
        best_streak: 20,
        session_count: 5,
        created_at: '2024-01-01',
      });

      const result = await loginWithEmail('test@test.com', 'correct-password');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('test@test.com');

      // Verify token payload
      const payload = jwt.verify(result.token, 'test-secret');
      expect(payload.userId).toBe(1);
      expect(payload.username).toBe('testuser');
    });

    it('throws INVALID_CREDENTIALS when user not found', async () => {
      mockDb.get.mockReturnValue(null);

      await expect(
        loginWithEmail('nonexistent@test.com', 'anypassword')
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('throws INVALID_CREDENTIALS on wrong password', async () => {
      const hashedPassword = await bcrypt.hash('real-password', 10);
      mockDb.get.mockReturnValue({
        id: 2,
        username: 'testuser2',
        email: 'test2@test.com',
        password: hashedPassword,
      });

      await expect(
        loginWithEmail('test2@test.com', 'wrong-password')
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  /* ============ verifyEmail ============ */

  describe('verifyEmail', () => {
    it('verifies email with valid code', async () => {
      // First call: find the verification code record
      // Second call: find the user record
      mockDb.get
        .mockReturnValueOnce({
          id: 10,
          email: 'verify@test.com',
          code: '123456',
          purpose: 'register',
          used: 0,
          expires_at: '2099-01-01',
        })
        .mockReturnValueOnce({
          id: 3,
          username: 'verifyuser',
          email: 'verify@test.com',
          password: 'hash',
          email_verified: 0,
          language: 'ru',
          profile: 'general',
          keyboard_layout: 'pc-ansi',
          total_xp: 0,
          best_wpm: 0,
          best_streak: 0,
          session_count: 0,
          created_at: '2024-01-01',
        });

      mockDb.run.mockReturnValue({ changes: 1 });

      const result = await verifyEmail('verify@test.com', '123456');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe('verifyuser');
      // User should be marked email_verified — SQL goes to prepare(), params go to run()
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET email_verified')
      );
      expect(mockDb.run).toHaveBeenCalledWith(3);
    });

    it('throws INVALID_OR_EXPIRED_CODE for invalid code', async () => {
      mockDb.get.mockReturnValue(null); // no matching code

      await expect(
        verifyEmail('bad@test.com', '000000')
      ).rejects.toThrow('INVALID_OR_EXPIRED_CODE');
    });

    it('throws USER_NOT_FOUND if user email not in db', async () => {
      mockDb.get
        .mockReturnValueOnce({ id: 10, email: 'orphan@test.com', code: '123456', purpose: 'register', used: 0, expires_at: '2099-01-01' })
        .mockReturnValueOnce(null); // no user

      await expect(
        verifyEmail('orphan@test.com', '123456')
      ).rejects.toThrow('USER_NOT_FOUND');
    });
  });

  /* ============ getUserById ============ */

  describe('getUserById', () => {
    it('returns formatted user for existing user', () => {
      mockDb.get.mockReturnValue({
        id: 5,
        username: 'someuser',
        email: 'some@test.com',
        email_verified: 1,
        language: 'en',
        profile: 'programmer',
        keyboard_layout: 'pc-ansi',
        total_xp: 500,
        best_wpm: 60,
        best_streak: 30,
        session_count: 10,
        created_at: '2024-06-01',
      });

      const user = getUserById(5);

      expect(user).toEqual({
        id: 5,
        username: 'someuser',
        email: 'some@test.com',
        emailVerified: true,
        language: 'en',
        profile: 'programmer',
        keyboardLayout: 'pc-ansi',
        totalXp: 500,
        bestWpm: 60,
        bestStreak: 30,
        sessionCount: 10,
        createdAt: '2024-06-01',
      });
    });

    it('returns null for non-existent user', () => {
      mockDb.get.mockReturnValue(null);

      expect(getUserById(999)).toBeNull();
    });
  });

  /* ============ updateUserLanguage ============ */

  describe('updateUserLanguage', () => {
    it('updates language for user', () => {
      mockDb.run.mockReturnValue({ changes: 1 });

      updateUserLanguage(5, 'de');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET language')
      );
      expect(mockDb.run).toHaveBeenCalledWith('de', 5);
    });
  });

  /* ============ updateUserProfile ============ */

  describe('updateUserProfile', () => {
    it('updates profile for user', () => {
      updateUserProfile(5, 'writer');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET profile')
      );
      expect(mockDb.run).toHaveBeenCalledWith('writer', 5);
    });
  });

  /* ============ updateUserStats ============ */

  describe('updateUserStats', () => {
    it('increments stats correctly', () => {
      updateUserStats(5, 50, 65, 25);

      expect(mockDb.run).toHaveBeenCalledWith(50, 65, 25, 5);
    });

    it('uses MAX for best_wpm and best_streak', () => {
      updateUserStats(5, 0, 30, 5);

      // The SQL uses MAX(best_wpm, ?) so the value is compared
      expect(mockDb.run).toHaveBeenCalledWith(0, 30, 5, 5);
    });
  });
});
