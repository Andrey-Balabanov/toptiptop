jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../middleware/validate', () => ({
  validateLoginBody: (req, res, next) => next(),
  validateAuthBody: (req, res, next) => next(),
}));
jest.mock('../services/auth', () => ({
  registerUser: jest.fn(),
  verifyEmail: jest.fn(),
  loginWithEmail: jest.fn(),
  resendCode: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { loginWithEmail } = require('../services/auth');
const authRoutes = require('../routes/auth');
const { getAuthToken } = require('../middleware/authCookies');

describe('auth cookies', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  test('sets an HttpOnly auth cookie after login', async () => {
    loginWithEmail.mockResolvedValue({ token: 'signed.jwt.token', user: { id: 1 } });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'test-password' });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringMatching(/^toptip_session=signed\.jwt\.token;.*HttpOnly/i),
      expect.stringMatching(/^toptip_authenticated=1;/),
    ]));
  });

  test('reads the auth cookie while preserving Bearer-token support', () => {
    expect(getAuthToken({ headers: { cookie: 'x=1; toptip_session=cookie-token' } }))
      .toBe('cookie-token');
    expect(getAuthToken({
      headers: { authorization: 'Bearer header-token', cookie: 'toptip_session=cookie-token' },
    })).toBe('header-token');
  });

  test('clears the auth cookies on logout', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringMatching(/^toptip_session=;/),
      expect.stringMatching(/^toptip_authenticated=;/),
    ]));
  });
});