/* Finger icon SVG generator — pure module.
 *
 * Produces a small inline SVG "finger with nail" that points downward,
 * as if pressing the key. The icon is decorative (aria-hidden) and its
 * color is inherited via fill="currentColor" so themes control it with CSS.
 *
 * Left-hand fingers tilt left (-14°), right-hand fingers tilt right (+14°),
 * thumb has no tilt. The SVG string is fully static (no user input),
 * so it is safe to inject into an element's innerHTML.
 */

const LEFT_FINGERS = new Set(['lp', 'lr', 'lm', 'li']);
const RIGHT_FINGERS = new Set(['ri', 'rm', 'rr', 'rp']);

/**
 * @param {string} fingerId - 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp' | 'tt'
 * @returns {string} SVG markup
 */
export function fingerIconSVG(fingerId) {
  const tilt = LEFT_FINGERS.has(fingerId) ? '-14' : (RIGHT_FINGERS.has(fingerId) ? '14' : '0');
  const rotate = `rotate(${tilt} 12 14)`;
  return [
    '<svg class="finger-svg" viewBox="0 0 24 28" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">',
    `  <g transform="${rotate}" fill="currentColor">`,
    '    <path d="M8 2 Q8 12 8.2 16 Q8.4 19 10 21 Q12 23 14 21 Q15.6 19 15.8 16 Q16 12 16 2 Z"/>',
    '    <path d="M10 15.5 Q10 18.5 12 19.8 Q14 18.5 14 15.5 Z" opacity="0.35"/>',
    '  </g>',
    '</svg>',
  ].join('\n');
}
