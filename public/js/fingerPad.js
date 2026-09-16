/* Finger pad SVG generator — single source of truth for the oval
 * "fingerprint pad" shape used on BOTH surfaces:
 *
 *   - fingerPadSVG() — small oval pad drawn "on the button" of every
 *     home-row key (A S D F / J K L ; and RU: Ф Ы В А / О Л Д Ж) and the
 *     space key, in any keyboard layout.
 *
 *   - handPadSVG()   — larger, richer oval pad used for the hands above
 *     the keyboard (each finger shows its own pad instead of phalanges).
 *
 * The strings are fully static (no user input) so they are safe for
 * innerHTML. Colored with `currentColor`, so CSS variables (--lp…--tt)
 * apply naturally and the active finger can glow via drop-shadow.
 */

/** Fingers of each hand — used to tilt the pad toward the pressing hand. */
const LEFT_HAND_FINGERS = new Set(['lp', 'lr', 'lm', 'li']);
const RIGHT_HAND_FINGERS = new Set(['ri', 'rm', 'rr', 'rp']);

/** Slight tilt mirrors the natural orientation of each hand. */
function tiltFor(finger) {
  if (LEFT_HAND_FINGERS.has(finger)) return -6;
  if (RIGHT_HAND_FINGERS.has(finger)) return 6;
  return 0;
}

/**
 * Inline SVG of a fingertip pad (подушка пальца) drawn "on the button" for
 * every home-row key and the space key, in ANY keyboard layout.
 *
 * Instead of a whole finger, each home key shows just the soft rounded
 * fingertip pad, as if you were looking down at the hand resting on the
 * keyboard: the pad oval with the fingernail near its top edge and a hint of
 * fingerprint ridges, so the shape reads as a finger pad at a glance.
 *
 * @param {string} finger - 'lp'|'lr'|'lm'|'li'|'ri'|'rm'|'rr'|'rp'|'tt'
 * @returns {string} SVG markup
 */
export function fingerPadSVG(finger) {
  const isThumb = finger === 'tt';
  const tilt = tiltFor(finger);
  // The thumb pad is wider relative to its height (viewBox 36x20 vs 24x22).
  const vb = isThumb ? '0 0 36 20' : '0 0 24 22';

  // Pad silhouette — a soft oval
  const pad = isThumb
    ? 'M2.2 10.5 C2.2 5 7 3 18 3 C29 3 33.8 5 33.8 10.5 C33.8 16 29 19 18 19 C7 19 2.2 16 2.2 10.5 Z'
    : 'M3.5 9.5 C3.5 4.9 7.3 2.8 12 2.8 C16.7 2.8 20.5 4.9 20.5 9.5 C20.5 14.8 17.1 18.8 12 18.8 C6.9 18.8 3.5 14.8 3.5 9.5 Z';

  // Fingernail visible near the top edge of the pad
  const nail = isThumb
    ? 'M9 5.8 C9 4 11.5 3.4 18 3.4 C24.5 3.4 27 4 27 5.8 C27 7.6 24.6 8.6 18 8.6 C11.4 8.6 9 7.6 9 5.8 Z'
    : 'M7.2 5.6 C7.2 3.9 9 3.3 12 3.3 C15 3.3 16.8 3.9 16.8 5.6 C16.8 7.3 15.2 8.2 12 8.2 C8.8 8.2 7.2 7.3 7.2 5.6 Z';

  // Fingerprint ridges — make the shape read as a "подушка пальца"
  const ridges = isThumb
    ? ['M6.5 12.6 C9 15 13.5 16.6 18 16.6 C22.5 16.6 27 15 29.5 12.6',
       'M9.5 15.6 C12 17.2 15 18 18 18 C21 18 24 17.2 26.5 15.6']
    : ['M6.8 12.2 C8.3 14.2 10.2 15.2 12 15.2 C13.8 15.2 15.7 14.2 17.2 12.2',
       'M8.2 15 C9.4 16.3 10.7 16.9 12 16.9 C13.3 16.9 14.6 16.3 15.8 15'];

  // Glossy highlight on the upper-left edge
  const highlight = isThumb
    ? 'M5 7.6 C6 5.4 9 3.9 12.5 3.5'
    : 'M4.8 7.4 C5.3 5.1 7.5 3.7 10.2 3.3';

  return [
    '<svg class="finger-pad" viewBox="' + vb + '" aria-hidden="true" focusable="false">',
    '  <g transform="rotate(' + tilt + ' 12 11)" fill="currentColor">',
    '    <path d="' + pad + '" stroke="rgba(0,0,0,0.35)" stroke-width="1" stroke-linejoin="round"/>',
    '    <path d="' + nail + '" fill="rgba(255,255,255,0.55)"/>',
    '    <path d="' + ridges[0] + '" stroke="rgba(0,0,0,0.22)" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
    '    <path d="' + ridges[1] + '" stroke="rgba(0,0,0,0.18)" stroke-width="1" fill="none" stroke-linecap="round"/>',
    '    <path d="' + highlight + '" stroke="rgba(255,255,255,0.35)" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
    '  </g>',
    '</svg>',
  ].join('\n');
}

/**
 * Inline SVG of a larger oval fingerprint pad used for the hands above the
 * keyboard. Same visual language as fingerPadSVG() (oval pad + nail +
 * papillary ridges + highlight) but taller and with a richer ridge pattern
 * (3 arcs for fingers, 2 for the thumb) so it reads as a fingerprint at
 * the size of a hand.
 *
 * The pads are arranged in a natural semicircular arc across the hands by
 * CSS (each finger class sets its own `--pad-w` width; the tallest pad —
 * the middle finger — sits highest because the columns are bottom-aligned).
 * The thumb gets a wide, low oval resting between the two hands.
 *
 * @param {string} finger - 'lp'|'lr'|'lm'|'li'|'ri'|'rm'|'rr'|'rp'|'tt'
 * @returns {string} SVG markup
 */
export function handPadSVG(finger) {
  const isThumb = finger === 'tt';
  const tilt = tiltFor(finger);
  // Fingers: tall oval 40x44 (подушка пальца, viewed top-down).
  // Thumb: wide low oval 36x30.
  const vb = isThumb ? '0 0 36 30' : '0 0 40 44';
  const cx = isThumb ? 18 : 20;
  const cy = isThumb ? 15 : 22;

  // Pad silhouette — a soft elongated oval
  const pad = isThumb
    ? 'M3 14.5 C3 6.5 8.2 3.4 18 3.4 C27.8 3.4 33 6.5 33 14.5 C33 22.5 27.5 26.6 18 26.6 C8.5 26.6 3 22.5 3 14.5 Z'
    : 'M5 21 C5 10.5 11 5.5 20 5.5 C29 5.5 35 10.5 35 21 C35 31.5 28 38.5 20 38.5 C12 38.5 5 31.5 5 21 Z';

  // Fingernail visible near the top edge of the pad
  const nail = isThumb
    ? 'M9.5 8.8 C9.5 5.8 13 4.8 18 4.8 C23 4.8 26.5 5.8 26.5 8.8 C26.5 11.8 22.8 13.2 18 13.2 C13.2 13.2 9.5 11.8 9.5 8.8 Z'
    : 'M12.5 11.5 C12.5 8.5 15.7 7.6 20 7.6 C24.3 7.6 27.5 8.5 27.5 11.5 C27.5 14.6 24 16 20 16 C16 16 12.5 14.6 12.5 11.5 Z';

  // Fingerprint ridges — 3 arcs for fingers, 2 for the thumb
  const ridges = isThumb
    ? ['M7 17.5 C9.5 20.8 13.5 22.5 18 22.5 C22.5 22.5 26.5 20.8 29 17.5',
       'M9.5 21.5 C12 24 15 25.3 18 25.3 C21 25.3 24 24 26.5 21.5']
    : ['M9 23.5 C11.5 27.5 15.5 29.5 20 29.5 C24.5 29.5 28.5 27.5 31 23.5',
       'M11 29 C13.5 32.5 16.5 34 20 34 C23.5 34 26.5 32.5 29 29',
       'M13.5 34 C15.5 36.3 17.7 37.3 20 37.3 C22.3 37.3 24.5 36.3 26.5 34'];

  // Glossy highlight on the upper-left edge
  const highlight = isThumb
    ? 'M5.2 10.5 C6.2 7 10 5 14.5 4.4'
    : 'M7.5 17 C8.3 12.5 12.5 9.3 16.8 8.2';

  const ridgePaths = isThumb
    ? [
        '    <path d="' + ridges[0] + '" stroke="rgba(0,0,0,0.22)" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
        '    <path d="' + ridges[1] + '" stroke="rgba(0,0,0,0.18)" stroke-width="1" fill="none" stroke-linecap="round"/>',
      ]
    : [
        '    <path d="' + ridges[0] + '" stroke="rgba(0,0,0,0.22)" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
        '    <path d="' + ridges[1] + '" stroke="rgba(0,0,0,0.18)" stroke-width="1" fill="none" stroke-linecap="round"/>',
        '    <path d="' + ridges[2] + '" stroke="rgba(0,0,0,0.14)" stroke-width="0.9" fill="none" stroke-linecap="round"/>',
      ];

  return [
    '<svg class="hand-pad" viewBox="' + vb + '" aria-hidden="true" focusable="false">',
    '  <g transform="rotate(' + tilt + ' ' + cx + ' ' + cy + ')" fill="currentColor">',
    '    <path d="' + pad + '" stroke="rgba(0,0,0,0.35)" stroke-width="1" stroke-linejoin="round"/>',
    '    <path d="' + nail + '" fill="rgba(255,255,255,0.55)"/>',
  ].concat(ridgePaths, [
    '    <path d="' + highlight + '" stroke="rgba(255,255,255,0.35)" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
    '  </g>',
    '</svg>',
  ]).join('\n');
}
