/* Start-screen widgets: the daily goal / day streak and the course lesson picker.
 * Extracted from main.js; they read progress and render, nothing else.
 */

import * as progress from './progress.js';
import { t } from './i18n.js';
import { modeToLang } from './texts.js';
import { getLessons, currentLessonIndex } from './course.js';
import { todayProgress, currentStreak, GOAL_OPTIONS } from './daily.js';

const $ = id => document.getElementById(id);

/* ============ DAILY GOAL & STREAK ============ */

/** Start screen widget: day streak, today's texts vs goal, goal picker. */
export function renderDaily() {
  const daily = progress.getDaily();
  const today = todayProgress(daily);
  const streak = currentStreak(daily);
  const streakEl = $('daily-streak');
  if (streakEl) streakEl.textContent = '🔥 ' + streak;
  const label = $('daily-streak-label');
  if (label) label.textContent = t('daily.days_in_row');
  const fill = $('daily-fill');
  if (fill) fill.style.width = Math.min(100, (today.texts / daily.goal) * 100) + '%';
  const text = $('daily-text');
  if (text) {
    text.textContent = t('daily.today')
      .replace('{done}', Math.min(today.texts, daily.goal)).replace('{goal}', daily.goal);
  }
  const widget = $('daily');
  if (widget) widget.classList.toggle('done', today.texts >= daily.goal);
  const select = $('daily-goal');
  if (select && select.options.length === 0) {
    GOAL_OPTIONS.forEach(g => {
      const opt = document.createElement('option');
      opt.value = String(g);
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      progress.setDailyGoal(Number(select.value));
      renderDaily();
    });
  }
  if (select) {
    [...select.options].forEach(o => { o.textContent = t('daily.goal_option').replace('{n}', o.value); });
    select.value = String(daily.goal);
  }
}

/* ============ COURSE ============ */

export function lessonLabel(lesson) {
  return lesson.keys ? [...lesson.keys].join(' ') : t('course.special.' + lesson.special);
}

/** Show the lesson picker in course modes; lessons not unlocked yet are disabled. */
export function refreshLessonSelect() {
  const select = $('course-lesson');
  if (!select) return;
  const mode = $('mode').value;
  const isCourse = mode.startsWith('course-');
  select.classList.toggle('hidden', !isCourse);
  if (!isCourse) return;
  const lang = modeToLang(mode);
  const lessons = getLessons(lang);
  const unlocked = currentLessonIndex(progress.getCourse(), lang);
  const prev = select.dataset.lang === lang ? Number(select.value) : NaN;
  select.innerHTML = '';
  lessons.forEach((lesson, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i < unlocked ? '✓' : (i === unlocked ? '▶' : '🔒')} ${t('course.lesson')} ${i + 1}: ${lessonLabel(lesson)}`;
    opt.disabled = i > unlocked;
    select.appendChild(opt);
  });
  select.dataset.lang = lang;
  select.value = String(Number.isInteger(prev) && prev <= unlocked ? prev : unlocked);
}

