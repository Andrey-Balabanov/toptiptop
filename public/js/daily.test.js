/**
 * Unit tests for daily.js (daily goal and day streak)
 */

import { dayKey, daysBetween, recordText, currentStreak, todayProgress, mergeDaily, normalizeDaily } from './daily.js';

const day = (s, h = 12) => new Date(`${s}T${String(h).padStart(2, '0')}:00:00`);

describe('daily goal & streak', () => {
  it('uses local calendar days', () => {
    expect(dayKey(day('2026-03-05'))).toBe('2026-03-05');
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('counts a day only once the goal is reached', () => {
    let d = { goal: 2 };
    let r = recordText(d, 60000, day('2026-03-05'));
    expect(r.goalReachedNow).toBe(false);
    expect(currentStreak(r.daily, day('2026-03-05'))).toBe(0);
    r = recordText(r.daily, 60000, day('2026-03-05'));
    expect(r.goalReachedNow).toBe(true);
    expect(currentStreak(r.daily, day('2026-03-05'))).toBe(1);
    // a third text the same day doesn't count again
    r = recordText(r.daily, 1000, day('2026-03-05'));
    expect(r.goalReachedNow).toBe(false);
    expect(todayProgress(r.daily, day('2026-03-05'))).toEqual({ date: '2026-03-05', texts: 3, ms: 121000 });
  });

  it('grows on consecutive days and resets after a missed day', () => {
    let d = { goal: 1 };
    d = recordText(d, 0, day('2026-03-05')).daily;
    d = recordText(d, 0, day('2026-03-06')).daily;
    expect(currentStreak(d, day('2026-03-06'))).toBe(2);
    expect(currentStreak(d, day('2026-03-07'))).toBe(2); // still alive until the day ends
    expect(currentStreak(d, day('2026-03-08'))).toBe(0); // missed a whole day
    d = recordText(d, 0, day('2026-03-09')).daily;
    expect(d.streak).toBe(1);
    expect(d.best).toBe(2);
  });

  it('merges local and server copies', () => {
    const a = { ...normalizeDaily(), lastGoalDay: '2026-03-06', streak: 2, best: 5, today: { date: '2026-03-06', texts: 3, ms: 10 } };
    const b = { ...normalizeDaily(), lastGoalDay: '2026-03-05', streak: 1, best: 1, today: { date: '2026-03-06', texts: 4, ms: 5 } };
    expect(mergeDaily(a, b)).toMatchObject({ lastGoalDay: '2026-03-06', streak: 2, best: 5, today: { texts: 4, ms: 10 } });
  });
});
