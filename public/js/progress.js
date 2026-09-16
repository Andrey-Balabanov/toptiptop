/* XP, levels, achievements — progress persisted in localStorage for all users */

import * as api from './api.js';
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
];

/** Build live achievement objects with current language translations */
function buildAchievements() {
  return ACHIEVEMENT_DEFS.map(a => ({
    id: a.id,
    icon: a.icon,
    nameKey: a.nameKey,
    descKey: a.descKey,
    name: t(a.nameKey),
    desc: t(a.descKey),
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

export function onWrongChar() {
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
  return unlocked;
}

export function finishSession(wpm, mode) {
  const xpEarned = 20 + Math.round(wpm * 0.5);
  if (wpm > progress.bestWpm) progress.bestWpm = wpm;
  progress.sessions++;
  awardXp(xpEarned);
  saveProgress();
  checkAchievements();
  return xpEarned;
}

export function resetProgress() {
  progress = defaultProgress();
  currentStreak = 0;
  comboCelebrated.clear();
  saveProgress();
}

/* Load progress from server data (called after login) */
export function initFromServer(userData) {
  // Merge guest progress with server data — server data takes priority for XP,
  // but guest achievements are preserved so they aren't lost on login.
  const guestAchievements = progress.achievements || {};

  progress.xp = userData.totalXp || 0;
  progress.bestStreak = userData.bestStreak || 0;
  progress.bestWpm = userData.bestWpm || 0;
  progress.sessions = userData.sessionCount || 0;
  progress.totalChars = 0;
  progress.achievements = {};

  // Merge guest achievements into server achievements (guest's don't overwrite server's)
  // If guest unlocked something the server doesn't know about, keep it.
  for (const [id, timestamp] of Object.entries(guestAchievements)) {
    if (!progress.achievements[id]) {
      progress.achievements[id] = timestamp;
    }
  }

  saveProgress();
  // Re-check achievements against server stats
  checkAchievements();
  if (onXpChange) onXpChange();
}
