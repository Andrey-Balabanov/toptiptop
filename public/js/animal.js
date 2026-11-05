/* Typing buddy: an animal standing on the current letter of the one-line strip.
 *
 * Every correct key moves it to the next letter — it walks when you type
 * slowly, runs at a medium pace and jumps when you are fast — and the faster
 * you type, the more frightened its eyes get. A wrong key makes it flinch.
 * The animals are inline SVG with shared class hooks for the face, so the
 * fear levels are pure CSS (see "TYPING BUDDY" in style.css). The head, tail
 * and the knees are separate groups so they move on their own: the head nods
 * with each stride, the tail wags, the front legs fly up on a mistake.
 */

export const ANIMALS = ['alpaca', 'sheep', 'giraffe', 'owl', 'pigeon', 'mantis', 'cat', 'dog'];

/** How each animal gets about: the owl flies, the mantis scurries, the rest walk
 *  (and speed up to a run or a jump when you type fast). */
export const MOVES = {
  alpaca: 'walk', sheep: 'walk', giraffe: 'walk', cat: 'walk', dog: 'walk',
  pigeon: 'strut', owl: 'fly', mantis: 'run',
};

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

/** Gait for the typing speed. `move` is the animal's way of moving (MOVES):
 *  a flyer always flies, a pigeon never jumps, a mantis never just walks. */
export function gaitFor(wpm, move = 'walk') {
  if (move === 'fly') return 'fly';
  if (wpm >= 55 && move !== 'strut') return 'jump';
  if (wpm >= 30 || move === 'run') return 'run';
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
function face({ eye, eye2, r = 2.6, mouth, sweat, brow, skin }) {
  const k = r / 2.6;
  const oneEye = ([x, y]) => `
        <circle class="an-sclera" cx="${x}" cy="${y}" r="${r}" />
        <circle class="an-pupil" cx="${x + 0.6 * k}" cy="${y}" r="${1.4 * k}" />
        <circle class="an-glint" cx="${x + 1.1 * k}" cy="${y - 0.7 * k}" r="${0.45 * k}" />
        <circle class="an-lid" cx="${x}" cy="${y}" r="${r + 0.3}" fill="${skin}" />`;
  return `
    <g class="an-face">
      <g class="an-eye">${oneEye(eye)}${eye2 ? oneEye(eye2) : ''}
      </g>
      <!-- after the eye so the widened eye never covers it -->
      <path class="an-brow" d="M${brow[0]} ${brow[1]} l5 -1.2" />
      ${eye2 ? `<path class="an-brow" d="M${brow[0] - (eye[0] - eye2[0])} ${brow[1] - 1.2} l5 1.2" />` : ''}
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

/** Each leg bends at the knee: the thigh swings from the hip, the shin from the knee. */
function legs(xs, top, bottom, color, hoof, { w = 3.6, roles, foot } = {}) {
  const knee = top + (bottom - top) / 2;
  const rx = Math.min(1.6, w / 2);
  const hoofAt = x => `<rect x="${x - 0.2}" y="${bottom - 2.4}" width="${w + 0.4}" height="2.6" rx="1" fill="${hoof}" />`;
  return xs.map((x, i) => `
    <g class="an-leg ${roles ? roles[i] : `${i < 2 ? 'back' : 'front'} ${i % 2 ? 'b' : 'a'}`}">
      <rect x="${x}" y="${top}" width="${w}" height="${knee - top + 1.6}" rx="${rx}" fill="${color}" />
      <g class="an-shin">
        <rect x="${x}" y="${knee}" width="${w}" height="${bottom - knee}" rx="${rx}" fill="${color}" />
        ${foot ? foot(x, bottom, w) : hoofAt(x)}
      </g>
    </g>`).join('');
}

/** Bird toes: three short claws pointing forward from the bottom of the leg. */
const toes = color => (x, bottom, w) => {
  const cx = x + w / 2;
  return `<path d="M${cx} ${bottom} l3 0.2 M${cx} ${bottom} l2.4 -1.2 M${cx} ${bottom} l-1.8 0.3" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round" />`;
};

/** A wing hanging from the shoulder; it flaps up around that point. */
function wing(pivot, cls, parts) {
  return `<g class="an-wing ${cls}" style="transform-origin: ${pivot[0]}px ${pivot[1]}px">${parts}</g>`;
}

/** Head and face turn together around the top of the neck (`pivot`, in viewBox units). */
function head(pivot, parts, faceOpts) {
  return `<g class="an-head" style="transform-origin: ${pivot[0]}px ${pivot[1]}px">${parts}${face(faceOpts)}</g>`;
}

const ART = {
  alpaca: () => `
    ${legs([13, 18.5, 29, 34.5], 42, 58, '#e8d5b0', '#7a5c3e')}
    <g class="an-tail" style="transform-origin: 11px 31px"><ellipse cx="9" cy="31" rx="3.4" ry="4" fill="#f3e6cc" /></g>
    <g class="an-body">
      <ellipse cx="24" cy="36" rx="15" ry="9.5" fill="#f3e6cc" stroke="#d9c39a" stroke-width="1" />
      <path d="M12 30 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0" fill="none" stroke="#d9c39a" stroke-width="1" />
      <rect x="32" y="12" width="9" height="24" rx="4.5" fill="#f3e6cc" stroke="#d9c39a" stroke-width="1" />
    </g>
    ${head([36.5, 18], `
      <ellipse cx="39" cy="5.5" rx="1.6" ry="3.4" fill="#e3cfa6" transform="rotate(-12 39 5.5)" />
      <ellipse cx="43" cy="5" rx="1.6" ry="3.4" fill="#e3cfa6" transform="rotate(10 43 5)" />
      <ellipse cx="42" cy="13" rx="8.5" ry="6.8" fill="#f3e6cc" stroke="#d9c39a" stroke-width="1" />
      <path d="M36 8.5 q3 -3.5 7 -1 q3 -2 4 1" fill="#fff8ea" stroke="#d9c39a" stroke-width="0.8" />
      <ellipse cx="48.5" cy="15.5" rx="3.6" ry="2.8" fill="#e8d5b0" />
      <circle cx="50.2" cy="14.6" r="0.6" fill="#7a5c3e" />`,
    { eye: [44, 12], mouth: [48.6, 17.4], sweat: [37.5, 6.5], brow: [41.3, 8.6], skin: '#f3e6cc' })}`,

  sheep: () => `
    ${legs([15, 20.5, 29, 34.5], 43, 58, '#6b6678', '#3d3a45')}
    <g class="an-tail" style="transform-origin: 10px 34px"><circle cx="7.5" cy="33" r="2.8" fill="#f7f7f5" stroke="#d6d6d0" stroke-width="1" /></g>
    <g class="an-body">
      <g fill="#f7f7f5" stroke="#d6d6d0" stroke-width="1">
        <circle cx="14" cy="34" r="7" /><circle cx="22" cy="29" r="8" /><circle cx="31" cy="30" r="7.5" />
        <circle cx="36" cy="37" r="6.5" /><circle cx="25" cy="39" r="8" /><circle cx="15" cy="40" r="6" />
      </g>
    </g>
    ${head([39, 28], `
      <ellipse cx="38.5" cy="21" rx="2" ry="4" fill="#3d3a45" transform="rotate(-50 38.5 21)" />
      <ellipse cx="45" cy="25" rx="7.2" ry="6.4" fill="#3d3a45" />
      <g fill="#f7f7f5" stroke="#d6d6d0" stroke-width="0.8">
        <circle cx="42" cy="19.5" r="3" /><circle cx="46" cy="18.5" r="2.8" />
      </g>
      <circle cx="50.3" cy="26.6" r="0.6" fill="#1b1a20" />`,
    { eye: [46.5, 23.5], mouth: [49.2, 28.6], sweat: [41.5, 16.5], brow: [43.8, 20.4], skin: '#3d3a45' })}`,

  giraffe: () => `
    ${legs([13.5, 18.5, 26, 31], 38, 58, '#f2c14e', '#6b4a22')}
    <g class="an-tail" style="transform-origin: 9px 31px">
      <path d="M8 31 q-3 4 -1 9" fill="none" stroke="#c98a2e" stroke-width="1.6" stroke-linecap="round" />
    </g>
    <g class="an-body">
      <ellipse cx="22" cy="34" rx="13" ry="7.5" fill="#f2c14e" stroke="#d9a53a" stroke-width="1" />
      <path d="M29 33 L37 12 L43 13 L35 35 Z" fill="#f2c14e" stroke="#d9a53a" stroke-width="1" stroke-linejoin="round" />
      <path d="M33 13 q2 6 0 14" fill="none" stroke="#8a5a24" stroke-width="2" stroke-linecap="round" />
      <g fill="#b9772c">
        <ellipse cx="16" cy="33" rx="2.6" ry="2" /><ellipse cx="23" cy="31" rx="2.2" ry="1.8" />
        <ellipse cx="27" cy="36.5" rx="2.4" ry="1.7" /><ellipse cx="19" cy="38" rx="2" ry="1.5" />
        <ellipse cx="37.5" cy="22" rx="1.6" ry="1.3" /><ellipse cx="35.5" cy="28" rx="1.4" ry="1.2" />
      </g>
    </g>
    ${head([40, 13], `
      <rect x="40" y="0.5" width="1.6" height="5" rx="0.8" fill="#8a5a24" /><circle cx="40.8" cy="0.8" r="1.2" fill="#6b4a22" />
      <rect x="43.5" y="1" width="1.6" height="5" rx="0.8" fill="#8a5a24" /><circle cx="44.3" cy="1.2" r="1.2" fill="#6b4a22" />
      <ellipse cx="37.5" cy="7" rx="1.4" ry="2.6" fill="#f2c14e" transform="rotate(-40 37.5 7)" />
      <ellipse cx="44" cy="9.5" rx="7.5" ry="4.6" fill="#f2c14e" stroke="#d9a53a" stroke-width="1" />
      <ellipse cx="49.5" cy="11" rx="3" ry="2.5" fill="#e3ae3c" />
      <circle cx="51" cy="10.2" r="0.55" fill="#6b4a22" />`,
    { eye: [44.5, 8], mouth: [49.3, 12.6], sweat: [38.5, 2.5], brow: [41.8, 4.8], skin: '#f2c14e' })}`,

  /* Owl: perched on the letter; typing makes it take off and flap (CSS: .buddy.airborne) */
  owl: () => `
    ${wing([32, 31], 'far', `<ellipse cx="34.5" cy="40" rx="4.2" ry="9.5" fill="#5c3d26" transform="rotate(-8 34.5 40)" />`)}
    ${legs([27.5, 32.5], 50, 58, '#e8d2a8', '', { w: 2.6, roles: ['back a', 'back b'], foot: toes('#4a3a2a') })}
    <g class="an-tail" style="transform-origin: 23px 50px"><path d="M24 48 L16.5 57 L22.5 57.5 L27.5 50 Z" fill="#5c3d26" /></g>
    <g class="an-body">
      <ellipse cx="30" cy="41" rx="11" ry="12" fill="#8b6142" stroke="#6e4b31" stroke-width="1" />
      <ellipse cx="33" cy="43" rx="7" ry="9" fill="#e8d2a8" />
      <path d="M30.5 38 l1.2 1.2 l1.2 -1.2 M34 40 l1.2 1.2 l1.2 -1.2 M30.5 43 l1.2 1.2 l1.2 -1.2 M34 45.5 l1.2 1.2 l1.2 -1.2 M31.5 48 l1.2 1.2 l1.2 -1.2"
        fill="none" stroke="#8b6142" stroke-width="0.8" stroke-linecap="round" />
    </g>
    ${wing([25, 31], 'near', `
      <ellipse cx="24" cy="41" rx="5" ry="10.5" fill="#7a5235" stroke="#5c3d26" stroke-width="0.8" transform="rotate(8 24 41)" />
      <path d="M21 44 q2 3 5 2 M21.5 48 q2 2.5 4.5 1.5" fill="none" stroke="#e8d2a8" stroke-width="0.7" stroke-linecap="round" />`)}
    ${head([31, 31], `
      <path d="M22.5 17 L21.5 7 L28.5 13 Z" fill="#8b6142" stroke="#6e4b31" stroke-width="0.8" stroke-linejoin="round" />
      <path d="M35 12.5 L39.5 5.5 L40 15 Z" fill="#8b6142" stroke="#6e4b31" stroke-width="0.8" stroke-linejoin="round" />
      <ellipse cx="31" cy="21" rx="10" ry="9.5" fill="#8b6142" stroke="#6e4b31" stroke-width="1" />
      <ellipse cx="34.3" cy="21.8" rx="7.6" ry="6.6" fill="#e8d2a8" />
      <path d="M34.4 23.4 h2.2 l-1.1 3.4 z" fill="#e0a630" />`,
    { eye: [38, 20.8], eye2: [31.2, 20.8], r: 3, mouth: [35.5, 28.4], sweat: [24.5, 15], brow: [35.6, 16.6], skin: '#c9a77a' })}`,

  /* Pigeon: struts on two legs, its head bobbing back and forth with every step */
  pigeon: () => `
    ${legs([25, 30], 47, 58, '#d86a74', '', { w: 1.6, roles: ['back a', 'back b'], foot: toes('#d86a74') })}
    <g class="an-tail" style="transform-origin: 16px 41px">
      <path d="M17 37.5 L4.5 39.5 L4.5 45 L17 44 Z" fill="#7d8496" />
      <path d="M6.8 39.2 L4.5 39.5 L4.5 45 L6.8 44.8 Z" fill="#3c4050" />
    </g>
    <g class="an-body">
      <ellipse cx="27" cy="40.5" rx="13" ry="8.5" fill="#a3abbd" stroke="#8a92a5" stroke-width="1" transform="rotate(-12 27 40.5)" />
      <path d="M33.5 37 Q34 28 38.5 25 L44 27 Q41.5 33 42 41 Z" fill="#5aa58a" />
      <path d="M36.5 26 L44 27 Q41.5 31 41.6 34.5 Q38 31 36.5 26 Z" fill="#8a6bb0" opacity="0.75" />
    </g>
    ${wing([24, 35], 'near', `
      <ellipse cx="25" cy="39.5" rx="9.5" ry="5" fill="#929aae" stroke="#7c8396" stroke-width="0.8" transform="rotate(-12 25 39.5)" />
      <path d="M21 38.5 q3 2 6.5 0.5 M20.5 41.8 q3 2 6.5 0.5" fill="none" stroke="#3c4050" stroke-width="1.2" stroke-linecap="round" />`)}
    ${head([40, 29], `
      <circle cx="41.5" cy="23" r="5" fill="#a3abbd" stroke="#8a92a5" stroke-width="0.8" />
      <path d="M46.2 22.6 l3.6 1.1 l-3.6 1.1 z" fill="#4a4550" />
      <ellipse cx="46.6" cy="22.3" rx="1" ry="0.6" fill="#f2f2f2" />`,
    { eye: [43.3, 21.8], r: 1.8, mouth: [47.6, 26.2], sweat: [38, 16], brow: [41.2, 19.4], skin: '#a3abbd' })}`,

  /* Praying mantis: six thin legs that scurry; the folded front claws fly up on a mistake */
  mantis: () => `
    ${legs([16, 20, 27.5, 31], 44, 58, '#6fa832', '', {
      w: 1.4, roles: ['back a', 'back b', 'mid a', 'mid b'],
      foot: (x, bottom, w) => `<path d="M${x + w / 2} ${bottom - 0.3} l1.8 0.4" stroke="#5f8f24" stroke-width="0.9" stroke-linecap="round" />`,
    })}
    <g class="an-tail" style="transform-origin: 28px 42px">
      <ellipse cx="18" cy="43" rx="12" ry="4.2" fill="#8cc63f" stroke="#5f8f24" stroke-width="0.8" transform="rotate(-6 18 43)" />
      <path d="M12 40 q-0.6 3.4 0.4 6.6 M16 39.6 q-0.6 3.6 0.4 7 M20 39.4 q-0.6 3.6 0.4 7" fill="none" stroke="#6fa832" stroke-width="0.6" />
    </g>
    <g class="an-body">
      <ellipse cx="20" cy="40.8" rx="11" ry="2.6" fill="#b5dc78" stroke="#8cc63f" stroke-width="0.5" opacity="0.9" transform="rotate(-8 20 40.8)" />
      <path d="M27 42.5 L38 26.5 L41 28.5 L31 44.5 Z" fill="#8cc63f" stroke="#5f8f24" stroke-width="0.8" stroke-linejoin="round" />
    </g>
    ${[['#6fa832', 1.6], ['#8cc63f', 0]].map(([c, dx]) => `
      <g class="an-leg front claw">
        <rect x="${37.5 + dx}" y="29" width="2" height="8.5" rx="1" fill="${c}" transform="rotate(-25 ${38.5 + dx} 29)" />
        <g class="an-shin">
          <rect x="${41.5 + dx}" y="36.3" width="1.8" height="7.5" rx="0.9" fill="${c}" transform="rotate(-150 ${42.4 + dx} 36.3)" />
        </g>
      </g>`).join('')}
    ${head([40, 27], `
      <path d="M42 18.5 q3 -8 11 -12 M43.5 18.5 q2 -8 7.5 -13.5" fill="none" stroke="#5f8f24" stroke-width="0.6" stroke-linecap="round" />
      <path d="M37.5 20 Q42.5 16.5 48 20.5 L43.8 28.5 Z" fill="#8cc63f" stroke="#5f8f24" stroke-width="0.8" stroke-linejoin="round" />`,
    { eye: [44.6, 20.6], r: 2.3, mouth: [44.2, 26.6], sweat: [37, 13.5], brow: [42.2, 17.4], skin: '#8cc63f' })}`,

  /* Cat: an orange tabby with its tail up */
  cat: () => `
    ${legs([14, 19, 30, 35], 41, 58, '#f0a35e', '#fbe3c8', { w: 3.2 })}
    <g class="an-tail" style="transform-origin: 11px 36px">
      <path d="M11.5 36 q-7 -2 -6.5 -12 q0.6 -6 5 -7.5" fill="none" stroke="#f0a35e" stroke-width="3.2" stroke-linecap="round" />
      <path d="M6.3 27 l2.6 -0.4 M6.6 22.2 l2.4 0.6" stroke="#c9773a" stroke-width="1.1" stroke-linecap="round" />
    </g>
    <g class="an-body">
      <ellipse cx="25" cy="38" rx="15" ry="7.5" fill="#f0a35e" stroke="#d5843f" stroke-width="1" />
      <ellipse cx="27" cy="42.3" rx="10" ry="2.6" fill="#fbe3c8" />
      <path d="M18 31.5 q1 3 0 6 M23 30.6 q1 3 0 6.4 M28 30.6 q1 3 0 6.4" fill="none" stroke="#c9773a" stroke-width="1.4" stroke-linecap="round" />
    </g>
    ${head([38, 32], `
      <path d="M38.2 20 L39.4 11.5 L43.5 17.4 Z" fill="#f0a35e" stroke="#d5843f" stroke-width="0.8" stroke-linejoin="round" />
      <path d="M39.6 18 L40.1 14 L42 16.8 Z" fill="#f5a3ad" />
      <path d="M45.5 17 L49.4 10.8 L50.8 19 Z" fill="#f0a35e" stroke="#d5843f" stroke-width="0.8" stroke-linejoin="round" />
      <path d="M47 17 L49 13.6 L49.7 17.8 Z" fill="#f5a3ad" />
      <circle cx="44" cy="24" r="7.5" fill="#f0a35e" stroke="#d5843f" stroke-width="1" />
      <path d="M41.5 17.4 v2.4 M43.6 16.8 v2.6" stroke="#c9773a" stroke-width="1" stroke-linecap="round" />
      <ellipse cx="49" cy="27" rx="3.3" ry="2.4" fill="#fbe3c8" />
      <path d="M50.4 25.4 h2 l-1 1.2 z" fill="#e7808c" />
      <path d="M50.5 27.3 l5.5 -1.2 M50.5 28 l5.5 0.8" stroke="#8a5a2e" stroke-width="0.35" stroke-linecap="round" />`,
    { eye: [46, 22.4], mouth: [49.6, 29], sweat: [39, 15.5], brow: [43.4, 18.8], skin: '#f0a35e' })}`,

  /* Dog: a brown pup with floppy ears and a red collar */
  dog: () => `
    ${legs([14, 19.5, 29.5, 35], 42, 58, '#c98d52', '#f4e3cc')}
    <g class="an-tail" style="transform-origin: 10px 33px">
      <path d="M10.5 33 q-4.5 -4 -3.4 -11" fill="none" stroke="#c98d52" stroke-width="3" stroke-linecap="round" />
      <circle cx="7.2" cy="22" r="1.6" fill="#f4e3cc" />
    </g>
    <g class="an-body">
      <ellipse cx="24" cy="37" rx="15" ry="8" fill="#c98d52" stroke="#a8713e" stroke-width="1" />
      <ellipse cx="26" cy="42" rx="9" ry="2.8" fill="#f4e3cc" />
      <ellipse cx="20" cy="33" rx="7" ry="4" fill="#7a4f2a" />
      <rect x="34" y="24" width="8" height="15" rx="4" fill="#c98d52" stroke="#a8713e" stroke-width="1" />
      <rect x="33.4" y="29" width="9.2" height="2.4" rx="1.1" fill="#e04848" />
      <circle cx="38" cy="32.8" r="1.1" fill="#f2c14e" />
    </g>
    ${head([38, 27], `
      <ellipse cx="43" cy="22" rx="7" ry="6.3" fill="#c98d52" stroke="#a8713e" stroke-width="1" />
      <ellipse cx="49.5" cy="25" rx="4.5" ry="3.2" fill="#f4e3cc" />
      <ellipse cx="53.4" cy="23.6" rx="1.5" ry="1.2" fill="#2a1d14" />
      <ellipse cx="39.5" cy="23" rx="2.6" ry="5.5" fill="#7a4f2a" transform="rotate(15 39.5 23)" />`,
    { eye: [45, 20], mouth: [50, 27.6], sweat: [38, 13], brow: [42.5, 16.6], skin: '#c98d52' })}`,
};

export function animalSVG(kind) {
  const name = ART[kind] ? kind : 'alpaca';
  return `<svg class="buddy-svg kind-${name}" viewBox="0 0 60 60" aria-hidden="true" focusable="false"><g class="an-fly">${ART[name]()}</g></svg>`;
}

/** Hop / stride keyframes per gait (the animal stays in place; the text slides under it). */
const GAITS = {
  walk: { ms: 230, lift: -3, lean: 2 },
  run: { ms: 170, lift: -6, lean: 6 },
  jump: { ms: 150, lift: -13, lean: 10 },
  fly: { ms: 220, lift: -3, lean: 4 },
};

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/**
 * The animal on the strip.
 * @param {HTMLElement} host   - element the animal is drawn in (positioned over the current letter)
 * @param {HTMLElement[]} slide - elements that slide one letter left on each step (the strip halves)
 * @param {HTMLElement} [scene] - scenery whose layers scroll by the step count (CSS var --walk)
 */
export class TypingBuddy {
  constructor(host, slide = [], scene = null) {
    this.host = host;
    this.slide = slide;
    this.scene = scene;
    this.walked = 0;
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
    this.move = MOVES[this.kind] || 'walk';
    this.host.dataset.kind = this.kind || '';
    this.host.dataset.move = this.move;
    this.host.classList.remove('airborne');
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
    const gait = gaitFor(wpm, this.move);
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
    // A flyer takes off, hovers while you keep typing and lands on the letter after a pause
    if (gait === 'fly') {
      this.host.classList.add('airborne');
      clearTimeout(this.landTimer);
      this.landTimer = setTimeout(() => this.host.classList.remove('airborne'), 900);
    }
    this.host.querySelector('.buddy-svg')?.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: `translateY(${g.lift}px) rotate(${g.lean}deg)`, offset: 0.45 },
      { transform: 'translateY(0) rotate(0deg)' },
    ], { duration: g.ms, easing: 'ease-out' });
    // The scenery scrolls on too, each layer at its own speed (parallax, CSS: .scenery)
    if (this.scene) {
      this.walked++;
      this.scene.style.setProperty('--step-ms', `${g.ms}ms`);
      this.scene.style.setProperty('--walk', String(this.walked));
    }
    // The letters slide one place left under the animal: it looks like it moved on
    for (const el of this.slide) {
      el.animate([{ transform: 'translateX(1ch)' }, { transform: 'translateX(0)' }], { duration: g.ms, easing: 'ease-out' });
    }
  }

  flinch() {
    if (prefersReducedMotion() || typeof this.host.animate !== 'function') return;
    // Throws its front legs up and pulls its head back (CSS: .buddy.oops)
    this.host.classList.remove('oops');
    void this.host.offsetWidth; // restart the animation on quick repeated mistakes
    this.host.classList.add('oops');
    clearTimeout(this.oopsTimer);
    this.oopsTimer = setTimeout(() => this.host.classList.remove('oops'), 500);
    this.host.querySelector('.buddy-svg')?.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-4px) rotate(-6deg)' },
      { transform: 'translateX(3px) rotate(4deg)' }, { transform: 'translateX(0)' },
    ], { duration: 260 });
  }
}
