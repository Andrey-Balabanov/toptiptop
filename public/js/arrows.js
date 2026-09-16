/* SVG Arrow Overlay Module
 *
 * Draws a visual arrow from the home-row key of the active finger
 * to the target key. The arrow uses the finger's zone color (CSS variable)
 * and has a flowing dash animation.
 *
 * The overlay sits on top of the keyboard (z-index:10, pointer-events:none)
 * so interactions with keys underneath work normally.
 */

let svgOverlay = null;
let resizeObserver = null;
let currentKeyboardEl = null;
let lastArrowCoords = null;

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

export function initArrowOverlay(keyboardEl) {
  destroyArrowOverlay();
  currentKeyboardEl = keyboardEl;

  const ns = 'http://www.w3.org/2000/svg';
  svgOverlay = document.createElementNS(ns, 'svg');
  svgOverlay.setAttribute('class', 'arrow-overlay');
  svgOverlay.setAttribute('aria-hidden', 'true');
  svgOverlay.style.cssText =
    'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;z-index:10;';

  if (getComputedStyle(keyboardEl).position === 'static') {
    keyboardEl.style.position = 'relative';
  }

  keyboardEl.appendChild(svgOverlay);
  updateOverlaySize();

  resizeObserver = new ResizeObserver(() => {
    updateOverlaySize();
    if (lastArrowCoords) redrawArrow(lastArrowCoords);
  });
  resizeObserver.observe(keyboardEl);
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
  lastArrowCoords = null;
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
  };
}

function redrawArrow(coords) {
  if (!svgOverlay) return;
  clearArrowPaths();

  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'movement-arrow');

  const { x1, y1, x2, y2, color } = coords;

  // --- Dashed arrow line ---
  const line = document.createElementNS(ns, 'line');
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

  const head = document.createElementNS(ns, 'polygon');
  head.setAttribute('points', `${x2},${y2} ${ax},${ay} ${bx},${by}`);
  head.setAttribute('fill', color);
  head.setAttribute('class', 'arrow-head');
  g.appendChild(head);

  svgOverlay.appendChild(g);
}

function clearArrowPaths() {
  if (!svgOverlay) return;
  const arrows = svgOverlay.querySelectorAll('.movement-arrow');
  arrows.forEach(el => el.remove());
}

/**
 * Draw an arrow from the home-row key of a finger to the target key.
 * @param {Element} homeKeyEl  - DOM element of the home-row key
 * @param {Element} targetKeyEl - DOM element of the target key
 * @param {string}  fingerId   - finger identifier (e.g. 'lp', 'ri')
 * @param {Element} keyboardEl - the keyboard container element
 */
export function drawArrow(homeKeyEl, targetKeyEl, fingerId, keyboardEl) {
  if (!svgOverlay || !homeKeyEl || !targetKeyEl) return;

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue('--' + fingerId).trim();
  if (!color) return;

  const from = getKeyCenter(homeKeyEl, keyboardEl);
  const to = getKeyCenter(targetKeyEl, keyboardEl);

  lastArrowCoords = { x1: from.x, y1: from.y, x2: to.x, y2: to.y, color, fingerId };
  redrawArrow(lastArrowCoords);
}

/** Remove the currently displayed arrow */
export function clearArrow() {
  clearArrowPaths();
  lastArrowCoords = null;
}

/** Check if the overlay is initialised */
export function isReady() {
  return !!svgOverlay;
}
