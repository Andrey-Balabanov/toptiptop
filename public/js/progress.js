/* XP, levels, achievements — progress persisted in localStorage for all users */

import * as api from './api.js';
import { mergeCourse, getLessons } from './course.js';
import { normalizeDaily, recordText, mergeDaily, currentStreak as dailyStreak } from './daily.js';
import { t } from './i18n.js';

const STORAGE_KEY = 'toptip-progress-v1';

function defaultProgress() {
  return {
    xp: 0,
    bestStreak: 0,
    bestWpm: 0,
    totalChars: 0,
    sessions: 0,
    achievements: {},
    // Per-letter hits / misses ({ 'ф': { h: 120, m: 7 } }) — drives adaptive lessons and the heatmap
    keyStats: {},
    // Course progress per language: { ru: { passed: 3, best: { 0: { wpm, accuracy } } } }
    course: {},
    // Daily goal & day streak (see daily.js)
    daily: normalizeDaily(),
    // Counters behind some achievements (only grow)
    counters: { perfectTexts: 0, nightTexts: 0, morningTexts: 0 },
  };
}

let progress = defaultProgress();
let currentStreak = 0;
let comboCelebrated = new Set();
let initialized = false;

/* Callbacks set by main.js */
let onLevelUp = null;
let onAchievement = null;
let onXpChange = null;

export function setCallbacks(cbs) {
  if (cbs.onLevelUp) onLevelUp = cbs.onLevelUp;
  if (cbs.onAchievement) onAchievement = cbs.onAchievement;
  if (cbs.onXpChange) onXpChange = cbs.onXpChange;
}

function loadProgress() {
  // All users (guests and logged-in) read from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultProgress(), JSON.parse(raw));
  } catch {}
  return defaultProgress();
}

export function init() {
  initialized = true;
  progress = loadProgress();
  currentStreak = 0;
  comboCelebrated.clear();
  // Fire callbacks to update UI
  if (onXpChange) onXpChange();
  checkAchievements();
}

export function saveProgress() {
  // All users (guests and logged-in) persist to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

/* Logged-in users: store achievements + total chars on the account so they survive logout */
function pushProgressToServer() {
  if (!api.isLoggedIn()) return;
  api.updateProgress({
    achievements: progress.achievements,
    totalChars: progress.totalChars,
    keyStats: progress.keyStats,
    course: progress.course,
    daily: progress.daily,
    counters: progress.counters,
  }).catch(() => {});
}

export function getDaily() {
  return normalizeDaily(progress.daily);
}

/** Change the number of texts per day; the streak and today's count are kept. */
export function setDailyGoal(goal) {
  progress.daily = { ...normalizeDaily(progress.daily), goal };
  saveProgress();
  pushProgressToServer();
}

export function getCourse() {
  return progress.course || {};
}

/** Store new course progress (after a lesson) locally and on the account. */
export function setCourse(course) {
  progress.course = course;
  saveProgress();
  pushProgressToServer();
}

/** Count a hit or miss for the expected character (letters, digits, punctuation; not whitespace). */
function recordKey(ch, ok) {
  if (!ch || ch === ' ' || ch === '\n') return;
  const key = ch.toLowerCase();
  if (!progress.keyStats) progress.keyStats = {};
  const s = progress.keyStats[key] || (progress.keyStats[key] = { h: 0, m: 0 });
  if (ok) s.h++; else s.m++;
}

export function getKeyStats() {
  return progress.keyStats || {};
}

export function getProgress() {
  return progress;
}

export function getCurrentStreak() {
  return currentStreak;
}

export function xpForLevel(n) {
  return 80 + (n - 1) * 40;
}

export function currentLevel() {
  let total = 0, lvl = 1;
  while (total + xpForLevel(lvl) <= progress.xp) {
    total += xpForLevel(lvl);
    lvl++;
  }
  return { level: lvl, totalAtStart: total, needed: xpForLevel(lvl) };
}

/**
 * Map level number to an i18n key for the level title.
 * Levels repeat titles in ranges.
 */
const LEVEL_TITLE_KEYS = [
  'level.novice', 'level.novice',
  'level.amateur', 'level.amateur',
  'level.typist', 'level.typist', 'level.typist',
  'level.speed_typist', 'level.speed_typist', 'level.speed_typist',
  'level.key_master', 'level.key_master', 'level.key_master',
  'level.virtuoso', 'level.virtuoso', 'level.virtuoso',
];

export function levelTitle(lvl) {
  if (lvl <= LEVEL_TITLE_KEYS.length) {
    return t(LEVEL_TITLE_KEYS[lvl - 1]);
  }
  return t('level.legend');
}

/** Achievement definitions — names/descs loaded via i18n keys */
const ACHIEVEMENT_DEFS = [
  { id:'first-steps', icon:'👶', nameKey:'ach.first-steps.name', descKey:'ach.first-steps.desc', check:() => progress.totalChars >= 10 },
  { id:'chars-100',   icon:'💯', nameKey:'ach.chars-100.name', descKey:'ach.chars-100.desc', check:() => progress.totalChars >= 100 },
  { id:'chars-500',   icon:'📖', nameKey:'ach.chars-500.name', descKey:'ach.chars-500.desc', check:() => progress.totalChars >= 500 },
  { id:'chars-1000',  icon:'📜', nameKey:'ach.chars-1000.name', descKey:'ach.chars-1000.desc', check:() => progress.totalChars >= 1000 },
  { id:'chars-5000',  icon:'📚', nameKey:'ach.chars-5000.name', descKey:'ach.chars-5000.desc', check:() => progress.totalChars >= 5000 },
  { id:'streak-10',   icon:'🎯', nameKey:'ach.streak-10.name', descKey:'ach.streak-10.desc', check:() => progress.bestStreak >= 10 },
  { id:'streak-25',   icon:'🔥', nameKey:'ach.streak-25.name', descKey:'ach.streak-25.desc', check:() => progress.bestStreak >= 25 },
  { id:'streak-50',   icon:'🚀', nameKey:'ach.streak-50.name', descKey:'ach.streak-50.desc', check:() => progress.bestStreak >= 50 },
  { id:'streak-100',  icon:'⚡', nameKey:'ach.streak-100.name', descKey:'ach.streak-100.desc', check:() => progress.bestStreak >= 100 },
  { id:'streak-250',  icon:'💫', nameKey:'ach.streak-250.name', descKey:'ach.streak-250.desc', check:() => progress.bestStreak >= 250 },
  { id:'speed-20',    icon:'🐢', nameKey:'ach.speed-20.name', descKey:'ach.speed-20.desc', check:() => progress.bestWpm >= 20 },
  { id:'speed-40',    icon:'🐎', nameKey:'ach.speed-40.name', descKey:'ach.speed-40.desc', check:() => progress.bestWpm >= 40 },
  { id:'speed-60',    icon:'🏎️', nameKey:'ach.speed-60.name', descKey:'ach.speed-60.desc', check:() => progress.bestWpm >= 60 },
  { id:'speed-80',    icon:'✈️', nameKey:'ach.speed-80.name', descKey:'ach.speed-80.desc', check:() => progress.bestWpm >= 80 },
  { id:'level-5',     icon:'⭐', nameKey:'ach.level-5.name', descKey:'ach.level-5.desc', check:() => currentLevel().level >= 5 },
  { id:'level-10',    icon:'🌟', nameKey:'ach.level-10.name', descKey:'ach.level-10.desc', check:() => currentLevel().level >= 10 },
  { id:'level-20',    icon:'👑', nameKey:'ach.level-20.name', descKey:'ach.level-20.desc', check:() => currentLevel().level >= 20 },
  { id:'sessions-10', icon:'🎓', nameKey:'ach.sessions-10.name', descKey:'ach.sessions-10.desc', check:() => progress.sessions >= 10 },
  { id:'sessions-50', icon:'🏅', nameKey:'ach.sessions-50.name', descKey:'ach.sessions-50.desc', check:() => progress.sessions >= 50 },
  { id:'sessions-100', icon:'🏆', nameKey:'ach.sessions-100.name', descKey:'ach.sessions-100.desc', check:() => progress.sessions >= 100 },
  { id:'chars-20000', icon:'🗂️', nameKey:'ach.chars-20000.name', descKey:'ach.chars-20000.desc', check:() => progress.totalChars >= 20000 },
  { id:'chars-100000', icon:'🏛️', nameKey:'ach.chars-100000.name', descKey:'ach.chars-100000.desc', check:() => progress.totalChars >= 100000 },
  { id:'speed-100',   icon:'🚀', nameKey:'ach.speed-100.name', descKey:'ach.speed-100.desc', check:() => progress.bestWpm >= 100 },
  { id:'daily-3',     icon:'📆', nameKey:'ach.daily-3.name', descKey:'ach.daily-3.desc', check:() => normalizeDaily(progress.daily).best >= 3 },
  { id:'daily-7',     icon:'🗓️', nameKey:'ach.daily-7.name', descKey:'ach.daily-7.desc', check:() => normalizeDaily(progress.daily).best >= 7 },
  { id:'daily-30',    icon:'🌙', nameKey:'ach.daily-30.name', descKey:'ach.daily-30.desc', check:() => normalizeDaily(progress.daily).best >= 30 },
  { id:'perfect-1',   icon:'💎', nameKey:'ach.perfect-1.name', descKey:'ach.perfect-1.desc', check:() => counter('perfectTexts') >= 1 },
  { id:'perfect-10',  icon:'💠', nameKey:'ach.perfect-10.name', descKey:'ach.perfect-10.desc', check:() => counter('perfectTexts') >= 10 },
  { id:'course-5',    icon:'🎒', nameKey:'ach.course-5.name', descKey:'ach.course-5.desc', check:() => coursePassedTotal() >= 5 },
  { id:'course-done', icon:'🎖️', nameKey:'ach.course-done.name', descKey:'ach.course-done.desc', check:() => courseFinished() },
  // Hidden until unlocked
  { id:'night-owl',   icon:'🦉', hidden:true, nameKey:'ach.night-owl.name', descKey:'ach.night-owl.desc', check:() => counter('nightTexts') >= 1 },
  { id:'early-bird',  icon:'🐦', hidden:true, nameKey:'ach.early-bird.name', descKey:'ach.early-bird.desc', check:() => counter('morningTexts') >= 1 },
];

function counter(name) {
  return (progress.counters && progress.counters[name]) || 0;
}

function coursePassedTotal() {
  return Object.values(progress.course || {}).reduce((sum, c) => sum + (c.passed || 0), 0);
}

function courseFinished() {
  return Object.entries(progress.course || {}).some(([lang, c]) => (c.passed || 0) >= getLessons(lang).length);
}

/** Build live achievement objects with current language translations */
function buildAchievements() {
  return ACHIEVEMENT_DEFS.map(a => ({
    id: a.id,
    icon: a.icon,
    nameKey: a.nameKey,
    descKey: a.descKey,
    name: t(a.nameKey),
    desc: t(a.descKey),
    hidden: !!a.hidden,
    check: a.check,
  }));
}

/** Reload achievement name/desc from i18n (call after language change) */
export function refreshAchievementLabels() {
  // rebuild happens on every getAchievements() call — no cache needed
}

export function getAchievements() {
  return buildAchievements();
}

export function awardXp(amount) {
  const before = currentLevel().level;
  progress.xp += amount;
  const after = currentLevel().level;
  saveProgress();
  if (onXpChange) onXpChange();
  if (after > before) {
    if (onLevelUp) onLevelUp(after);
  }
}

export function onCorrectChar(ch) {
  recordKey(ch, true);
  currentStreak++;
  progress.totalChars++;
  if (currentStreak > progress.bestStreak) progress.bestStreak = currentStreak;

  let xp = 1;
  if (currentStreak >= 10) xp = 2;
  if (currentStreak >= 25) xp = 3;
  if (currentStreak >= 50) xp = 5;
  if (currentStreak >= 100) xp = 8;

  awardXp(xp);

  const isCombo =
    currentStreak === 10 || currentStreak === 25 || currentStreak === 50 ||
    currentStreak === 100 || (currentStreak > 100 && currentStreak % 50 === 0);

  if (isCombo && !comboCelebrated.has(currentStreak)) {
    comboCelebrated.add(currentStreak);
    return { combo: true, streak: currentStreak };
  }
  return { combo: false };
}

export function onWrongChar(expected) {
  recordKey(expected, false);
  currentStreak = 0;
  comboCelebrated.clear();
}

export function checkAchievements() {
  let unlocked = [];
  const achievements = getAchievements();
  achievements.forEach(a => {
    if (!progress.achievements[a.id] && a.check()) {
      progress.achievements[a.id] = Date.now();
      saveProgress();
      unlocked.push(a);
    }
  });
  unlocked.forEach(a => {
    if (onAchievement) onAchievement(a);
  });
  if (unlocked.length > 0) pushProgressToServer();
  return unlocked;
}

/**
 * Count a finished text.
 * @param {{ accuracy?: number, durationMs?: number, textLength?: number, now?: Date }} info
 * @returns {{ xpEarned: number, goalReachedNow: boolean, streak: number }}
 */
export function finishSession(wpm, mode, info = {}) {
  const now = info.now || new Date();
  const xpEarned = 20 + Math.round(wpm * 0.5);
  if (wpm > progress.bestWpm) progress.bestWpm = wpm;
  progress.sessions++;

  const counters = { perfectTexts: 0, nightTexts: 0, morningTexts: 0, ...(progress.counters || {}) };
  if (info.accuracy === 100 && (info.textLength || 0) >= 50) counters.perfectTexts++;
  const hour = now.getHours();
  if (hour < 5) counters.nightTexts++;
  else if (hour < 8) counters.morningTexts++;
  progress.counters = counters;

  const daily = recordText(progress.daily, info.durationMs, now);
  progress.daily = daily.daily;

  awardXp(xpEarned);
  saveProgress();
  if (checkAchievements().length === 0) pushProgressToServer();
  return { xpEarned, goalReachedNow: daily.goalReachedNow, streak: dailyStreak(progress.daily, now) };
}

export function resetProgress() {
  progress = defaultProgress();
  currentStreak = 0;
  comboCelebrated.clear();
  saveProgress();
}

/** Merge per-letter counters from several sources, keeping the larger count of each (they only grow). */
function mergeKeyStats(...sources) {
  const merged = {};
  for (const src of sources) {
    for (const [key, s] of Object.entries(src || {})) {
      const cur = merged[key] || { h: 0, m: 0 };
      merged[key] = { h: Math.max(cur.h, s.h || 0), m: Math.max(cur.m, s.m || 0) };
    }
  }
  return merged;
}

/* Load progress from server data (called after login) */
export function initFromServer(userData) {
  // Restore the locally persisted progress first. Authenticated users do not
  // call init(), so without this step a page reload starts from an empty state.
  const storedProgress = loadProgress();
  const serverAchievements = userData.achievements || {};
  const mergedAchievements = {
    ...(storedProgress.achievements || {}),
    ...(progress.achievements || {}),
    ...serverAchievements,
  };
  const serverChars = userData.totalChars || 0;

  // Server data is authoritative for account-wide statistics; achievements and
  // total characters are merged (local ones earned as a guest are kept too).
  progress.totalChars = Math.max(
    storedProgress.totalChars || 0,
    progress.totalChars || 0,
    serverChars,
  );
  progress.xp = userData.totalXp || 0;
  progress.bestStreak = userData.bestStreak || 0;
  progress.bestWpm = userData.bestWpm || 0;
  progress.sessions = userData.sessionCount || 0;
  progress.achievements = mergedAchievements;
  const serverKeyStats = userData.keyStats || {};
  progress.keyStats = mergeKeyStats(storedProgress.keyStats, progress.keyStats, serverKeyStats);
  const keyStatsAhead = Object.entries(progress.keyStats).some(([k, s]) =>
    !serverKeyStats[k] || s.h > serverKeyStats[k].h || s.m > serverKeyStats[k].m);
  const serverCourse = userData.course || {};
  progress.course = mergeCourse(mergeCourse(storedProgress.course, progress.course), serverCourse);
  const courseAhead = JSON.stringify(progress.course) !== JSON.stringify(mergeCourse(serverCourse, {}));
  const serverDaily = normalizeDaily(userData.daily);
  progress.daily = mergeDaily(mergeDaily(storedProgress.daily, progress.daily), serverDaily);
  const dailyAhead = JSON.stringify(progress.daily) !== JSON.stringify(mergeDaily(serverDaily, serverDaily));
  const serverCounters = userData.counters || {};
  const counters = { ...serverCounters };
  for (const src of [storedProgress.counters, progress.counters]) {
    for (const [k, v] of Object.entries(src || {})) counters[k] = Math.max(counters[k] || 0, v || 0);
  }
  progress.counters = counters;
  const countersAhead = Object.entries(counters).some(([k, v]) => v > (serverCounters[k] || 0));

  initialized = true;
  saveProgress();
  // Re-check achievements against server stats; upload anything the account doesn't have yet
  const unlocked = checkAchievements();
  const serverMissing = Object.keys(mergedAchievements).some(id => !serverAchievements[id]);
  if (unlocked.length === 0 && (serverMissing || keyStatsAhead || courseAhead || dailyAhead || countersAhead ||
      progress.totalChars > serverChars)) {
    pushProgressToServer();
  }
  if (onXpChange) onXpChange();
}
