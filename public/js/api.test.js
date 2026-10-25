describe('API token storage', () => {
  afterEach(() => {
    delete global.localStorage;
    delete global.sessionStorage;
    delete global.document;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('persists the token in sessionStorage when localStorage is unavailable', () => {
    const sessionValues = new Map();
    global.localStorage = {
      getItem() { throw new Error('Storage unavailable'); },
      setItem() { throw new Error('Storage unavailable'); },
      removeItem() { throw new Error('Storage unavailable'); },
    };
    global.sessionStorage = {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
      removeItem(key) { sessionValues.delete(key); },
    };

    const api = require('./api');
    api.setToken('admin-token');
    expect(api.isLoggedIn()).toBe(true);

    jest.resetModules();
    const reloadedApi = require('./api');
    expect(reloadedApi.getToken()).toBe('admin-token');

    reloadedApi.setToken(null);
    expect(sessionValues.has('toptip-token')).toBe(false);
  });

  test('keeps a sessionStorage backup if localStorage silently loses a write', () => {
    const sessionValues = new Map();
    global.localStorage = {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    };
    global.sessionStorage = {
      getItem(key) { return sessionValues.get(key) || null; },
      setItem(key, value) { sessionValues.set(key, value); },
      removeItem(key) { sessionValues.delete(key); },
    };

    const api = require('./api');
    api.setToken('admin-token');

    jest.resetModules();
    const reloadedApi = require('./api');
    expect(reloadedApi.getToken()).toBe('admin-token');
  });

  test('detects a server-authenticated session from its cookie indicator', () => {
    global.localStorage = { getItem() { return null; } };
    global.sessionStorage = { getItem() { return null; } };
    global.document = { cookie: 'other=value; toptip_authenticated=1' };

    const api = require('./api');
    expect(api.isLoggedIn()).toBe(true);
  });

  test('does not retry or queue a login rejected with HTTP 429', async () => {
    const values = new Map();
    global.localStorage = {
      getItem(key) { return values.get(key) || null; },
      setItem(key, value) { values.set(key, value); },
      removeItem(key) { values.delete(key); },
    };
    global.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.fetch = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
      json: async () => ({ error: 'Слишком много попыток' }),
    });

    const api = require('./api');
    await expect(api.loginUser('admin@example.com', 'not-a-real-password'))
      .rejects.toThrow('Слишком много попыток');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(values.has('toptip-sync-queue')).toBe(false);
  });
});