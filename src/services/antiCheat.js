/**
 * Plausibility checks for submitted typing sessions.
 *
 * The browser computes speed and XP itself, so the server must not trust
 * them blindly: speed is re-derived from text length and duration, and XP is
 * capped at the most a perfect run could earn under the client's own rules
 * (public/js/progress.js — keep the two in sync).
 */

/** Sustained speeds above this are bots or scripts (world records are ~210–300 WPM). */
const MAX_HUMAN_WPM = 260;
/** Rounding / timing slack between the client's WPM and the server's re-computation. */
const WPM_TOLERANCE = 1.1;
const MIN_DURATION_MS = 1000;

/** WPM implied by the text length and duration (5 chars = 1 word). */
function impliedWpm(textLength, durationMs) {
  return (textLength / 5) / (durationMs / 60000);
}

/**
 * @returns {string|null} a reason to reject the session, or null if plausible
 */
function checkSessionPlausibility({ wpm, durationMs, textLength }) {
  if (durationMs < MIN_DURATION_MS) return 'duration too short';
  const serverWpm = impliedWpm(textLength, durationMs);
  if (serverWpm > MAX_HUMAN_WPM) return 'speed is not humanly possible';
  if (wpm > serverWpm * WPM_TOLERANCE + 2) return 'reported speed exceeds text length / duration';
  return null;
}

/** A streak can only grow by the number of characters typed in this session. */
function capStreak(streakMax, storedBestStreak, textLength) {
  return Math.max(0, Math.min(streakMax, (storedBestStreak || 0) + textLength));
}

/** Per-character XP by current streak — mirrors onCorrectChar() in progress.js. */
function xpPerChar(streak) {
  if (streak >= 100) return 8;
  if (streak >= 50) return 5;
  if (streak >= 25) return 3;
  if (streak >= 10) return 2;
  return 1;
}

function isCombo(streak) {
  return streak === 10 || streak === 25 || streak === 50 || streak === 100 ||
    (streak > 100 && streak % 50 === 0);
}

/**
 * Most XP a single text can earn: every character correct, the streak at its
 * highest possible value (ending at streakMax), every combo bonus, plus the
 * completion bonus (20 + wpm/2, see finishSession in progress.js).
 */
function maxXpForSession(textLength, wpm, streakMax) {
  let streak = Math.max(0, streakMax - textLength);
  let xp = 20 + Math.round(wpm * 0.5);
  for (let i = 0; i < textLength; i++) {
    streak++;
    xp += xpPerChar(streak);
    if (isCombo(streak)) xp += streak;
  }
  return xp;
}

/**
 * Validate and sanitize a completed session against the user's stored stats.
 * @returns {{ error: string } | { session: object }}
 */
function sanitizeSession(body, storedBestStreak) {
  const error = checkSessionPlausibility(body);
  if (error) return { error };
  const streakMax = capStreak(body.streakMax, storedBestStreak, body.textLength);
  const maxXp = maxXpForSession(body.textLength, body.wpm, Math.max(streakMax, body.textLength));
  return {
    session: {
      ...body,
      streakMax,
      xpEarned: Math.max(0, Math.min(Math.round(body.xpEarned), maxXp)),
    },
  };
}

module.exports = {
  MAX_HUMAN_WPM,
  impliedWpm,
  checkSessionPlausibility,
  capStreak,
  maxXpForSession,
  sanitizeSession,
};
