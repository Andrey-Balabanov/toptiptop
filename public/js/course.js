/* Step-by-step touch-typing course.
 *
 * Each lesson adds a few keys to the ones learned before (home row → top row →
 * bottom row → capitals → punctuation → digits). A lesson's text uses real
 * words made only of the keys learned so far, mixed with short drills of the
 * new keys; passing it (accuracy + speed targets) unlocks the next lesson.
 * Pure module: progress is passed in and returned, never stored here.
 */

import { wordPool, genDrill, pickDistinct } from './texts.js';

const RU_LESSONS = [
  { keys: 'ао' }, { keys: 'вл' }, { keys: 'ыд' }, { keys: 'фж' }, { keys: 'пр' },
  { keys: 'ке' }, { keys: 'нг' }, { keys: 'уш' }, { keys: 'цщ' }, { keys: 'йз' }, { keys: 'хъэ' },
  { keys: 'ми' }, { keys: 'ст' }, { keys: 'чь' }, { keys: 'яб' }, { keys: 'юё' },
  { special: 'capitals' }, { special: 'punctuation' }, { special: 'digits' },
];

const EN_LESSONS = [
  { keys: 'fj' }, { keys: 'dk' }, { keys: 'sl' }, { keys: 'a;' }, { keys: 'gh' },
  { keys: 'ru' }, { keys: 'ei' }, { keys: 'wo' }, { keys: 'qp' }, { keys: 'ty' },
  { keys: 'vm' }, { keys: 'cn' }, { keys: 'xb' }, { keys: 'z' },
  { special: 'capitals' }, { special: 'punctuation' }, { special: 'digits' },
];

const LESSONS = { ru: RU_LESSONS, en: EN_LESSONS };

/** Targets grow slowly through the course: 95% accuracy always, speed from 12 to 30 WPM. */
function lessonTarget(index, total) {
  return { accuracy: 95, wpm: Math.round(12 + (18 * index) / Math.max(1, total - 1)) };
}

export function getLessons(language) {
  const list = LESSONS[language] || LESSONS.en;
  return list.map((l, i) => ({ ...l, index: i, ...lessonTarget(i, list.length) }));
}

/** Every letter learned up to and including lesson `index`. */
export function keysUpTo(language, index) {
  return (LESSONS[language] || LESSONS.en).slice(0, index + 1).map(l => l.keys || '').join('');
}

const WORDS_PER_LENGTH = { short: 10, medium: 18, long: 26 };

function capitalize(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Text for lesson `index`. Uses real words built only from the learned keys when
 * there are enough of them; drills of the new keys fill the rest.
 */
export function buildLessonText(language, index, length = 'medium') {
  const lessons = getLessons(language);
  const lesson = lessons[Math.min(index, lessons.length - 1)];
  const count = WORDS_PER_LENGTH[length] || WORDS_PER_LENGTH.medium;
  const allLetters = keysUpTo(language, lessons.length - 1).replace(/[^\p{L}]/gu, '');
  const learned = lesson.keys ? keysUpTo(language, lesson.index) : allLetters;
  const allowed = new Set(learned);
  const words = wordPool(language).filter(w => w.length >= 2 && [...w].every(c => allowed.has(c)));
  const realWords = words.length >= 8 ? pickDistinct(words, count) : [];

  const out = [];
  for (let i = 0; i < count; i++) {
    // Every third item drills the new keys (or the learned ones, early on / no words yet)
    if (lesson.keys && (i % 3 === 2 || realWords.length === 0)) {
      out.push(genDrill(i % 2 ? lesson.keys : learned.replace(/[^\p{L};]/gu, ''), 4, 1));
    } else {
      out.push(realWords[i % realWords.length] || genDrill(learned, 4, 1));
    }
  }

  if (lesson.special === 'capitals') {
    return out.map((w, i) => (i % 2 === 0 ? capitalize(w) : w)).join(' ');
  }
  if (lesson.special === 'punctuation') {
    const marks = [',', '.', '!', '?', ':', ';'];
    return out.map((w, i) => {
      const word = i % 4 === 0 ? capitalize(w) : w;
      return i % 3 === 2 ? word + marks[i % marks.length] : word;
    }).join(' ') + '.';
  }
  if (lesson.special === 'digits') {
    return out.map((w, i) => (i % 2 ? String(Math.floor(Math.random() * 1000)) : w)).join(' ');
  }
  return out.join(' ');
}

/** Index of the lesson to practise next: the first one not yet passed. */
export function currentLessonIndex(courseProgress, language) {
  const passed = (courseProgress && courseProgress[language] && courseProgress[language].passed) || 0;
  return Math.min(passed, getLessons(language).length - 1);
}

/**
 * Record a finished lesson attempt.
 * @returns {{ progress: object, passed: boolean, unlocked: boolean, target: {wpm:number, accuracy:number} }}
 */
export function recordLessonResult(courseProgress, language, index, wpm, accuracy) {
  const lesson = getLessons(language)[index];
  const target = { wpm: lesson.wpm, accuracy: lesson.accuracy };
  const passed = accuracy >= target.accuracy && wpm >= target.wpm;
  const lang = { passed: 0, best: {}, ...((courseProgress || {})[language] || {}) };
  const prevBest = lang.best[index] || { wpm: 0, accuracy: 0 };
  const best = { ...lang.best, [index]: { wpm: Math.max(prevBest.wpm, wpm), accuracy: Math.max(prevBest.accuracy, accuracy) } };
  const unlocked = passed && index + 1 > lang.passed;
  const next = { ...lang, best, passed: unlocked ? index + 1 : lang.passed };
  return { progress: { ...(courseProgress || {}), [language]: next }, passed, unlocked, target };
}

/** Merge two course progress objects (local + server): furthest lesson and best results win. */
export function mergeCourse(a = {}, b = {}) {
  const out = {};
  for (const language of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[language] || {};
    const y = b[language] || {};
    const best = { ...(x.best || {}) };
    for (const [i, r] of Object.entries(y.best || {})) {
      const cur = best[i] || { wpm: 0, accuracy: 0 };
      best[i] = { wpm: Math.max(cur.wpm, r.wpm), accuracy: Math.max(cur.accuracy, r.accuracy) };
    }
    out[language] = { passed: Math.max(x.passed || 0, y.passed || 0), best };
  }
  return out;
}
