/* Main entry point – bootstraps the typing trainer */

import { FINGER_NAMES, refreshFingerNames, fingerFor, createState } from './state.js';
import { buildText, modeToLang, buildAdaptiveText, weakLetters } from './texts.js';
import { createTextView } from './textView.js';
import { attachAchievementTooltips } from './achTooltip.js';
import { TypingBuddy } from './animal.js';
import { renderDaily, refreshLessonSelect, lessonLabel } from './menuWidgets.js';
import { initLevelMap, renderLevelMap } from './levelMap.js';
import {
  keyboardSettings, buildKeyboard, findKeyEl, findKeyElByActual, setNextKey, updateKeyboardArrow,
} from './keyboard.js';
import { getLessons, buildLessonText, currentLessonIndex, recordLessonResult } from './course.js';
import { currentStreak } from './daily.js';
import { openStatsPanel } from './stats.js';
import { showOnboarding, hasSeenOnboarding } from './onboarding.js';
import { shareResult } from './share.js';
import { weeklyText, weeklyMode, weekKey } from './challenge.js';
import { openGroupsPanel, openRaceLobby, RaceSession } from './social.js';
import { track } from './analytics.js';
import * as sound from './sound.js';
import * as effects from './effects.js';
import * as progress from './progress.js';
import * as api from './api.js';
import { renderAuthBar, showAuthModal, setAuthChangeCallback } from './auth.js';
import { t, setLanguage, applyLanguageToDOM, getLanguage } from './i18n.js';
import { needsShift, baseKeyFor } from './shift.js';
import { destroyArrowOverlay, clearArrow, isReady } from './arrows.js';

/* ============ DOM shortcuts ============ */
const $ = id => document.getElementById(id);
const textEl = $('text');


/* Current user profile (for text selection) — default 'general' */
let currentProfile = 'general';

/* Movement arrows toggle — persisted in localStorage */
try {
  keyboardSettings.showArrows = localStorage.getItem('toptip-show-arrows') !== 'false';
} catch {}

/* Listen for arrow toggle events from sidebar buttons (auth.js) */
window.addEventListener('arrows-toggled', (e) => {
  keyboardSettings.showArrows = e.detail.show;
  if (state) {
    const ch = state.text[state.pos];
    const lang = modeToLang($('mode').value);
    updateKeyboardArrow(ch, lang);
  } else {
    // If no state, just clear any lingering arrows
    if (isReady()) clearArrow();
  }
});

/* ============ LAYOUT OVERRIDE (mixed-language support) ============ */

/**
 * Detect if a text contains characters from both Cyrillic (RU) and Latin (EN) layouts.
 * @param {string} text
 * @returns {{ hasCyrillic: boolean, hasLatin: boolean, isMixed: boolean }}
 */
function detectMixedLanguage(text) {
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  return { hasCyrillic, hasLatin, isMixed: hasCyrillic && hasLatin };
}

/**
 * Determine which keyboard layout a character belongs to.
 * @param {string} ch - Single character
 * @returns {'ru' | 'en' | null} - null for neutral chars (space, newline, digits)
 */
function charLayout(ch) {
  if (ch == null || ch === '\n') return null;
  if (ch === ' ') return null;
  // Cyrillic (including Ё/ё)
  if (/[\u0400-\u04FF]/.test(ch) || ch === 'Ё' || ch === 'ё') return 'ru';
  // Latin letters
  if (/[a-zA-Z]/.test(ch)) return 'en';
  // Digits and symbols are ambiguous — don't force a switch
  return null;
}

/**
 * Get the effective keyboard layout currently displayed.
 * For single-language texts this matches modeToLang.
 * For mixed-language texts this uses the user's current override.
 */
function getEffectiveLayout() {
  if (isMixedLanguage && currentDisplayLayout) {
    return currentDisplayLayout;
  }
  return modeToLang($('mode').value);
}

/** Flag: does the current text contain both RU and EN characters? */
let isMixedLanguage = false;

/**
 * The user's current layout override (only meaningful when isMixedLanguage is true).
 * 'ru' = keyboard showing Russian layout, 'en' = keyboard showing English layout.
 * Persisted to localStorage so it survives page reloads.
 */
let currentDisplayLayout = null;

/** Persist the layout override to localStorage */
function persistLayoutOverride() {
  try {
    if (currentDisplayLayout) {
      localStorage.setItem('toptip-kb-layout-override', currentDisplayLayout);
    } else {
      localStorage.removeItem('toptip-kb-layout-override');
    }
  } catch {}
}

/** Load persisted layout override */
function loadLayoutOverride() {
  try {
    const saved = localStorage.getItem('toptip-kb-layout-override');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {}
  return null;
}

/**
 * Toggle the on-screen keyboard between RU and EN layouts.
 * Only meaningful for mixed-language texts.
 */
function toggleKeyboardLayout() {
  if (!isMixedLanguage) return;

  // Flip layout
  currentDisplayLayout = currentDisplayLayout === 'ru' ? 'en' : 'ru';
  persistLayoutOverride();

  const lang = currentDisplayLayout;
  buildKeyboard(lang, currentChar());

  // Re-evaluate indicator and next-key highlight
  if (state) {
    const ch = state.text[state.pos];
    setNextKey(ch);
    updateKeyboardArrow(ch, lang);
    updateLayoutIndicator();
  }
}

/**
 * Update the on-screen layout indicator badge and toggle button visibility/text.
 * Shows a pulsing badge when the next character needs a different layout,
 * and always shows the toggle button for mixed-language texts.
 */
function updateLayoutIndicator() {
  const indicator = $('layout-indicator');
  const toggleBtn = $('layout-toggle');
  const layoutRow = $('layout-row');

  if (!state || !isMixedLanguage || state.finished) {
    if (layoutRow) layoutRow.classList.add('hidden');
    return;
  }

  // Show the row (always visible in mixed mode)
  if (layoutRow) layoutRow.classList.remove('hidden');

  // Update toggle button text
  if (toggleBtn) {
    toggleBtn.textContent = currentDisplayLayout === 'ru' ? 'EN' : 'РУ';
    toggleBtn.title = currentDisplayLayout === 'ru'
      ? t('layout.switch_to_en')
      : t('layout.switch_to_ru');
  }

  // Determine what layout the next character needs
  const nextChar = state.text[state.pos];
  const neededLayout = charLayout(nextChar);

  if (indicator) {
    if (neededLayout && neededLayout !== currentDisplayLayout) {
      // User needs to switch — show pulsing badge
      indicator.textContent = neededLayout === 'ru' ? '🔤 РУ' : '🔤 EN';
      indicator.className = 'layout-indicator ' + neededLayout;
      indicator.classList.remove('hidden');
    } else {
      // Current layout matches next char — hide badge
      indicator.classList.add('hidden');
    }
  }
}

/* ============ APP STATE ============ */

let state = null;

/** The character the cursor is on (null when no text is active). */
function currentChar() {
  return state ? state.text[state.pos] : null;
}

const textView = createTextView(textEl, { before: $('tl-before'), after: $('tl-after') });

/* Animal standing on the current letter of the strip (sidebar: alpaca / sheep / giraffe / off) */
const buddy = new TypingBuddy($('buddy'), [$('tl-before'), $('tl-after')]);
function applyAnimal() {
  let kind = 'alpaca';
  try { kind = localStorage.getItem('toptip-animal') || 'alpaca'; } catch {}
  buddy.setAnimal(kind === 'off' ? null : kind);
  $('type-line').classList.toggle('has-buddy', kind !== 'off');
}
applyAnimal();
window.addEventListener('animal-changed', applyAnimal);

function render() {
  textView.paint(state, $('mode').value === 'code');
  updateNext();
}

function updateNext() {
  const ch = state.text[state.pos];
  const lang = modeToLang($('mode').value);

  updateKeyboardArrow(ch, lang);
  setNextKey(ch);

  // Update hint text
  const hint = $('hint');
  if (!hint) return;
  if (ch == null) {
    hint.innerHTML = t('hint.done');
  } else if (ch === ' ') {
    hint.innerHTML = `${t('hint.next')} <b>${t('hint.finger_space')}</b> — ${t('hint.thumb')}`;
  } else if (ch === '\n') {
    hint.innerHTML = `${t('hint.next')} <b>Enter</b> — ${t('hint.right_pinky')}`;
  } else {
    const f = fingerFor(ch);
    let hintText = `${t('hint.next')} <b>${ch}</b> — ${f ? FINGER_NAMES[f] : '—'}`;
    if (needsShift(ch)) {
      const base = baseKeyFor(ch);
      hintText += ' <span style="color:var(--accent)">[⇧ + ' + base + ']</span>';
    }
    hint.innerHTML = hintText;
  }
}

function updateStats() {
  const elapsed = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
  const minutes = elapsed / 60;
  const wpm = minutes > 0 ? Math.round((state.pos / 5) / minutes) : 0;
  const wrongCount = state.errors.filter(Boolean).length;
  const accuracy = state.pos > 0 ? Math.round(((state.pos - wrongCount) / state.pos) * 100) : 100;

  // Update main stats row (visible in start-mode)
  const wpmEl = $('wpm');
  const accEl = $('accuracy');
  const timeEl = $('time');
  const errEl = $('errors');
  if (wpmEl) wpmEl.textContent = wpm;
  if (accEl) accEl.textContent = accuracy + '%';
  if (timeEl) timeEl.textContent = Math.floor(elapsed) + 's';
  if (errEl) errEl.textContent = state.totalErrors;

  // Update focus-mode stats
  const fsWpm = $('fs-wpm');
  const fsAccuracy = $('fs-accuracy');
  const fsTime = $('fs-time');
  const fsErrors = $('fs-errors');
  if (fsWpm) fsWpm.textContent = wpm;
  if (fsAccuracy) fsAccuracy.textContent = accuracy + '%';
  if (fsTime) fsTime.textContent = Math.floor(elapsed) + 's';
  if (fsErrors) fsErrors.textContent = state.totalErrors;

  return wpm;
}

/** Completion screen: letters missed most in this text and speed vs the recent average. */
function showInsight(wpm, avgWpmBefore) {
  const el = $('c-insight');
  if (!el) return;
  const parts = [];
  const misses = Object.entries(state.missCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (misses.length) {
    parts.push(t('result.missed_most') + ' ' + misses.map(([k, n]) => `<b>${k}</b> ×${n}`).join(', '));
  } else {
    parts.push(t('result.no_misses'));
  }
  if (avgWpmBefore != null) {
    const diff = Math.round(wpm - avgWpmBefore);
    const key = diff > 0 ? 'result.faster' : (diff < 0 ? 'result.slower' : 'result.same_speed');
    parts.push(t(key).replace('{n}', Math.abs(diff)).replace('{avg}', Math.round(avgWpmBefore)));
  }
  el.innerHTML = parts.join(' · ');
}

/* ============ DISPLAY PREFERENCES (sidebar toggles in auth.js) ============ */

function applyKeyboardVisibility() {
  let show = true;
  try { show = localStorage.getItem('toptip-show-keyboard') !== 'false'; } catch {}
  document.querySelector('.app')?.classList.toggle('hide-keyboard', !show);
}
window.addEventListener('keyboard-toggled', applyKeyboardVisibility);
window.addEventListener('contrast-toggled', (e) => {
  document.documentElement.classList.toggle('high-contrast', e.detail.on);
});

/* First-visit guide (also reopened from the sidebar) */
function startCourseFromGuide() {
  track('onboarding_course_started');
  $('mode').value = getLanguage() === 'ru' ? 'course-ru' : 'course-en';
  refreshLessonSelect();
  enterFocusMode();
}
window.addEventListener('open-onboarding', () => showOnboarding({ t, onStartCourse: startCourseFromGuide }));

/* Level map: clicking an open lesson starts it */
function startLessonFromMap(lang, index) {
  track('level_map_lesson_started');
  $('mode').value = 'course-' + lang;
  refreshLessonSelect();
  $('course-lesson').value = String(index);
  renderLevelMap();
  enterFocusMode();
}

/* ============ SOCIAL: GROUPS, WEEKLY CHALLENGE, RACES ============ */

let currentUserId = null;
let race = null;

function leaveRaceIfAny() {
  if (race) {
    race.stop();
    race = null;
  }
  const el = $('c-race');
  if (el) el.classList.add('hidden');
}

/** Results screen: your place in this week's challenge (logged in) or how to get one. */
async function showWeeklyPlace(lang) {
  const el = $('c-race');
  if (!el) return;
  el.classList.remove('hidden', 'fail');
  if (!api.isLoggedIn()) {
    el.textContent = t('weekly.login_to_rank');
    return;
  }
  el.textContent = t('stats.loading');
  try {
    const board = await api.fetchWeeklyChallenge(lang);
    el.textContent = board.me
      ? t('weekly.place').replace('{place}', board.me.rank).replace('{total}', board.total).replace('{wpm}', Math.round(board.me.wpm))
      : t('weekly.not_ranked').replace('{acc}', 90);
  } catch {
    el.classList.add('hidden');
  }
}

function raceFinished(room) {
  const el = $('c-race');
  if (!el || !state || !state.finished) return;
  el.classList.remove('hidden', 'fail');
  const me = room.players.find(p => p.id === currentUserId);
  el.textContent = me && me.place
    ? t('race.your_place').replace('{place}', me.place).replace('{n}', room.players.length)
    : t('race.waiting_others');
}

window.addEventListener('open-groups', () => {
  openGroupsPanel({ t, onLogin: () => showAuthModal('login') });
});

window.addEventListener('open-race', () => {
  const lang = modeToLang($('mode').value) === 'en' ? 'en' : 'ru';
  openRaceLobby({
    t,
    lang,
    meId: currentUserId,
    onLogin: () => showAuthModal('login'),
    makeText: () => buildText(lang, 'short', currentProfile, lang),
    onEnter: room => {
      track('race_started', { players: room.players.length });
      leaveRaceIfAny();
      race = new RaceSession(room, { t, onUpdate: raceFinished });
      enterFocusMode();
    },
  });
});

/* Statistics window — opened from the sidebar (auth.js dispatches open-stats) */
window.addEventListener('open-stats', () => {
  openStatsPanel({
    t,
    lang: getLanguage() === 'ru' ? 'ru' : 'en',
    keyStats: progress.getKeyStats(),
    weakLetters: lang => weakLetters(progress.getKeyStats(), lang),
    loadHistory: async () => {
      if (api.isLoggedIn()) {
        const sessions = await api.fetchSessions({ limit: 50 });
        const list = Array.isArray(sessions) ? sessions : (sessions.sessions || []);
        return list.filter(s => !s.isDraft).reverse();
      }
      return progress.getHistory().slice(-50);
    },
    onTrain: lang => {
      $('mode').value = 'adaptive-' + lang;
      refreshLessonSelect();
      enterFocusMode();
    },
  });
});

/** Completion screen line when today's goal was just reached. */
function showDailyResult(finished) {
  const el = $('c-daily');
  if (!el) return;
  el.classList.toggle('hidden', !finished.goalReachedNow);
  if (finished.goalReachedNow) {
    el.textContent = t('daily.goal_reached').replace('{n}', finished.streak);
  }
}

/* One-line note above the text (e.g. which weak letters an adaptive lesson trains) */
function setLessonInfo(html) {
  const el = $('lesson-info');
  if (!el) return;
  el.innerHTML = html;
  el.classList.toggle('hidden', !html);
}

/* "Accuracy first": on a wrong key the cursor waits for the right one */
let accuracyMode = false;
try { accuracyMode = localStorage.getItem('toptip-accuracy-mode') === 'true'; } catch {}
window.addEventListener('accuracy-mode-toggled', (e) => { accuracyMode = e.detail.on; });

function reset() {
  buddy.reset();
  const mode = $('mode').value;
  const length = $('length').value;
  const lang = modeToLang(mode);
  let lessonInfo = '';
  let text;
  let courseLesson = null;
  if (race) {
    // Everyone in the race types the same text from the room
    text = race.text;
    lessonInfo = t('race.info');
  } else if (mode.startsWith('weekly-')) {
    text = weeklyText(lang);
    lessonInfo = t('weekly.info').replace('{week}', weekKey());
  } else if (mode.startsWith('course-')) {
    const lessons = getLessons(lang);
    courseLesson = Number($('course-lesson').value);
    if (!Number.isInteger(courseLesson)) courseLesson = currentLessonIndex(progress.getCourse(), lang);
    const lesson = lessons[courseLesson];
    text = buildLessonText(lang, courseLesson, length);
    lessonInfo = `${t('course.lesson')} ${courseLesson + 1}/${lessons.length}: <b>${lessonLabel(lesson)}</b> · ` +
      `${t('course.target')} ${lesson.accuracy}% · ${lesson.wpm} WPM`;
  } else if (mode.startsWith('adaptive-')) {
    const lesson = buildAdaptiveText(lang, length, progress.getKeyStats());
    text = lesson.text;
    lessonInfo = lesson.weak.length
      ? `${t('lesson.weak_letters')} <b>${lesson.weak.join(' ')}</b>`
      : t('lesson.no_data');
  } else {
    text = buildText(mode, length, currentProfile, lang);
  }
  state = createState(text);
  state.courseLesson = courseLesson;
  state.missCounts = {};
  setLessonInfo(lessonInfo);
  // XP before this text: the server gets everything earned during it (chars, combos, completion)
  state.xpAtStart = progress.getProgress().xp;

  // Detect if the text contains mixed languages
  const detected = detectMixedLanguage(state.text);
  isMixedLanguage = detected.isMixed;

  // Initialize or restore layout override for mixed texts
  if (isMixedLanguage) {
    currentDisplayLayout = loadLayoutOverride() || lang;
  } else {
    currentDisplayLayout = null;
  }

  progress.onWrongChar(); // reset streak
  buildKeyboard(lang, currentChar());
  updateStreakDisplay();
  render();
  updateStats();
  updateLayoutIndicator();

  if (document.activeElement !== textEl) {
    textEl.classList.add('blurred');
  } else {
    textEl.classList.remove('blurred');
  }
}

function flashKey(ch, correct, combo) {
  const el = findKeyEl(ch);
  if (el) {
    el.classList.remove('correct-hit', 'wrong-hit', 'combo-hit');
    void el.offsetWidth;
    el.classList.add(combo ? 'combo-hit' : (correct ? 'correct-hit' : 'wrong-hit'));
    // Drop the hit class once the animation is over (longest: comboHit 0.6s); otherwise
    // the key keeps its "hit" look for good, e.g. a white finger pad instead of its colour
    clearTimeout(el._hitTimer);
    el._hitTimer = setTimeout(() => el.classList.remove('correct-hit', 'wrong-hit', 'combo-hit'), 650);

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    if (correct) {
      const streak = progress.getCurrentStreak();
      let text = '+1', color = '#9ece6a';
      if (streak >= 10)  { text = '+2'; color = '#e0af68'; }
      if (streak >= 25)  { text = '+3'; color = '#ff9e64'; }
      if (streak >= 50)  { text = '+5'; color = '#f7768e'; }
      if (streak >= 100) { text = '+8'; color = '#bb9af7'; }
      effects.showParticle(x, y, text, color);
      if (combo) effects.showSparks(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        color, 12
      );
    } else {
      effects.showParticle(x, y, '✗', '#f7768e');
    }
  }
}

function flashActualKey(actualChar) {
  if (!actualChar) return;
  const el = findKeyElByActual(actualChar);
  if (!el) return;

  document.querySelectorAll('.key.actual-pressed').forEach(k => k.classList.remove('actual-pressed'));
  el.classList.add('actual-pressed');
  setTimeout(() => {
    if (el) el.classList.remove('actual-pressed');
  }, 600);
}

function updateStreakDisplay() {
  const el = $('streak');
  if (!el) return;
  const streak = progress.getCurrentStreak();
  el.classList.remove('on', 'hot');
  if (streak === 0) { el.textContent = '—'; return; }
  el.textContent = (streak >= 10 ? '🔥 ' : '') + streak;
  if (streak > 0) el.classList.add('on');
  if (streak >= 10) el.classList.add('hot');

  // Update focus-mode streak
  const fsStreak = $('fs-streak');
  if (fsStreak) {
    fsStreak.textContent = streak > 0 ? streak : '—';
  }
}

function updateHeader() {
  const lvl = progress.currentLevel();
  const progXp = progress.getProgress().xp - lvl.totalAtStart;
  const pct = Math.min(100, (progXp / lvl.needed) * 100);
  const levelNum = $('level-num');
  const levelTitleEl = $('level-title');
  const xpFill = $('xp-fill');
  const xpText = $('xp-text');
  const score = $('score');
  if (levelNum) levelNum.textContent = lvl.level;
  if (levelTitleEl) levelTitleEl.textContent = progress.levelTitle(lvl.level);
  if (xpFill) xpFill.style.width = pct + '%';
  if (xpText) xpText.textContent = `${progXp} / ${lvl.needed} XP`;
  if (score) score.textContent = progress.getProgress().xp.toLocaleString('ru-RU');
}

let achTooltipsAttached = false;

function renderAchievements() {
  const grid = $('ach-grid');
  if (!grid) return;
  if (!achTooltipsAttached) {
    attachAchievementTooltips(grid);
    achTooltipsAttached = true;
  }
  grid.innerHTML = '';
  let unlocked = 0;
  progress.getAchievements().forEach(a => {
    const has = !!progress.getProgress().achievements[a.id];
    if (has) unlocked++;
    const cell = document.createElement('div');
    cell.className = 'ach-cell' + (has ? ' unlocked' : '');
    // Hidden achievements reveal nothing until they are earned
    const name = !has && a.hidden ? '???' : a.name;
    const desc = !has && a.hidden ? t('ach.hidden.desc') : a.desc;
    cell.textContent = has ? a.icon : (a.hidden ? '❔' : '🔒');
    // Description shown by the floating tooltip (achTooltip.js) on hover, focus or tap
    cell.dataset.name = name;
    cell.dataset.desc = desc;
    cell.dataset.status = t(has ? 'ach.status_unlocked' : 'ach.status_locked');
    cell.tabIndex = 0;
    cell.setAttribute('aria-label', `${name}. ${desc}`);
    grid.appendChild(cell);
  });
  const count = $('ach-count');
  if (count) count.textContent = `${unlocked} / ${progress.getAchievements().length}`;
}

async function finishSession() {
  if (!state) return;
  const wpm = updateStats();
  const selectedMode = $('mode').value;
  // Weekly challenge runs are saved under the week's mode so the server can rank them
  const mode = race ? 'race'
    : selectedMode.startsWith('weekly-') ? weeklyMode(modeToLang(selectedMode)) : selectedMode;

  const elapsed = state.startTime ? (Date.now() - state.startTime) : 0;
  const wrongCount = state.errors.filter(Boolean).length;
  const accuracy = state.pos > 0 ? Math.round(((state.pos - wrongCount) / state.pos) * 100) : 100;

  const finished = progress.finishSession(wpm, mode, {
    accuracy, durationMs: elapsed, textLength: state.text.length,
  });
  const xpEarned = finished.xpEarned;
  showDailyResult(finished);
  showInsight(wpm, finished.avgWpmBefore);
  renderDaily();
  updateHeader();
  renderAchievements();

  showCourseResult(mode, wpm, accuracy);
  // Mode family only (e.g. "weekly", "course") — no personal data
  track('text_finished', { mode: mode.split(/[-@]/)[0], wpm_bucket: Math.min(150, Math.floor(wpm / 10) * 10) });

  // Show completion overlay
  showCompletionOverlay(wpm, accuracy, wrongCount, xpEarned, elapsed);

  const clientSessionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  if (api.isLoggedIn()) {
    try {
      await api.saveSession({
        wpm,
        accuracy,
        totalErrors: state.totalErrors,
        xpEarned: Math.max(0, progress.getProgress().xp - state.xpAtStart),
        durationMs: elapsed,
        textLength: state.text.length,
        streakMax: progress.getProgress().bestStreak,
        mode,
        clientSessionId,
      });
    } catch (err) {
      console.warn('Session save to server failed, queued:', err.message);
    }
  }
  if (selectedMode.startsWith('weekly-') && !race) showWeeklyPlace(modeToLang(selectedMode));
}

/* ============ COMPLETION OVERLAY ============ */

let lastResult = null;

function showCompletionOverlay(wpm, accuracy, errors, xp, elapsed) {
  const overlay = $('completion-overlay');
  if (!overlay) return;
  lastResult = {
    wpm, accuracy, errors,
    level: progress.currentLevel().level,
    streak: currentStreak(progress.getDaily()),
    url: location.origin,
  };
  const shareBtn = $('btn-share');
  if (shareBtn) shareBtn.textContent = t('btn.share');

  const cWpm = $('c-wpm');
  const cAccuracy = $('c-accuracy');
  const cTime = $('c-time');
  const cErrors = $('c-errors');
  const cXp = $('c-xp');

  if (cWpm) cWpm.textContent = wpm;
  if (cAccuracy) cAccuracy.textContent = accuracy + '%';
  if (cTime) cTime.textContent = Math.floor(elapsed / 1000) + 's';
  if (cErrors) cErrors.textContent = errors;
  if (cXp) cXp.textContent = '+ ' + xp;

  overlay.classList.remove('hidden');
}

/** Course lessons: record the attempt and say whether it passed / unlocked the next lesson. */
function showCourseResult(mode, wpm, accuracy) {
  const el = $('c-course');
  if (!el) return;
  if (state.courseLesson == null) {
    el.classList.add('hidden');
    return;
  }
  const lang = modeToLang(mode);
  const r = recordLessonResult(progress.getCourse(), lang, state.courseLesson, wpm, accuracy);
  progress.setCourse(r.progress);
  const total = getLessons(lang).length;
  if (r.unlocked) track('course_lesson_passed', { lang, lesson: state.courseLesson + 1 });
  if (r.unlocked && state.courseLesson + 1 < total) {
    el.textContent = t('course.unlocked').replace('{n}', state.courseLesson + 2);
  } else if (r.unlocked) {
    el.textContent = t('course.finished');
  } else if (r.passed) {
    el.textContent = t('course.passed');
  } else {
    el.textContent = t('course.failed')
      .replace('{acc}', r.target.accuracy).replace('{wpm}', r.target.wpm);
  }
  el.classList.toggle('fail', !r.passed);
  el.classList.remove('hidden');
  // "Next text" continues with the next lesson once it is unlocked
  refreshLessonSelect();
  if (r.unlocked && state.courseLesson + 1 < total) $('course-lesson').value = String(state.courseLesson + 1);
  renderLevelMap();
}

function hideCompletionOverlay() {
  const overlay = $('completion-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/* ============ FOCUS / START MODE SWITCHING ============ */

function enterFocusMode() {
  const app = document.querySelector('.app');
  if (!app) return;

  app.classList.remove('start-mode');
  app.classList.add('focus-mode');

  const backBtn = $('btn-back');
  if (backBtn) backBtn.classList.remove('hidden');

  const focusStats = $('focus-stats');
  if (focusStats) focusStats.classList.remove('hidden');

  // Generate and show the text
  reset();
  textEl.focus();
}

function exitFocusMode() {
  const app = document.querySelector('.app');
  if (!app) return;
  leaveRaceIfAny();

  app.classList.remove('focus-mode');
  app.classList.add('start-mode');
  // The map was not laid out during the lesson: redraw it now that it's visible
  renderLevelMap();

  // Hide completion overlay (just in case)
  hideCompletionOverlay();

  // Hide back button and focus stats
  const backBtn = $('btn-back');
  if (backBtn) backBtn.classList.add('hidden');

  const focusStats = $('focus-stats');
  if (focusStats) focusStats.classList.add('hidden');

  // Destroy SVG arrow overlay (cleanup)
  destroyArrowOverlay();

  // Reset state
  state = null;

  // Clear text display and reset stats
  textView.clear();
  textEl.classList.add('blurred');
  const wpmEl = $('wpm');
  const accEl = $('accuracy');
  const timeEl = $('time');
  const errEl = $('errors');
  const streakEl = $('streak');
  if (wpmEl) wpmEl.textContent = '0';
  if (accEl) accEl.textContent = '100%';
  if (timeEl) timeEl.textContent = '0s';
  if (errEl) errEl.textContent = '0';
  if (streakEl) {
    streakEl.textContent = '—';
    streakEl.classList.remove('on', 'hot');
  }
}

/* ============ EVENT HANDLERS ============ */

function handleKey(e) {
  if (e.key === 'Tab' && document.querySelector('.modal-overlay')) {
    return;
  }

  // Only handle keys when in focus-mode with active state
  if (!state || !document.querySelector('.app.focus-mode')) return;
  // In a race the text is fixed and typing waits for the shared start
  if (race && (e.key === 'Escape' || e.key === 'Tab')) { e.preventDefault(); return; }
  if (e.key === 'Escape') { reset(); textEl.focus(); return; }
  if (e.key === 'Tab') { e.preventDefault(); reset(); textEl.focus(); return; }
  if (state.finished) return;
  if (document.activeElement !== textEl) return;
  if (race && !race.started()) { e.preventDefault(); return; }

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (state.pos > 0) {
      state.pos--;
      state.errors[state.pos] = false;
      render();
      updateStats();
    }
    return;
  }

  let key = e.key;
  if (e.key === 'Enter') key = '\n';
  if (key.length !== 1 && key !== '\n') return;

  e.preventDefault();

  if (!state.startTime) {
    state.startTime = Date.now();
  }

  const expected = state.text[state.pos];
  const isCorrect = key === expected;

  if (isCorrect) {
    // In accuracy mode a letter missed before stays marked as an error once it's finally typed
    state.errors[state.pos] = accuracyMode && !!state.errors[state.pos];
    sound.playCorrect();
    buddy.step(true);
    const result = progress.onCorrectChar(expected);
    if (result.combo) {
      sound.playCombo();
      effects.flyGift(result.streak);
      progress.awardXp(result.streak);
      effects.showBigComboText(result.streak);
      checkAchievements();
    }
  } else {
    state.errors[state.pos] = true;
    state.totalErrors++;
    sound.playWrong();
    buddy.step(false);
    progress.onWrongChar(expected);
    if (expected && expected.trim()) {
      const k = expected.toLowerCase();
      state.missCounts[k] = (state.missCounts[k] || 0) + 1;
    }
    flashActualKey(key);
    if (accuracyMode) {
      // Stay on this letter until the right key is pressed
      flashKey(expected, false, false);
      render();
      updateStats();
      updateStreakDisplay();
      return;
    }
  }

  flashKey(expected, isCorrect,
    isCorrect && progress.getCurrentStreak() >= 10 &&
    (progress.getCurrentStreak() === 10 || progress.getCurrentStreak() === 25 ||
     progress.getCurrentStreak() === 50 || progress.getCurrentStreak() === 100 ||
     progress.getCurrentStreak() % 50 === 0)
  );

  state.pos++;
  if (race) race.report(state.pos, state.totalErrors);
  if (state.pos >= state.text.length) {
    state.finished = true;
    sound.playAchievement();
    finishSession();
  }

  render();
  updateStats();
  updateStreakDisplay();
  updateHeader();
  updateLayoutIndicator();
}

function checkAchievements() {
  const unlocked = progress.checkAchievements();
  unlocked.forEach(a => {
    sound.playAchievement();
    effects.showAchievementToast(a.icon, a.name, a.desc);
  });
  if (unlocked.length > 0) renderAchievements();
}

/* ============ KEYBOARD LAYOUT SELECTOR ============ */

function buildKeyboardLayoutSelector() {
  const controls = $('controls');
  if (!controls) return;

  const existing = document.getElementById('keyboard-layout-select');
  if (existing) existing.remove();

  const select = document.createElement('select');
  select.id = 'keyboard-layout-select';
  select.innerHTML = `
    <option value="pc-ansi">🖥 PC — ANSI</option>
    <option value="pc-iso">🖥 PC — ISO</option>
    <option value="mac-ansi">🍎 Mac — ANSI</option>
    <option value="mac-iso">🍎 Mac — ISO</option>
  `;
  select.value = keyboardSettings.layout;
  select.addEventListener('change', () => {
    keyboardSettings.layout = select.value;
    try { localStorage.setItem('toptip-keyboard-layout', keyboardSettings.layout); } catch {}
    const lang = modeToLang($('mode').value);
    buildKeyboard(lang, currentChar());
    if (state) {
      setNextKey(state.text[state.pos]);
    }
    if (api.isLoggedIn()) {
      api.updateKeyboardLayout(keyboardSettings.layout).catch(() => {});
    }
  });

  const resetProgressBtn = document.getElementById('reset-progress');
  if (resetProgressBtn) {
    controls.insertBefore(select, resetProgressBtn);
  } else {
    controls.appendChild(select);
  }
}

/* ============ PROGRESS CALLBACKS ============ */

progress.setCallbacks({
  onLevelUp(level) {
    sound.playLevelUp();
    effects.triggerLevelUpEffect(level, progress.levelTitle(level));
    updateHeader();
    renderAchievements();
  },
  onAchievement(a) {
    sound.playAchievement();
    effects.showAchievementToast(a.icon, a.name, a.desc);
    renderAchievements();
  },
  onXpChange() {
    updateHeader();
  },
});

/* ============ AUTH CALLBACKS ============ */

setAuthChangeCallback(() => {
  renderAuthBar();
});

/* ============ AUTH EVENTS ============ */

let wasLoggedIn = false;
window.addEventListener('auth-login', (e) => {
  const user = e.detail.user;
  wasLoggedIn = true;
  currentUserId = user.id;

  // Reload progress from server
  progress.initFromServer(user);
  updateHeader();
  renderAchievements();
  refreshLessonSelect();
  renderDaily();
  renderLevelMap();

  // Apply user language & profile
  if (user.language) {
    setLanguage(user.language);
    applyLanguageToDOM();
    refreshFingerNames();
    updateHeader(); // re-render level title with new language
  }
  if (user.profile) {
    currentProfile = user.profile;
  }
  if (user.keyboardLayout) {
    keyboardSettings.layout = user.keyboardLayout;
    const layoutSelect = document.getElementById('keyboard-layout-select');
    if (layoutSelect) layoutSelect.value = keyboardSettings.layout;
  }

  // If currently in focus-mode, refresh the text
  if (document.querySelector('.app.focus-mode')) {
    reset();
    textEl.focus();
  }
});

window.addEventListener('auth-logout', () => {
  // auth-logout also fires on every guest page load: only wipe local progress when a
  // logged-in user actually logs out (their achievements live on the server now)
  if (wasLoggedIn) {
    wasLoggedIn = false;
    progress.resetProgress();
  }
  currentUserId = null;
  currentProfile = 'general';
  updateHeader();
  renderAchievements();
  refreshLessonSelect();
  renderDaily();
  renderLevelMap();

  // If in focus-mode, exit to menu
  if (document.querySelector('.app.focus-mode')) {
    exitFocusMode();
  }
});

/* ============ PROFILE-CHANGED EVENT ============ */

window.addEventListener('profile-changed', (e) => {
  const { language, profile, keyboardLayout } = e.detail;

  // Apply language change
  setLanguage(language);
  applyLanguageToDOM();
  refreshFingerNames();
  updateHeader(); // re-render level title with new language
  renderAchievements();
  refreshLessonSelect();
  renderDaily();
  renderLevelMap();

  // Update profile for text selection
  currentProfile = profile;

  // Update keyboard layout
  if (keyboardLayout) {
    keyboardSettings.layout = keyboardLayout;
    const layoutSelect = document.getElementById('keyboard-layout-select');
    if (layoutSelect) layoutSelect.value = keyboardSettings.layout;
    const lang = modeToLang($('mode').value);
    buildKeyboard(lang, currentChar());
  }

  // If in focus-mode, refresh the text with new profile
  if (document.querySelector('.app.focus-mode')) {
    reset();
    textEl.focus();
  }
});

/* ============ GAME LOOP ============ */

let lastTick = 0;
function tick() {
  if (state && state.startTime && !state.finished) {
    const now = Date.now();
    if (now - lastTick > 200) {
      updateStats();
      lastTick = now;
    }
  }
  requestAnimationFrame(tick);
}

/* ============ MUTE BUTTON (in auth-bar) ============ */

function initMuteButton() {
  const bar = document.getElementById('auth-bar');
  if (!bar) return;
  // Remove old mute button if present
  const old = document.getElementById('mute-btn');
  if (old) old.remove();

  const btn = document.createElement('button');
  btn.id = 'mute-btn';
  btn.className = 'mute-btn';
  const setMuteLabel = muted => {
    btn.textContent = muted ? '🔇' : '🔊';
    btn.dataset.i18nTitle = muted ? 'sound.unmute' : 'sound.mute';
    btn.title = t(btn.dataset.i18nTitle);
  };
  setMuteLabel(sound.isMuted());
  btn.onclick = () => setMuteLabel(sound.toggleMuted());
  bar.prepend(btn);
}

// auth.js rebuilds the bar (login, logout, settings save), which removes the button
window.addEventListener('auth-bar-rendered', initMuteButton);

/* ============ INITIALIZATION ============ */

function init() {
  buildKeyboardLayoutSelector();
  renderAuthBar();
  updateHeader();
  renderAchievements();

  // Restore layout override from localStorage
  const savedLayout = loadLayoutOverride();
  if (savedLayout) {
    currentDisplayLayout = savedLayout;
  }

  // Start button → enter focus mode
  const startBtn = $('btn-start');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      enterFocusMode();
    });
  }

  // Back button → exit focus mode
  const backBtn = $('btn-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      exitFocusMode();
    });
  }

  // Layout toggle button → switch keyboard layout
  const layoutToggle = $('layout-toggle');
  if (layoutToggle) {
    layoutToggle.addEventListener('click', () => {
      toggleKeyboardLayout();
    });
  }

  // Alt+Shift keyboard shortcut for layout switching (registered before handleKey)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && e.altKey && isMixedLanguage && document.querySelector('.app.focus-mode')) {
      e.preventDefault();
      e.stopPropagation();
      toggleKeyboardLayout();
    }
  });

  // Completion overlay: "Next Text" → reset text, stay in focus mode
  const nextTextBtn = $('btn-next-text');
  if (nextTextBtn) {
    nextTextBtn.addEventListener('click', () => {
      hideCompletionOverlay();
      reset();
      textEl.focus();
    });
  }

  // Completion overlay: "Share" → picture of the result (share sheet or download)
  const shareBtn = $('btn-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (!lastResult) return;
      const how = await shareResult(lastResult, t);
      track('result_shared', { how });
      if (how === 'downloaded') shareBtn.textContent = t('share.saved');
    });
  }

  // Completion overlay: "To Menu" → exit to start menu
  const toMenuBtn = $('btn-to-menu');
  if (toMenuBtn) {
    toMenuBtn.addEventListener('click', () => {
      exitFocusMode();
    });
  }

  // Text display events
  textEl.addEventListener('focus', () => textEl.classList.remove('blurred'));
  textEl.addEventListener('blur', () => {
    if (state && state.pos === 0) textEl.classList.add('blurred');
  });
  textEl.addEventListener('click', () => textEl.focus());

  // Global keyboard handler (main typing logic)
  document.addEventListener('keydown', handleKey);

  // "New Text" button in controls row
  const resetBtn = $('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (document.querySelector('.app.focus-mode')) {
        reset();
        textEl.focus();
      }
    });
  }

  // Mode / length selectors — only affect next focus session
  const modeSelect = $('mode');
  const lengthSelect = $('length');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      refreshLessonSelect();
      renderLevelMap();
      if (document.querySelector('.app.focus-mode')) {
        reset();
        textEl.focus();
      }
    });
  }
  const lessonSelect = $('course-lesson');
  if (lessonSelect) {
    lessonSelect.addEventListener('change', () => {
      if (document.querySelector('.app.focus-mode')) {
        reset();
        textEl.focus();
      }
    });
  }
  refreshLessonSelect();
  renderDaily();
  initLevelMap({ onStart: startLessonFromMap });
  applyKeyboardVisibility();
  if (!hasSeenOnboarding()) showOnboarding({ t, onStartCourse: startCourseFromGuide });
  if (lengthSelect) {
    lengthSelect.addEventListener('change', () => {
      if (document.querySelector('.app.focus-mode')) {
        reset();
        textEl.focus();
      }
    });
  }

  // Reset progress button
  const resetProgressBtn = $('reset-progress');
  if (resetProgressBtn) {
    resetProgressBtn.addEventListener('click', () => {
      if (confirm(t('confirm.reset_progress'))) {
        progress.resetProgress();
        updateHeader();
        renderAchievements();
        renderLevelMap();
      }
    });
  }

  requestAnimationFrame(tick);

  if (api.isLoggedIn()) {
    api.syncQueue();
  }
}

// Bootstrap
init();

// Installable app / offline support (see sw.js). Not on a local dev server: its
// offline copies hid freshly edited files (sw.js removes a worker installed earlier)
const isLocalDev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isLocalDev) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
