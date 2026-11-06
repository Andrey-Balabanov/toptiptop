/* SVG Arrow Overlay Module
 *
 * Draws an animated connecting line from the home-row key of the active finger
 * to the key that must be pressed next. Each line uses the finger's zone colour
 * (CSS custom property --lp…--rp), flows toward the target with an animated
 * dashed stroke, carries a travelling spark and ends with an arrow head
 * pointing at the target key — the tip stops at the key's edge so the letter
 * on it stays visible.
 *
 * Layering invariant
 * ------------------
 * The overlay lives INSIDE the keyboard container and is given an explicit
 * z-index (OVERLAY_Z) that MUST stay strictly greater than the largest z-index
 * used by any key state, so the lines are always painted ON TOP of the keys —
 * above the key fill, its letter, the `.next` highlight and every hit
 * animation:
 *
 *      .key              -> z-index: auto (0)
 *      .key.next         -> z-index: 2
 *      .key.shift.next   -> z-index: 2
 *      .key.combo-hit    -> z-index: 3
 *      .arrow-overlay    -> z-index: OVERLAY_Z = 10   <-- always on top
 *
 * The same value is mirrored in style.css (`.arrow-overlay`). If any key state
 * ever uses z-index >= 10, bump OVERLAY_Z here AND the matching `z-index` on
 * `.arrow-overlay` in style.css.
 *
 * The overlay is pointer-events:none, so typing/clicking the keys underneath
 * is unaffected.
 */

/** SVG namespace used for every overlay node. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Overlay stacking level — keep in sync with `.arrow-overlay` in style.css. */
export const OVERLAY_Z = 10;

/** Last-resort colour used when the finger CSS variable cannot be resolved. */
export const FALLBACK_COLOR = '#7aa2f7';

/** localStorage key holding the user's arrows preference. */
const ARROWS_PREF_KEY = 'toptip-show-arrows';

/**
 * Is the movement-arrows feature enabled?
 *
 * Semantics are OPT-OUT: the feature is ON by default (a fresh user must see
 * the connecting lines without touching any setting) and only an explicit
 * 'false' stored by the user disables it.
 *
 * @returns {boolean}
 */
export function isArrowsEnabled() {
  try {
    return localStorage.getItem(ARROWS_PREF_KEY) !== 'false';
  } catch {
    // localStorage unavailable (private mode, sandbox) — default to enabled
    return true;
  }
}

/**
 * Persist the movement-arrows preference.
 * @param {boolean} enabled
 */
export function setArrowsEnabled(enabled) {
  try {
    localStorage.setItem(ARROWS_PREF_KEY, enabled ? 'true' : 'false');
  } catch {}
}

let svgOverlay = null;
let resizeObserver = null;
let currentKeyboardEl = null;

/**
 * The last arrow request, kept as live element references (NOT as frozen
 * coordinates) so the ResizeObserver can recompute centres from the current
 * layout instead of redrawing stale geometry.
 * @type {{homeKeyEl: Element, targetKeyEl: Element, fingerId: string, keyboardEl: Element}|null}
 */
let lastArrow = null;

function updateOverlaySize() {
  if (!svgOverlay || !currentKeyboardEl) return;
  const w = currentKeyboardEl.scrollWidth;
  const h = currentKeyboardEl.scrollHeight;
  svgOverlay.setAttribute('width', w);
  svgOverlay.setAttribute('height', h);
  svgOverlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgOverlay.style.width = w + 'px';
  svgOverlay.style.height = h + 'px';
}

/** Should decorative motion be suppressed (accessibility)? */
function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function initArrowOverlay(keyboardEl) {
  destroyArrowOverlay();
  currentKeyboardEl = keyboardEl;

  svgOverlay = document.createElementNS(SVG_NS, 'svg');
  svgOverlay.setAttribute('class', 'arrow-overlay');
  svgOverlay.setAttribute('aria-hidden', 'true');
  svgOverlay.style.cssText =
    'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;' +
    'z-index:' + OVERLAY_Z + ';';

  if (getComputedStyle(keyboardEl).position === 'static') {
    keyboardEl.style.position = 'relative';
  }

  keyboardEl.appendChild(svgOverlay);
  updateOverlaySize();

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateOverlaySize();
      // Recompute centres from the live layout — never from cached coords.
      renderArrow();
    });
    resizeObserver.observe(keyboardEl);
  }
}

export function destroyArrowOverlay() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (svgOverlay && svgOverlay.parentNode) {
    svgOverlay.parentNode.removeChild(svgOverlay);
  }
  svgOverlay = null;
  currentKeyboardEl = null;
  lastArrow = null;
}

/**
 * Get the center coordinates of a key element relative to the keyboard SVG overlay.
 */
function getKeyCenter(keyEl, keyboardEl) {
  const keyRect = keyEl.getBoundingClientRect();
  const kbRect = keyboardEl.getBoundingClientRect();
  return {
    x: keyRect.left + keyRect.width / 2 - kbRect.left + keyboardEl.scrollLeft,
    y: keyRect.top + keyRect.height / 2 - kbRect.top + keyboardEl.scrollTop,
    halfW: keyRect.width / 2,
    halfH: keyRect.height / 2,
  };
}

/** Gap (px) left between the arrow tip and the edge of the target key. */
export const TIP_GAP = 2;

/**
 * Where the arrow should end so its head points AT the target key without
 * covering the letter on it: the point where the line from `from` toward the
 * target centre crosses the target key's border, pulled back by TIP_GAP.
 * Falls back to the target centre when the keys overlap or coincide (no room
 * to stop before the border).
 *
 * @param {{x:number,y:number}} from - line start (home key centre)
 * @param {{x:number,y:number,halfW:number,halfH:number}} target
 * @returns {{x:number,y:number}}
 */
export function arrowTipPoint(from, target) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!len || !target.halfW || !target.halfH) return { x: target.x, y: target.y };
  // Fraction of the vector (target -> from) needed to reach the key border.
  const s = Math.min(
    dx ? target.halfW / Math.abs(dx) : Infinity,
    dy ? target.halfH / Math.abs(dy) : Infinity,
  ) + TIP_GAP / len;
  if (s >= 1) return { x: target.x, y: target.y };
  return { x: target.x - dx * s, y: target.y - dy * s };
}

/**
 * Resolve the finger's zone colour from the `:root` CSS custom properties.
 * Falls back to --accent and finally to a hardcoded colour so a line is never
 * silently dropped (e.g. theme not yet applied, unknown finger id).
 *
 * @param {string} fingerId - 'lp'…'rp' | 'tt'
 * @returns {string} a non-empty CSS colour
 */
export function resolveFingerColor(fingerId) {
  const read = (name) => {
    try {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim();
    } catch {
      return '';
    }
  };
  if (fingerId) {
    const direct = read('--' + fingerId);
    if (direct) return direct;
  }
  return read('--accent') || FALLBACK_COLOR;
}

/**
 * (Re)draw the current arrow from `lastArrow`. Safe no-op when nothing is
 * requested or the overlay is not mounted.
 */
function renderArrow() {
  if (!svgOverlay || !lastArrow) return;

  const { homeKeyEl, targetKeyEl, fingerId, keyboardEl } = lastArrow;
  if (!homeKeyEl || !targetKeyEl || !keyboardEl) return;

  clearArrowPaths();

  const color = resolveFingerColor(fingerId);
  const home = getKeyCenter(homeKeyEl, keyboardEl);
  const { x: x1, y: y1 } = home;
  // Stop at the edge of the target key so the head never hides its letter.
  const { x: x2, y: y2 } = arrowTipPoint(home, getKeyCenter(targetKeyEl, keyboardEl));

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'movement-arrow');

  // Set `color` on the group so the CSS glow
  // (`.arrow-overlay .arrow-line { filter: drop-shadow(... currentColor) }`)
  // resolves to the LINE colour instead of the inherited text colour.
  g.style.color = color;

  // --- Origin marker: the finger's home-row position ---
  const origin = document.createElementNS(SVG_NS, 'circle');
  origin.setAttribute('cx', x1);
  origin.setAttribute('cy', y1);
  origin.setAttribute('r', '4');
  origin.setAttribute('fill', color);
  origin.setAttribute('class', 'arrow-origin');
  g.appendChild(origin);

  // --- Dashed arrow line (marching-ants animation) ---
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-dasharray', '7, 5');
  line.setAttribute('class', 'arrow-line');
  g.appendChild(line);

  // --- Arrow head (triangle pointing toward the target) ---
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 11;
  const headAngle = Math.PI / 7;

  const ax = x2 - headLen * Math.cos(angle - headAngle);
  const ay = y2 - headLen * Math.sin(angle - headAngle);
  const bx = x2 - headLen * Math.cos(angle + headAngle);
  const by = y2 - headLen * Math.sin(angle + headAngle);

  const head = document.createElementNS(SVG_NS, 'polygon');
  head.setAttribute('points', `${x2},${y2} ${ax},${ay} ${bx},${by}`);
  head.setAttribute('fill', color);
  head.setAttribute('class', 'arrow-head');
  g.appendChild(head);

  // --- Travelling spark: a dot gliding home → target (SMIL, no JS timers) ---
  if (!prefersReducedMotion()) {
    const spark = document.createElementNS(SVG_NS, 'circle');
    spark.setAttribute('r', '3');
    spark.setAttribute('fill', color);
    spark.setAttribute('class', 'arrow-spark');
    const motion = document.createElementNS(SVG_NS, 'animateMotion');
    motion.setAttribute('dur', '0.9s');
    motion.setAttribute('repeatCount', 'indefinite');
    motion.setAttribute('path', `M ${x1} ${y1} L ${x2} ${y2}`);
    spark.appendChild(motion);
    g.appendChild(spark);
  }

  svgOverlay.appendChild(g);
}

function clearArrowPaths() {
  if (!svgOverlay) return;
  const arrows = svgOverlay.querySelectorAll('.movement-arrow');
  arrows.forEach(el => {
    if (typeof el.remove === 'function') el.remove();
    else if (el.parentNode) el.parentNode.removeChild(el);
  });
}

/**
 * Draw an arrow from the home-row key of a finger to the target key.
 * @param {Element} homeKeyEl  - DOM element of the home-row key
 * @param {Element} targetKeyEl - DOM element of the target key
 * @param {string}  fingerId   - finger identifier (e.g. 'lp', 'ri')
 * @param {Element} keyboardEl - the keyboard container element
 */
export function drawArrow(homeKeyEl, targetKeyEl, fingerId, keyboardEl) {
  if (!svgOverlay || !homeKeyEl || !targetKeyEl || !keyboardEl) return;

  lastArrow = { homeKeyEl, targetKeyEl, fingerId, keyboardEl };
  renderArrow();
}

/** Remove the currently displayed arrow */
export function clearArrow() {
  clearArrowPaths();
  lastArrow = null;
}

/** Check if the overlay is initialised */
export function isReady() {
  return !!svgOverlay;
}
