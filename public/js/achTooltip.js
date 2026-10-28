/* Achievement descriptions on hover / keyboard focus / tap.
 *
 * One floating tooltip attached to <body> (position: fixed), so it is never
 * clipped by the scrolling achievements panel. It sits above the icon, flips
 * below when there is no room, and is kept inside the window horizontally.
 */

const MARGIN = 8;
let tip = null;

function tooltipEl() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'ach-tooltip';
    tip.id = 'ach-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  return tip;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Where to put a w×h tooltip for an icon at `rect` inside a vw×vh window. */
export function placeTooltip(rect, w, h, vw, vh) {
  const left = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, MARGIN), Math.max(MARGIN, vw - w - MARGIN));
  let top = rect.top - h - MARGIN;
  let below = false;
  if (top < MARGIN) {
    top = Math.min(rect.bottom + MARGIN, vh - h - MARGIN);
    below = true;
  }
  return { left: Math.round(left), top: Math.round(top), below };
}

function show(cell) {
  const el = tooltipEl();
  el.innerHTML = `<b>${esc(cell.dataset.name)}</b><span>${esc(cell.dataset.desc)}</span>` +
    `<em class="${cell.classList.contains('unlocked') ? 'ok' : ''}">${esc(cell.dataset.status)}</em>`;
  el.classList.add('visible');
  const { left, top, below } = placeTooltip(cell.getBoundingClientRect(), el.offsetWidth, el.offsetHeight,
    window.innerWidth, window.innerHeight);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.classList.toggle('below', below);
  cell.setAttribute('aria-describedby', 'ach-tooltip');
}

function hide() {
  if (tip) tip.classList.remove('visible');
}

/** Wire the tooltip to an achievements grid (call once; cells may be re-rendered). */
export function attachAchievementTooltips(grid) {
  grid.addEventListener('mouseover', e => {
    const cell = e.target.closest('.ach-cell');
    if (cell) show(cell);
  });
  grid.addEventListener('mouseout', e => {
    const cell = e.target.closest('.ach-cell');
    if (cell && !cell.contains(e.relatedTarget)) hide();
  });
  grid.addEventListener('focusin', e => {
    const cell = e.target.closest('.ach-cell');
    if (cell) show(cell);
  });
  grid.addEventListener('focusout', hide);
  grid.addEventListener('scroll', hide);
  window.addEventListener('resize', hide);
}
