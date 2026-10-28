/**
 * Unit tests for the typing buddy's speed → fear / gait rules (animal.js)
 */

import { fearLevel, gaitFor, recentWpm, animalSVG, ANIMALS } from './animal.js';

describe('typing buddy', () => {
  it('gets more frightened the faster you type', () => {
    expect([0, 29, 30, 54, 55, 79, 80, 200].map(fearLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('walks, runs, then jumps', () => {
    expect(gaitFor(10)).toBe('walk');
    expect(gaitFor(40)).toBe('run');
    expect(gaitFor(70)).toBe('jump');
  });

  it('measures speed over the last 3 seconds only', () => {
    // 10 keys in the last 2 s = 2 words in 2 s = 60 WPM
    const now = 10000;
    const recent = Array.from({ length: 10 }, (_, i) => now - 2000 + i * 222);
    expect(recentWpm(recent, now)).toBe(60);
    expect(recentWpm([now - 5000, now - 4000], now)).toBe(0); // too old
    expect(recentWpm([now], now)).toBe(0);
  });

  it('draws every animal with the face parts the fear levels animate', () => {
    for (const kind of ANIMALS) {
      const svg = animalSVG(kind);
      for (const part of ['an-sclera', 'an-pupil', 'an-brow', 'an-mouth-scared', 'an-sweat-1', 'an-leg']) {
        expect(svg).toContain(part);
      }
    }
  });
});

describe('typing buddy boredom', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gets bored, then sleepy without typing, and wakes up on a key', () => {
    // eslint-disable-next-line global-require
    const { TypingBuddy, BORED_AFTER_MS, SLEEPY_AFTER_MS } = require('./animal.js');
    const host = { dataset: {}, innerHTML: '', classList: { toggle() {}, add() {}, remove() {} }, querySelector: () => null };
    const buddy = new TypingBuddy(host);
    buddy.setAnimal('sheep');
    expect(host.dataset.idle).toBe('');
    jest.advanceTimersByTime(BORED_AFTER_MS);
    expect(host.dataset.idle).toBe('bored');
    jest.advanceTimersByTime(SLEEPY_AFTER_MS - BORED_AFTER_MS);
    expect(host.dataset.idle).toBe('sleepy');
    buddy.step(true);
    expect(host.dataset.idle).toBe('');
  });
});
