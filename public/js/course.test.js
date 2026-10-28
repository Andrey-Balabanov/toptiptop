/**
 * Unit tests for course.js (step-by-step lessons)
 */

import { getLessons, keysUpTo, buildLessonText, currentLessonIndex, recordLessonResult, mergeCourse } from './course.js';

describe('course', () => {
  it('has lessons with growing speed targets', () => {
    const lessons = getLessons('ru');
    expect(lessons[0]).toMatchObject({ keys: 'ао', index: 0, accuracy: 95, wpm: 12 });
    expect(lessons[lessons.length - 1].wpm).toBe(30);
  });

  it('accumulates learned keys', () => {
    expect(keysUpTo('ru', 2)).toBe('аовлыд');
  });

  it('only uses learned letters in a letter lesson', () => {
    const allowed = new Set(keysUpTo('ru', 4) + ' ');
    const text = buildLessonText('ru', 4, 'medium');
    expect([...text].every(c => allowed.has(c))).toBe(true);
    expect(text.split(' ')).toHaveLength(18);
  });

  it('adds capitals, punctuation and digits in the special lessons', () => {
    const lessons = getLessons('en');
    const idx = name => lessons.findIndex(l => l.special === name);
    expect(buildLessonText('en', idx('capitals'))).toMatch(/[A-Z]/);
    expect(buildLessonText('en', idx('punctuation'))).toMatch(/[,.!?:;]/);
    expect(buildLessonText('en', idx('digits'))).toMatch(/\d/);
  });

  it('starts at the first lesson not yet passed', () => {
    expect(currentLessonIndex({}, 'ru')).toBe(0);
    expect(currentLessonIndex({ ru: { passed: 3 } }, 'ru')).toBe(3);
  });

  it('unlocks the next lesson only when both targets are met', () => {
    const fail = recordLessonResult({}, 'ru', 0, 30, 90);
    expect(fail).toMatchObject({ passed: false, unlocked: false });
    expect(fail.progress.ru.passed).toBe(0);
    const pass = recordLessonResult(fail.progress, 'ru', 0, 20, 97);
    expect(pass).toMatchObject({ passed: true, unlocked: true });
    expect(pass.progress.ru).toEqual({ passed: 1, best: { 0: { wpm: 30, accuracy: 97 } } });
    // replaying an earlier lesson doesn't unlock again
    expect(recordLessonResult(pass.progress, 'ru', 0, 20, 97).unlocked).toBe(false);
  });

  it('merges local and server progress', () => {
    expect(mergeCourse({ ru: { passed: 2, best: { 0: { wpm: 20, accuracy: 96 } } } },
      { ru: { passed: 1, best: { 0: { wpm: 25, accuracy: 95 } } } }))
      .toEqual({ ru: { passed: 2, best: { 0: { wpm: 25, accuracy: 96 } } } });
  });
});
