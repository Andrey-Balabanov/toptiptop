/**
 * Unit tests for tooltip placement in achTooltip.js
 */

import { placeTooltip } from './achTooltip.js';

const icon = (left, top) => ({ left, top, width: 40, height: 36, right: left + 40, bottom: top + 36 });

describe('placeTooltip', () => {
  it('centres the tooltip above the icon when there is room', () => {
    expect(placeTooltip(icon(500, 300), 200, 60, 1200, 800)).toEqual({ left: 420, top: 232, below: false });
  });

  it('flips below an icon at the top of the window', () => {
    expect(placeTooltip(icon(500, 20), 200, 60, 1200, 800)).toEqual({ left: 420, top: 64, below: true });
  });

  it('stays inside the window on both sides', () => {
    expect(placeTooltip(icon(1150, 300), 200, 60, 1200, 800).left).toBe(992);
    expect(placeTooltip(icon(0, 300), 200, 60, 1200, 800).left).toBe(8);
  });
});
