/* Level map: the course lessons drawn as a winding road on the start screen.
 *
 * Lessons sit on a snake-shaped path (left→right, then right→left on the next
 * row, …). Passed lessons are green, the next one pulses, the rest are locked.
 * Clicking an open lesson starts it. Only shown to logged-in users.
 * `mapLayout` is pure (tested); the rest renders SVG into #level-map.
 */

import * as progress from './progress.js';
import * as api from './api.js';
import { t, getLanguage } from './i18n.js';
import { getLessons, currentLessonIndex } from './course.js';
import { lessonLabel } from './menuWidgets.js';
import { attachAchievementTooltips, hideTooltip } from './achTooltip.js';

const $ = id => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';

const NODE_R = 17;
const PAD_X = 40;
const PAD_Y = 34;
const ROW_H = 78;
const MIN_STEP = 62;

/**
 * Positions of `count` nodes on a snake road inside a `width`-wide map.
 * @returns {{ width:number, height:number, cols:number, nodes:{x:number,y:number,row:number}[], segments:string[] }}
 *   segments[i] is the road from node i to node i+1 (SVG path data, without the leading M).
 */
export function mapLayout(count, width) {
  const cols = Math.max(3, Math.min(10, Math.floor((width - 2 * PAD_X) / MIN_STEP) + 1, count));
  const rows = Math.ceil(count / cols);
  const step = (width - 2 * PAD_X) / (cols - 1);
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const c = i % cols;
    const col = row % 2 === 0 ? c : cols - 1 - c;
    // A gentle wave so the road doesn't look ruled
    const wave = (col % 2 ? 1 : -1) * 7;
    nodes.push({ x: Math.round(PAD_X + col * step), y: PAD_Y + row * ROW_H + wave, row });
  }
  const segments = [];
  for (let i = 0; i + 1 < count; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (a.row === b.row) {
      const mx = (a.x + b.x) / 2;
      segments.push(`C ${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`);
    } else {
      // Row turn: bulge outwards past the edge node
      const out = a.x > width / 2 ? 1 : -1;
      const bx = a.x + out * (PAD_X - 6);
      segments.push(`C ${bx} ${a.y} ${bx} ${b.y} ${b.x} ${b.y}`);
    }
  }
  return { width, height: PAD_Y * 2 + (rows - 1) * ROW_H + 8, cols, nodes, segments };
}

/** Road through nodes from..to (inclusive), as one SVG path. */
function roadPath(layout, from, to) {
  const start = layout.nodes[from];
  return `M ${start.x} ${start.y} ` + layout.segments.slice(from, to).join(' ');
}

/** Short text drawn inside a node: the new keys, or a symbol for special lessons. */
function nodeGlyph(lesson) {
  if (lesson.keys) return lesson.keys.toUpperCase();
  return { capitals: 'Aa', punctuation: ',.!', digits: '123' }[lesson.special] || '★';
}

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

/** Small deterministic random numbers so the scenery doesn't jump on re-render. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Trees and bushes between the rows of the road. */
function scenery(svg, layout) {
  const rand = seeded(layout.nodes.length * 31 + layout.cols);
  const g = el('g', { class: 'lm-scenery', 'aria-hidden': 'true' });
  const rows = layout.nodes[layout.nodes.length - 1].row + 1;
  // One band of trees in the gap between each pair of road rows
  for (let r = 1; r < rows; r++) {
    const y = PAD_Y + (r - 0.5) * ROW_H;
    const count = Math.max(2, Math.round(layout.width / 140));
    for (let k = 0; k < count; k++) {
      const x = 20 + ((k + rand() * 0.6) / count) * (layout.width - 40);
      const yy = y + (rand() - 0.5) * 12;
      const s = 0.7 + rand() * 0.6;
      if (rand() < 0.65) {
        g.appendChild(el('path', {
          class: 'lm-tree',
          d: `M ${x} ${yy - 14 * s} L ${x + 8 * s} ${yy + 2 * s} L ${x - 8 * s} ${yy + 2 * s} Z`,
        }));
        g.appendChild(el('rect', { class: 'lm-trunk', x: x - 1.5 * s, y: yy + 2 * s, width: 3 * s, height: 4 * s }));
      } else {
        g.appendChild(el('ellipse', { class: 'lm-bush', cx: x, cy: yy, rx: 9 * s, ry: 5 * s }));
      }
    }
  }
  svg.appendChild(g);
}

/** Finish flag just past the last lesson. */
function finishFlag(svg, layout, finished) {
  const last = layout.nodes[layout.nodes.length - 1];
  const x = last.x + (last.row % 2 === 0 ? 1 : -1) * (NODE_R + 4);
  const y = last.y - NODE_R - 2;
  const g = el('g', { class: 'lm-flag' + (finished ? ' done' : ''), 'aria-hidden': 'true' });
  g.appendChild(el('line', { x1: x, y1: y + 22, x2: x, y2: y - 10 }));
  g.appendChild(el('path', { d: `M ${x} ${y - 10} L ${x + 14} ${y - 5} L ${x} ${y} Z` }));
  svg.appendChild(g);
}

let mapLang = null;
let onStartLesson = () => {};
let lastWidth = 0;

/** Course language for the map: the course chosen in the mode menu, else the picked tab / interface. */
function currentMapLang() {
  const mode = $('mode') ? $('mode').value : '';
  if (mode.startsWith('course-')) return mode.slice('course-'.length);
  return mapLang || (getLanguage() === 'ru' ? 'ru' : 'en');
}

/** Draw (or hide) the level map. Safe to call often. */
export function renderLevelMap() {
  const panel = $('level-map');
  const box = $('lm-scroll');
  if (!panel || !box) return;
  panel.classList.toggle('hidden', !api.isLoggedIn());
  if (!api.isLoggedIn()) return;

  const lang = currentMapLang();
  const lessons = getLessons(lang);
  const course = progress.getCourse();
  const passed = (course[lang] && course[lang].passed) || 0;
  const best = (course[lang] && course[lang].best) || {};
  const current = currentLessonIndex(course, lang);
  const finished = passed >= lessons.length;

  const title = $('lm-title');
  if (title) title.textContent = t('map.title');
  const count = $('lm-count');
  if (count) count.textContent = `${Math.min(passed, lessons.length)} / ${lessons.length}`;
  panel.querySelectorAll('.lm-lang').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  });

  const width = box.clientWidth;
  lastWidth = width;
  // Not laid out (focus mode): the resize observer redraws once the map is visible again
  if (!width) return;
  const layout = mapLayout(lessons.length, width);
  const svg = el('svg', {
    class: 'lm-svg', width: layout.width, height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`, role: 'group', 'aria-label': t('map.title'),
  });

  scenery(svg, layout);
  const full = roadPath(layout, 0, lessons.length - 1);
  svg.appendChild(el('path', { class: 'lm-road', d: full }));
  svg.appendChild(el('path', { class: 'lm-road-dash', d: full }));
  if (current > 0) svg.appendChild(el('path', { class: 'lm-road-done', d: roadPath(layout, 0, current) }));
  finishFlag(svg, layout, finished);

  lessons.forEach((lesson, i) => {
    const { x, y } = layout.nodes[i];
    const state = i < passed ? 'passed' : (i === current ? 'current' : 'locked');
    const g = el('g', {
      class: `lm-node ${state}` + (state !== 'locked' ? ' unlocked' : ''),
      transform: `translate(${x} ${y})`,
      tabindex: '0',
      role: 'button',
      'data-index': String(i),
    });
    const name = `${t('course.lesson')} ${i + 1}: ${lessonLabel(lesson)}`;
    let status;
    if (state === 'passed') {
      const b = best[i] || { wpm: 0, accuracy: 0 };
      status = t('map.passed').replace('{wpm}', b.wpm).replace('{acc}', b.accuracy);
    } else if (state === 'current') {
      status = t('map.next');
    } else {
      status = t('map.locked').replace('{n}', i);
    }
    g.dataset.name = name;
    g.dataset.desc = `${t('course.target')} ${lesson.accuracy}% · ${lesson.wpm} WPM`;
    g.dataset.status = status;
    g.setAttribute('aria-label', `${name}. ${status}`);
    if (state === 'locked') g.setAttribute('aria-disabled', 'true');

    if (state === 'current') g.appendChild(el('circle', { class: 'lm-pulse', r: NODE_R + 5 }));
    g.appendChild(el('circle', { class: 'lm-disc', r: NODE_R }));
    const glyph = nodeGlyph(lesson);
    g.appendChild(el('text', {
      class: 'lm-glyph', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': glyph.length > 2 ? 10 : 13,
    }, glyph));
    g.appendChild(el('text', { class: 'lm-num', y: NODE_R + 11, 'text-anchor': 'middle' }, String(i + 1)));
    if (state === 'passed') {
      g.appendChild(el('circle', { class: 'lm-badge', cx: 12, cy: -12, r: 6 }));
      g.appendChild(el('path', { class: 'lm-check', d: 'M 9 -12 L 11.3 -9.7 L 15 -14' }));
    } else if (state === 'locked') {
      g.appendChild(el('rect', { class: 'lm-lock', x: 8, y: -15, width: 9, height: 7, rx: 1.5 }));
      g.appendChild(el('path', { class: 'lm-lock-arc', d: 'M 10 -15 V -17 A 2.5 2.5 0 0 1 15 -17 V -15' }));
    }
    svg.appendChild(g);
  });

  box.replaceChildren(svg);
  // Keep the next lesson in view when the map scrolls (narrow screens)
  const node = layout.nodes[current];
  if (node && box.scrollHeight > box.clientHeight) {
    box.scrollTop = Math.max(0, node.y - box.clientHeight / 2);
  }
}

function startFrom(target) {
  const node = target.closest('.lm-node');
  if (!node || !node.classList.contains('unlocked')) return;
  hideTooltip();
  onStartLesson(currentMapLang(), Number(node.dataset.index));
}

/**
 * Wire the map once.
 * @param {{ onStart: (lang:string, index:number) => void }} opts
 */
export function initLevelMap({ onStart }) {
  onStartLesson = onStart;
  const box = $('lm-scroll');
  if (!box) return;
  attachAchievementTooltips(box, '.lm-node');
  box.addEventListener('click', e => startFrom(e.target));
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startFrom(e.target);
    }
  });
  document.querySelectorAll('#level-map .lm-lang').forEach(b => {
    b.addEventListener('click', () => {
      mapLang = b.dataset.lang;
      const mode = $('mode');
      // Picking a tab while a course is selected switches the course too
      if (mode && mode.value.startsWith('course-')) {
        mode.value = 'course-' + mapLang;
        mode.dispatchEvent(new Event('change'));
      }
      renderLevelMap();
    });
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (box.clientWidth && box.clientWidth !== lastWidth) renderLevelMap();
    }).observe(box);
  }
  renderLevelMap();
}
