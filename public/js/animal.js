/* Typing buddy: an animal standing on the current letter of the one-line strip.
 *
 * Every correct key moves it to the next letter — it walks when you type
 * slowly, runs at a medium pace and jumps when you are fast — and the faster
 * you type, the more frightened its eyes get. A wrong key makes it flinch.
 * The animals are inline SVG with shared class hooks for the face, so the
 * fear levels are pure CSS (see "TYPING BUDDY" in style.css).
 */

export const ANIMALS = ['alpaca', 'sheep', 'giraffe'];

/** Speed window: WPM is measured over the keystrokes of the last few seconds. */
const WINDOW_MS = 3000;
/** Without typing it gets bored (looks around) and later falls asleep. */
export const BORED_AFTER_MS = 3000;
export const SLEEPY_AFTER_MS = 10000;

/** 0 calm · 1 alert · 2 scared · 3 terrified */
export function fearLevel(wpm) {
  if (wpm >= 80) return 3;
  if (wpm >= 55) return 2;
  if (wpm >= 30) return 1;
  return 0;
}

export function gaitFor(wpm) {
  if (wpm >= 55) return 'jump';
  if (wpm >= 30) return 'run';
  return 'walk';
}

/** WPM from keystroke timestamps (ms) within the last WINDOW_MS before `now`. */
export function recentWpm(times, now) {
  const recent = times.filter(t => now - t <= WINDOW_MS);
  if (recent.length < 2) return 0;
  const span = Math.max(now - recent[0], 400);
  return Math.round(((recent.length / 5) / span) * 60000);
}

/* ---------- artwork (viewBox 0 0 60 60, facing right, feet at y≈58) ---------- */

/** Eye, brow, sweat drops and both mouths — the parts the fear levels change —
 *  plus an eyelid (blinking / sleepy, coloured like the head) and the sleep "z z z". */
function face({ eye, mouth, sweat, brow, skin }) {
  return `
    <g class="an-face">
      <g class="an-eye">
        <circle class="an-sclera" cx="${eye[0]}" cy="${eye[1]}" r="2.6" />
        <circle class="an-pupil" cx="${eye[0] + 0.6}" cy="${eye[1]}" r="1.4" />
        <circle class="an-glint" cx="${eye[0] + 1.1}" cy="${eye[1] - 0.7}" r="0.45" />
        <circle class="an-lid" cx="${eye[0]}" cy="${eye[1]}" r="2.9" fill="${skin}" />
      </g>
      <!-- after the eye so the widened eye never covers it -->
      <path class="an-brow" d="M${brow[0]} ${brow[1]} l5 -1.2" />
      <path class="an-mouth an-mouth-calm" d="M${mouth[0] - 2} ${mouth[1]} q2 1.6 4 0" />
      <ellipse class="an-mouth an-mouth-scared" cx="${mouth[0]}" cy="${mouth[1] + 0.4}" rx="1.3" ry="1.7" />
      <path class="an-sweat an-sweat-1" d="M${sweat[0]} ${sweat[1]} q-1.6 2.6 0 3.4 q1.6 -0.8 0 -3.4z" />
      <path class="an-sweat an-sweat-2" d="M${sweat[0] - 4} ${sweat[1] + 3} q-1.3 2.1 0 2.8 q1.3 -0.7 0 -2.8z" />
      <g class="an-zzz">
        <text class="z1" x="${eye[0] + 4}" y="${eye[1] - 5}">z</text>
        <text class="z2" x="${eye[0] + 8}" y="${eye[1] - 10}">z</text>
        <text class="z3" x="${eye[0] + 12}" y="${eye[1] - 15}">Z</text>
      </g>
    </g>`;
}

function legs(xs, top, bottom, color, hoof) {
  return xs.map((x, i) => `
    <g class="an-leg ${i < 2 ? 'back' : 'front'} ${i % 2 ? 'b' : 'a'}">
      <rect x="${x}" y="${top}" width="3.6" height="${bottom - top}" rx="1.6" fill="${color}" />
      <rect x="${x - 0.2}" y="${bottom - 2.4}" width="4" height="2.6" rx="1" fill="${hoof}" />
    </g>`).join('');
}

const ART = {
  alpaca: () => `
    ${legs([13, 18.5, 29, 34.5], 42, 58, '#e8d5b0', '#7a5c3e')}
    <g class="an-body">
      <ellipse cx="9" cy="31" rx="3.4" ry="4" fill="#f3e6cc" />
      <ellipse cx="24" cy="36" rx="15" ry="9.5" fill="#f3e6cc" stroke="#d9c39a" stroke-width="1" />
      <path d="M12 30 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0" fill="none" stroke="#d9c39a" stroke-width="1" />
      <rect x="32" y="12" width="9" height="24" rx="4.5" fill="#f3e6cc" stroke="#d9c39a" stroke-width="1" />
      <ellipse cx="39" cy="5.5" rx="1.6" ry="3.4" fill="#e3cfa6" transform="rotate(-12 39 5.5)" />
      <ellipse cx="43" cy="5" rx="1.6" ry="3.4" fill="#e3cfa6" transform="rotate(10 43 5)" />
      <ellipse cx="42" cy="13" rx="8.5" ry="6.8" fill="#f3e6cc" stroke="#d9c39a" stroke-width="1" />
      <path d="M36 8.5 q3 -3.5 7 -1 q3 -2 4 1" fill="#fff8ea" stroke="#d9c39a" stroke-width="0.8" />
      <ellipse cx="48.5" cy="15.5" rx="3.6" ry="2.8" fill="#e8d5b0" />
      <circle cx="50.2" cy="14.6" r="0.6" fill="#7a5c3e" />
    </g>
    ${face({ eye: [44, 12], mouth: [48.6, 17.4], sweat: [37.5, 6.5], brow: [41.3, 8.6], skin: '#f3e6cc' })}`,

  sheep: () => `
    ${legs([15, 20.5, 29, 34.5], 43, 58, '#6b6678', '#3d3a45')}
    <g class="an-body">
      <g fill="#f7f7f5" stroke="#d6d6d0" stroke-width="1">
        <circle cx="14" cy="34" r="7" /><circle cx="22" cy="29" r="8" /><circle cx="31" cy="30" r="7.5" />
        <circle cx="36" cy="37" r="6.5" /><circle cx="25" cy="39" r="8" /><circle cx="15" cy="40" r="6" />
      </g>
      <ellipse cx="38.5" cy="21" rx="2" ry="4" fill="#3d3a45" transform="rotate(-50 38.5 21)" />
      <ellipse cx="45" cy="25" rx="7.2" ry="6.4" fill="#3d3a45" />
      <g fill="#f7f7f5" stroke="#d6d6d0" stroke-width="0.8">
        <circle cx="42" cy="19.5" r="3" /><circle cx="46" cy="18.5" r="2.8" />
      </g>
      <circle cx="50.3" cy="26.6" r="0.6" fill="#1b1a20" />
    </g>
    ${face({ eye: [46.5, 23.5], mouth: [49.2, 28.6], sweat: [41.5, 16.5], brow: [43.8, 20.4], skin: '#3d3a45' })}`,

  giraffe: () => `
    ${legs([13.5, 18.5, 26, 31], 38, 58, '#f2c14e', '#6b4a22')}
    <g class="an-body">
      <path d="M8 31 q-3 4 -1 9" fill="none" stroke="#c98a2e" stroke-width="1.6" stroke-linecap="round" />
      <ellipse cx="22" cy="34" rx="13" ry="7.5" fill="#f2c14e" stroke="#d9a53a" stroke-width="1" />
      <path d="M29 33 L37 12 L43 13 L35 35 Z" fill="#f2c14e" stroke="#d9a53a" stroke-width="1" stroke-linejoin="round" />
      <path d="M33 13 q2 6 0 14" fill="none" stroke="#8a5a24" stroke-width="2" stroke-linecap="round" />
      <g fill="#b9772c">
        <ellipse cx="16" cy="33" rx="2.6" ry="2" /><ellipse cx="23" cy="31" rx="2.2" ry="1.8" />
        <ellipse cx="27" cy="36.5" rx="2.4" ry="1.7" /><ellipse cx="19" cy="38" rx="2" ry="1.5" />
        <ellipse cx="37.5" cy="22" rx="1.6" ry="1.3" /><ellipse cx="35.5" cy="28" rx="1.4" ry="1.2" />
      </g>
      <rect x="40" y="0.5" width="1.6" height="5" rx="0.8" fill="#8a5a24" /><circle cx="40.8" cy="0.8" r="1.2" fill="#6b4a22" />
      <rect x="43.5" y="1" width="1.6" height="5" rx="0.8" fill="#8a5a24" /><circle cx="44.3" cy="1.2" r="1.2" fill="#6b4a22" />
      <ellipse cx="37.5" cy="7" rx="1.4" ry="2.6" fill="#f2c14e" transform="rotate(-40 37.5 7)" />
      <ellipse cx="44" cy="9.5" rx="7.5" ry="4.6" fill="#f2c14e" stroke="#d9a53a" stroke-width="1" />
      <ellipse cx="49.5" cy="11" rx="3" ry="2.5" fill="#e3ae3c" />
      <circle cx="51" cy="10.2" r="0.55" fill="#6b4a22" />
    </g>
    ${face({ eye: [44.5, 8], mouth: [49.3, 12.6], sweat: [38.5, 2.5], brow: [41.8, 4.8], skin: '#f2c14e' })}`,
};

export function animalSVG(kind) {
  const draw = ART[kind] || ART.alpaca;
  return `<svg class="buddy-svg" viewBox="0 0 60 60" aria-hidden="true" focusable="false">${draw()}</svg>`;
}

/** Hop / stride keyframes per gait (the animal stays in place; the text slides under it). */
const GAITS = {
  walk: { ms: 230, lift: -3, lean: 2 },
  run: { ms: 170, lift: -6, lean: 6 },
  jump: { ms: 150, lift: -13, lean: 10 },
};

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/**
 * The animal on the strip.
 * @param {HTMLElement} host   - element the animal is drawn in (positioned over the current letter)
 * @param {HTMLElement[]} slide - elements that slide one letter left on each step (the strip halves)
 */
export class TypingBuddy {
  constructor(host, slide = []) {
    this.host = host;
    this.slide = slide;
    this.times = [];
    this.kind = null;
    this.calmTimer = null;
    this.idleTimers = [];
  }

  /** Restart the boredom clock: bored after a pause, asleep after a longer one. */
  scheduleIdle() {
    this.idleTimers.forEach(clearTimeout);
    this.host.dataset.idle = '';
    if (!this.kind) return;
    this.idleTimers = [
      setTimeout(() => { this.host.dataset.idle = 'bored'; }, BORED_AFTER_MS),
      setTimeout(() => { this.host.dataset.idle = 'sleepy'; }, SLEEPY_AFTER_MS),
    ];
  }

  setAnimal(kind) {
    this.kind = ANIMALS.includes(kind) ? kind : null;
    this.host.innerHTML = this.kind ? animalSVG(this.kind) : '';
    this.host.classList.toggle('hidden', !this.kind);
    this.reset();
  }

  reset() {
    this.times = [];
    this.setMood(0, 'walk');
    this.scheduleIdle();
  }

  setMood(fear, gait) {
    this.host.dataset.fear = String(fear);
    this.host.dataset.gait = gait;
  }

  /** Call after every key: `moved` when the cursor advanced to the next letter. */
  step(moved, now = Date.now()) {
    if (!this.kind) return;
    this.scheduleIdle(); // any key wakes it up
    if (!moved) {
      this.flinch();
      return;
    }
    this.times.push(now);
    this.times = this.times.filter(t => now - t <= 3000);
    const wpm = recentWpm(this.times, now);
    const gait = gaitFor(wpm);
    this.setMood(fearLevel(wpm), gait);
    this.animate(gait);
    // Calm down again after a pause in typing
    clearTimeout(this.calmTimer);
    this.calmTimer = setTimeout(() => this.setMood(0, 'walk'), 1600);
  }

  animate(gait) {
    if (prefersReducedMotion() || typeof this.host.animate !== 'function') return;
    const g = GAITS[gait];
    // Legs swing while it keeps moving (CSS: .buddy.moving)
    this.host.classList.add('moving');
    clearTimeout(this.moveTimer);
    this.moveTimer = setTimeout(() => this.host.classList.remove('moving'), g.ms * 2);
    this.host.querySelector('.buddy-svg')?.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: `translateY(${g.lift}px) rotate(${g.lean}deg)`, offset: 0.45 },
      { transform: 'translateY(0) rotate(0deg)' },
    ], { duration: g.ms, easing: 'ease-out' });
    // The letters slide one place left under the animal: it looks like it moved on
    for (const el of this.slide) {
      el.animate([{ transform: 'translateX(1ch)' }, { transform: 'translateX(0)' }], { duration: g.ms, easing: 'ease-out' });
    }
  }

  flinch() {
    if (prefersReducedMotion() || typeof this.host.animate !== 'function') return;
    this.host.querySelector('.buddy-svg')?.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-4px) rotate(-6deg)' },
      { transform: 'translateX(3px) rotate(4deg)' }, { transform: 'translateX(0)' },
    ], { duration: 260 });
  }
}
