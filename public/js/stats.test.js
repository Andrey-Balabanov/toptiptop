/**
 * Unit tests for the pure helpers of stats.js
 */

import { heatColor, keyErrorRate, linePoints, recentAverage } from './stats.js';

describe('stats helpers', () => {
  it('colours keys from green to red by error rate', () => {
    expect(heatColor(0)).toBe('hsl(120, 65%, 45%)');
    expect(heatColor(0.15)).toBe('hsl(0, 65%, 45%)');
    expect(heatColor(0.5)).toBe('hsl(0, 65%, 45%)');
  });

  it('computes the error rate of a key, or null without data', () => {
    expect(keyErrorRate({ h: 9, m: 1 })).toBe(0.1);
    expect(keyErrorRate({ h: 0, m: 0 })).toBeNull();
    expect(keyErrorRate(undefined)).toBeNull();
  });

  it('scales values into chart points', () => {
    expect(linePoints([0, 50, 100], 200, 100, 0, 100)).toBe('0,100 100,50 200,0');
    expect(linePoints([], 200, 100, 0, 100)).toBe('');
    expect(linePoints([150], 200, 100, 0, 100)).toBe('100,0'); // clamped, centred
  });

  it('averages the last n values', () => {
    expect(recentAverage([10, 20, 30, 40], 2)).toBe(35);
    expect(recentAverage([], 10)).toBeNull();
  });
});
