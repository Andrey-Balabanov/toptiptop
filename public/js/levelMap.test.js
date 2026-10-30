/**
 * Unit tests for the level map layout (levelMap.js)
 */

import { mapLayout } from './levelMap.js';

describe('level map layout', () => {
  it('lays the road out as a snake: next row runs the other way', () => {
    const layout = mapLayout(19, 700);
    const { cols, nodes } = layout;
    expect(nodes).toHaveLength(19);
    expect(nodes[1].x).toBeGreaterThan(nodes[0].x);
    // First node of the second row sits under the last node of the first row
    expect(nodes[cols].x).toBe(nodes[cols - 1].x);
    expect(nodes[cols + 1].x).toBeLessThan(nodes[cols].x);
  });

  it('keeps every node inside the map', () => {
    for (const width of [160, 320, 900]) {
      const layout = mapLayout(17, width);
      for (const n of layout.nodes) {
        expect(n.x).toBeGreaterThan(0);
        expect(n.x).toBeLessThan(width);
        expect(n.y).toBeGreaterThan(0);
        expect(n.y).toBeLessThan(layout.height);
      }
    }
  });

  it('uses fewer columns on narrow maps and one road piece between neighbours', () => {
    expect(mapLayout(19, 180).cols).toBe(3);
    expect(mapLayout(19, 900).cols).toBe(10);
    expect(mapLayout(19, 600).segments).toHaveLength(18);
  });
});
