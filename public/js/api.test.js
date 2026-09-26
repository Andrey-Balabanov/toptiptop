describe('API token storage', () => {
  afterEach(() => {
    delete global.localStorage;
    delete global.sessionStorage;
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
});