/* Daily goal and day streak.
 *
 * A day counts towards the streak once the daily goal (number of finished
 * texts) is reached; missing a whole day resets the streak. Dates are the
 * user's local calendar days. Pure module: state is passed in and returned.
 *
 * Shape: { goal, lastGoalDay, streak, best, today: { date, texts, ms } }
 */

export const DEFAULT_GOAL = 3;
export const GOAL_OPTIONS = [1, 2, 3, 5, 10];

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from day key `a` to day key `b`. */
export function daysBetween(a, b) {
  const toUtc = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

export function normalizeDaily(daily) {
  return {
    goal: DEFAULT_GOAL,
    lastGoalDay: null,
    streak: 0,
    best: 0,
    today: { date: null, texts: 0, ms: 0 },
    ...(daily || {}),
  };
}

/** Today's finished texts / practice time (zero when the stored day is not today). */
export function todayProgress(daily, now = new Date()) {
  const d = normalizeDaily(daily);
  return d.today.date === dayKey(now) ? d.today : { date: dayKey(now), texts: 0, ms: 0 };
}

/** The streak as it stands now: kept while the last goal day is today or yesterday. */
export function currentStreak(daily, now = new Date()) {
  const d = normalizeDaily(daily);
  if (!d.lastGoalDay) return 0;
  return daysBetween(d.lastGoalDay, dayKey(now)) <= 1 ? d.streak : 0;
}

/**
 * Count a finished text.
 * @returns {{ daily: object, goalReachedNow: boolean }}
 */
export function recordText(daily, durationMs, now = new Date()) {
  const d = normalizeDaily(daily);
  const today = todayProgress(d, now);
  const updated = { date: today.date, texts: today.texts + 1, ms: today.ms + Math.max(0, durationMs || 0) };
  let { lastGoalDay, streak, best } = d;
  const goalReachedNow = updated.texts >= d.goal && lastGoalDay !== updated.date;
  if (goalReachedNow) {
    streak = lastGoalDay && daysBetween(lastGoalDay, updated.date) === 1 ? streak + 1 : 1;
    lastGoalDay = updated.date;
    best = Math.max(best, streak);
  }
  return { daily: { ...d, lastGoalDay, streak, best, today: updated }, goalReachedNow };
}

/** Merge local and server copies: the later goal day wins, bests are maxed. */
export function mergeDaily(a, b) {
  const x = normalizeDaily(a);
  const y = normalizeDaily(b);
  const later = (y.lastGoalDay || '') > (x.lastGoalDay || '') ||
    ((y.lastGoalDay || '') === (x.lastGoalDay || '') && y.streak > x.streak) ? y : x;
  const other = later === x ? y : x;
  let today = later.today;
  if (other.today.date && (!today.date || other.today.date > today.date)) today = other.today;
  else if (other.today.date === today.date) {
    today = { date: today.date, texts: Math.max(today.texts, other.today.texts), ms: Math.max(today.ms, other.today.ms) };
  }
  return { ...later, best: Math.max(x.best, y.best, later.streak), today };
}
