/**
 * Unit tests for progress.js: stored progress stays with the account that made it
 */

jest.mock('./api.js', () => ({
  isLoggedIn: () => false,
  updateProgress: () => Promise.resolve(),
}));

import * as progress from './progress.js';

const memory = {};
beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: k => (k in memory ? memory[k] : null),
      setItem: (k, v) => { memory[k] = String(v); },
      removeItem: k => { delete memory[k]; },
    },
  });
});
beforeEach(() => {
  for (const k of Object.keys(memory)) delete memory[k];
});

const account = (id, course) => ({ id, totalXp: 0, achievements: {}, course });

describe('progress ownership', () => {
  it('does not show an account\'s progress to a guest after the session ended', () => {
    progress.initFromServer(account(1, { ru: { passed: 5, best: {} } }));
    expect(progress.getCourse().ru.passed).toBe(5);
    progress.init();
    expect(progress.getCourse()).toEqual({});
  });

  it('keeps guest progress when the guest logs in', () => {
    progress.init();
    progress.setCourse({ ru: { passed: 2, best: {} } });
    progress.initFromServer(account(7, {}));
    expect(progress.getCourse().ru.passed).toBe(2);
  });

  it('never merges one account\'s progress into another', () => {
    progress.initFromServer(account(1, { ru: { passed: 5, best: {} } }));
    progress.initFromServer(account(2, {}));
    expect(progress.getCourse().ru).toBeUndefined();
  });

  it('keeps the same account\'s progress across reloads', () => {
    progress.initFromServer(account(3, {}));
    progress.setCourse({ en: { passed: 4, best: {} } });
    progress.initFromServer(account(3, {}));
    expect(progress.getCourse().en.passed).toBe(4);
  });
});
