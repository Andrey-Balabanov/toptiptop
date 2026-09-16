/**
 * Unit tests for arrows.js — SVG Arrow Overlay Module.
 *
 * Tests cover:
 *   - initArrowOverlay()  — creation of SVG overlay, ResizeObserver setup
 *   - destroyArrowOverlay() — cleanup
 *   - drawArrow()         — drawing arrows from home-key to target-key
 *   - clearArrow()        — removing arrows
 *   - isReady()           — readiness check
 *   - Edge cases: null/undefined params, missing elements, no CSS color, etc.
 */

/* ===================================================================
 *  MOCKS — Browser & DOM APIs not available in Jest/node
 * =================================================================== */

// --- SVG namespace constants ---
const SVG_NS = 'http://www.w3.org/2000/svg';

// --- Track created SVG elements for assertions ---
let createdElements = [];
let appendedChildren = [];

// --- Mock ResizeObserver ---
let resizeObserverCallback = null;

class MockResizeObserver {
  constructor(callback) {
    resizeObserverCallback = callback;
  }
  observe() {}
  disconnect() {
    resizeObserverCallback = null;
  }
}

// --- Stub SVG element class ---
class MockSVGElement {
  constructor(tagName, ns) {
    this.tagName = tagName;
    this.namespaceURI = ns;
    this.attributes = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this._classList = [];
    this._innerHTML = '';
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name] || null;
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    appendedChildren.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  querySelectorAll(selector) {
    // Simple class-based matching for our use case
    if (selector === '.movement-arrow') {
      return this.children.filter(c => c.tagName === 'g' && c.attributes.class === 'movement-arrow');
    }
    return [];
  }
  getElementsByTagName(name) {
    return this.children.filter(c => c.tagName === name);
  }
  addEventListener() {}
  removeEventListener() {}
  get classList() {
    const self = this;
    return {
      add(...tokens) { tokens.forEach(t => { if (!self._classList.includes(t)) self._classList.push(t); }); },
      remove(...tokens) { tokens.forEach(t => { const i = self._classList.indexOf(t); if (i !== -1) self._classList.splice(i, 1); }); },
      contains(t) { return self._classList.includes(t); },
      toggle(t) {
        const idx = self._classList.indexOf(t);
        if (idx === -1) { self._classList.push(t); return true; }
        self._classList.splice(idx, 1); return false;
      },
    };
  }
  cloneNode(deep) {
    const clone = new MockSVGElement(this.tagName, this.namespaceURI);
    clone.attributes = { ...this.attributes };
    if (deep) clone.children = this.children.map(c => c.cloneNode(true));
    return clone;
  }
}

// --- Stub regular DOM Element (for keyboardEl, keyEl) ---
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this._classList = [];
    this._innerHTML = '';
    this.scrollWidth = 800;
    this.scrollHeight = 400;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this._boundingRect = { top: 0, left: 0, width: 800, height: 400, right: 800, bottom: 400, x: 0, y: 0 };
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name] || null;
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    appendedChildren.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  querySelectorAll(selector) {
    if (selector === '.movement-arrow') {
      return this.children.filter(c =>
        c.tagName === 'g' && c.attributes && c.attributes.class === 'movement-arrow'
      );
    }
    return [];
  }
  getBoundingClientRect() {
    return { ...this._boundingRect, toJSON: () => this._boundingRect };
  }
  addEventListener() {}
  removeEventListener() {}
  get classList() {
    const self = this;
    return {
      add(...tokens) { tokens.forEach(t => { if (!self._classList.includes(t)) self._classList.push(t); }); },
      remove(...tokens) { tokens.forEach(t => { const i = self._classList.indexOf(t); if (i !== -1) self._classList.splice(i, 1); }); },
      contains(t) { return self._classList.includes(t); },
      toggle(t) {
        const idx = self._classList.indexOf(t);
        if (idx === -1) { self._classList.push(t); return true; }
        self._classList.splice(idx, 1); return false;
      },
    };
  }
}

// --- Mock document ---
const mockDocument = {
  createElementNS(ns, tagName) {
    const el = new MockSVGElement(tagName, ns);
    createdElements.push(el);
    return el;
  },
  documentElement: new MockElement('html'),
};

// --- Mock getComputedStyle ---
let mockCSSVarMap = {
  '--lp': '#f7768e',
  '--lr': '#ff9e64',
  '--lm': '#e0af68',
  '--li': '#9ece6a',
  '--ri': '#73daca',
  '--rm': '#7aa2f7',
  '--rr': '#bb9af7',
  '--rp': '#ff9e9e',
  '--tt': '#c0caf5',
};

function mockGetComputedStyle(el) {
  const computedStyle = {
    position: 'relative',
    getPropertyValue(name) {
      return mockCSSVarMap[name] || '';
    },
  };
  return computedStyle;
}

// --- Store original references ---
const originalDocument = global.document;
const originalGetComputedStyle = global.getComputedStyle;
const originalResizeObserver = global.ResizeObserver;
const originalCreateElementNS = global.document?.createElementNS;

/* ===================================================================
 *  SETUP / TEARDOWN
 * =================================================================== */

function setupDOM() {
  createdElements = [];
  appendedChildren = [];
  resizeObserverCallback = null;

  // Install mocks on global
  global.document = mockDocument;
  global.getComputedStyle = mockGetComputedStyle;
  global.ResizeObserver = MockResizeObserver;
}

function teardownDOM() {
  // Restore originals
  global.document = originalDocument;
  global.getComputedStyle = originalGetComputedStyle;
  global.ResizeObserver = originalResizeObserver;
  createdElements = [];
  appendedChildren = [];
  resizeObserverCallback = null;
}

/* ===================================================================
 *  IMPORTS (after mocks are set up by the test runner)
 * =================================================================== */

import {
  initArrowOverlay,
  destroyArrowOverlay,
  drawArrow,
  clearArrow,
  isReady,
} from './arrows.js';

/* ===================================================================
 *  TESTS
 * =================================================================== */

describe('arrows.js — SVG Arrow Overlay', () => {
  let keyboardEl;

  beforeEach(() => {
    setupDOM();
    keyboardEl = new MockElement('div');
    keyboardEl._boundingRect = { top: 100, left: 50, width: 800, height: 400, right: 850, bottom: 500, x: 50, y: 100 };
    keyboardEl.scrollWidth = 800;
    keyboardEl.scrollHeight = 400;
    keyboardEl.scrollTop = 0;
    keyboardEl.scrollLeft = 0;
  });

  afterEach(() => {
    // Ensure cleanup between tests
    destroyArrowOverlay();
    teardownDOM();
  });

  /* ============================
   *  isReady()
   * ============================ */
  describe('isReady()', () => {
    test('returns false when overlay has not been initialised', () => {
      expect(isReady()).toBe(false);
    });

    test('returns true after initArrowOverlay()', () => {
      initArrowOverlay(keyboardEl);
      expect(isReady()).toBe(true);
    });

    test('returns false after destroyArrowOverlay()', () => {
      initArrowOverlay(keyboardEl);
      expect(isReady()).toBe(true);
      destroyArrowOverlay();
      expect(isReady()).toBe(false);
    });
  });

  /* ============================
   *  initArrowOverlay()
   * ============================ */
  describe('initArrowOverlay()', () => {
    test('creates an SVG element and appends it to the keyboard element', () => {
      initArrowOverlay(keyboardEl);

      // Should have created one SVG element
      const svgElements = createdElements.filter(el => el.tagName === 'svg');
      expect(svgElements.length).toBe(1);

      const svg = svgElements[0];
      expect(svg.namespaceURI).toBe(SVG_NS);
      expect(svg.attributes.class).toBe('arrow-overlay');
      expect(svg.attributes['aria-hidden']).toBe('true');

      // Should be appended to keyboardEl
      expect(keyboardEl.children).toContain(svg);
    });

    test('sets SVG size based on keyboard element dimensions', () => {
      initArrowOverlay(keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      expect(svg).toBeDefined();
      expect(svg.attributes.width).toBe('800');
      expect(svg.attributes.height).toBe('400');
      expect(svg.attributes.viewBox).toBe('0 0 800 400');
      expect(svg.style.width).toBe('800px');
      expect(svg.style.height).toBe('400px');
    });

    test('sets the SVG overlay styles for positioning', () => {
      initArrowOverlay(keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      expect(svg.style.cssText).toContain('position:absolute');
      expect(svg.style.cssText).toContain('pointer-events:none');
      expect(svg.style.cssText).toContain('z-index:10');
    });

    test('makes keyboardEl position relative if it is static', () => {
      // Default position is 'relative' in our mock, force static
      mockGetComputedStyle = () => ({ position: 'static', getPropertyValue: () => '' });
      initArrowOverlay(keyboardEl);
      expect(keyboardEl.style.position).toBe('relative');
      // Restore
      mockGetComputedStyle = (el) => ({
        position: el.style.position || 'relative',
        getPropertyValue(name) {
          return mockCSSVarMap[name] || '';
        },
      });
    });

    test('does not override position if already non-static', () => {
      keyboardEl.style.position = 'absolute';
      initArrowOverlay(keyboardEl);
      expect(keyboardEl.style.position).toBe('absolute');
    });

    test('creates a ResizeObserver and observes the keyboard element', () => {
      initArrowOverlay(keyboardEl);
      expect(resizeObserverCallback).toBeInstanceOf(Function);
    });

    test('calls destroyArrowOverlay first if already initialized (re-init)', () => {
      initArrowOverlay(keyboardEl);
      const firstSvg = keyboardEl.children.find(el => el.tagName === 'svg');
      expect(firstSvg).toBeDefined();

      // Re-initialize
      initArrowOverlay(keyboardEl);
      const svgElements = keyboardEl.children.filter(el => el.tagName === 'svg');
      // After destroy + init, there should only be one SVG
      expect(svgElements.length).toBe(1);
    });

    test('destroyArrowOverlay cleans up SVG and disconnects ResizeObserver', () => {
      initArrowOverlay(keyboardEl);
      expect(keyboardEl.children.length).toBeGreaterThan(0);

      destroyArrowOverlay();

      // SVG should be removed
      const svgElements = keyboardEl.children.filter(el => el.tagName === 'svg');
      expect(svgElements.length).toBe(0);
      // ResizeObserver should be disconnected
      expect(resizeObserverCallback).toBeNull();
      // Module state should be reset
      expect(isReady()).toBe(false);
    });

    test('destroyArrowOverlay is safe to call when not initialized', () => {
      expect(() => destroyArrowOverlay()).not.toThrow();
    });

    test('destroyArrowOverlay is safe to call multiple times', () => {
      initArrowOverlay(keyboardEl);
      destroyArrowOverlay();
      expect(() => destroyArrowOverlay()).not.toThrow();
    });

    test('resize observer callback updates overlay size', () => {
      initArrowOverlay(keyboardEl);

      // Change dimensions
      keyboardEl.scrollWidth = 1024;
      keyboardEl.scrollHeight = 768;

      // Trigger resize callback
      resizeObserverCallback();

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      expect(svg.attributes.width).toBe('1024');
      expect(svg.attributes.height).toBe('768');
      expect(svg.attributes.viewBox).toBe('0 0 1024 768');
      expect(svg.style.width).toBe('1024px');
      expect(svg.style.height).toBe('768px');
    });
  });

  /* ============================
   *  drawArrow()
   * ============================ */
  describe('drawArrow()', () => {
    let homeKeyEl, targetKeyEl;

    beforeEach(() => {
      initArrowOverlay(keyboardEl);

      // Create home key element (e.g., 'а' for left index on RU layout)
      homeKeyEl = new MockElement('div');
      homeKeyEl._boundingRect = {
        top: 250, left: 200, width: 50, height: 50,
        right: 250, bottom: 300, x: 200, y: 250,
      };

      // Create target key element (e.g. some other key)
      targetKeyEl = new MockElement('div');
      targetKeyEl._boundingRect = {
        top: 180, left: 150, width: 50, height: 50,
        right: 200, bottom: 230, x: 150, y: 180,
      };
    });

    test('draws an arrow from home key center to target key center', () => {
      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg.querySelectorAll('.movement-arrow');
      expect(arrows.length).toBe(1);

      const g = arrows[0];
      expect(g.tagName).toBe('g');
      expect(g.attributes.class).toBe('movement-arrow');

      // Should contain a line and a polygon (arrow head)
      const line = g.children.find(c => c.tagName === 'line');
      const head = g.children.find(c => c.tagName === 'polygon');

      expect(line).toBeDefined();
      expect(head).toBeDefined();

      // Line should use the finger's color
      expect(line.attributes.stroke).toBe('#9ece6a'); // --li color
      expect(line.attributes['stroke-width']).toBe('2.5');
      expect(line.attributes['stroke-linecap']).toBe('round');
      expect(line.attributes['stroke-dasharray']).toBe('7, 5');

      // Arrow head should be filled with the same color
      expect(head.attributes.fill).toBe('#9ece6a');
    });

    test('calculates correct line coordinates based on element centers', () => {
      // homeKeyEl center: (200 + 25, 250 + 25) = (225, 275)
      // targetKeyEl center: (150 + 25, 180 + 25) = (175, 205)
      // Relative to keyboard (top:100, left:50):
      //   from: (225 - 50 + 0, 275 - 100 + 0) = (175, 175)
      //   to:   (175 - 50 + 0, 205 - 100 + 0) = (125, 105)

      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const g = svg.querySelectorAll('.movement-arrow')[0];
      const line = g.children.find(c => c.tagName === 'line');

      expect(Number(line.attributes.x1)).toBe(225);
      expect(Number(line.attributes.y1)).toBe(275);
      expect(Number(line.attributes.x2)).toBe(175);
      expect(Number(line.attributes.y2)).toBe(205);
    });

    test('arrow head polygon has 3 points (triangle)', () => {
      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const g = svg.querySelectorAll('.movement-arrow')[0];
      const head = g.children.find(c => c.tagName === 'polygon');

      const points = head.attributes.points.split(' ');
      expect(points.length).toBe(3);
      // First point should be the target center
      const firstPoint = points[0].split(',');
      expect(Number(firstPoint[0])).toBe(175);
      expect(Number(firstPoint[1])).toBe(205);
    });

    test('uses different colors for different fingers', () => {
      const testCases = [
        { fingerId: 'lp', expectedColor: '#f7768e' },
        { fingerId: 'lr', expectedColor: '#ff9e64' },
        { fingerId: 'lm', expectedColor: '#e0af68' },
        { fingerId: 'li', expectedColor: '#9ece6a' },
        { fingerId: 'ri', expectedColor: '#73daca' },
        { fingerId: 'rm', expectedColor: '#7aa2f7' },
        { fingerId: 'rr', expectedColor: '#bb9af7' },
        { fingerId: 'rp', expectedColor: '#ff9e9e' },
        { fingerId: 'tt', expectedColor: '#c0caf5' },
      ];

      testCases.forEach(({ fingerId, expectedColor }) => {
        // Clear previous arrow
        clearArrow();

        drawArrow(homeKeyEl, targetKeyEl, fingerId, keyboardEl);

        const svg = keyboardEl.children.find(el => el.tagName === 'svg');
        const arrows = svg.querySelectorAll('.movement-arrow');
        expect(arrows.length).toBe(1);

        const g = arrows[0];
        const line = g.children.find(c => c.tagName === 'line');
        expect(line.attributes.stroke).toBe(expectedColor);
      });
    });

    test('accounts for keyboard scroll offset', () => {
      keyboardEl.scrollTop = 50;
      keyboardEl.scrollLeft = 30;

      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const g = svg.querySelectorAll('.movement-arrow')[0];
      const line = g.children.find(c => c.tagName === 'line');

      // With scroll:
      //   from: (200 + 25 - 50 + 30, 250 + 25 - 100 + 50) = (205, 225)
      //   to:   (150 + 25 - 50 + 30, 180 + 25 - 100 + 50) = (155, 155)
      expect(Number(line.attributes.x1)).toBe(225 + 30);
      expect(Number(line.attributes.y1)).toBe(275 + 50);
      expect(Number(line.attributes.x2)).toBe(175 + 30);
      expect(Number(line.attributes.y2)).toBe(205 + 50);
    });

    test('replaces previous arrow when called again', () => {
      // Draw first arrow
      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      // Change target position and draw again
      const newTarget = new MockElement('div');
      newTarget._boundingRect = {
        top: 300, left: 400, width: 50, height: 50,
        right: 450, bottom: 350, x: 400, y: 300,
      };

      drawArrow(homeKeyEl, newTarget, 'ri', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg.querySelectorAll('.movement-arrow');
      // Should only have one arrow (the old one was replaced)
      expect(arrows.length).toBe(1);

      const g = arrows[0];
      const line = g.children.find(c => c.tagName === 'line');
      // Should be the new color
      expect(line.attributes.stroke).toBe('#73daca'); // --ri color
    });

    test('draws arrow pointing upward when target is above home', () => {
      // Target above home key: y2 < y1
      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const g = svg.querySelectorAll('.movement-arrow')[0];
      const line = g.children.find(c => c.tagName === 'line');

      // target is above home: 205 < 275
      expect(Number(line.attributes.y2)).toBeLessThan(Number(line.attributes.y1));
    });

    test('draws arrow pointing downward when target is below home', () => {
      const belowTarget = new MockElement('div');
      belowTarget._boundingRect = {
        top: 350, left: 200, width: 50, height: 50,
        right: 250, bottom: 400, x: 200, y: 350,
      };

      drawArrow(homeKeyEl, belowTarget, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const g = svg.querySelectorAll('.movement-arrow')[0];
      const line = g.children.find(c => c.tagName === 'line');

      expect(Number(line.attributes.y2)).toBeGreaterThan(Number(line.attributes.y1));
    });

    test('draws arrow pointing right when target is to the right of home', () => {
      const rightTarget = new MockElement('div');
      rightTarget._boundingRect = {
        top: 250, left: 350, width: 50, height: 50,
        right: 400, bottom: 300, x: 350, y: 250,
      };

      drawArrow(homeKeyEl, rightTarget, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const g = svg.querySelectorAll('.movement-arrow')[0];
      const line = g.children.find(c => c.tagName === 'line');

      expect(Number(line.attributes.x2)).toBeGreaterThan(Number(line.attributes.x1));
    });

    test('draws arrow pointing left when target is to the left of home', () => {
      const leftTarget = new MockElement('div');
      leftTarget._boundingRect = {
        top: 250, left: 50, width: 50, height: 50,
        right: 100, bottom: 300, x: 50, y: 250,
      };

      drawArrow(homeKeyEl, leftTarget, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const g = svg.querySelectorAll('.movement-arrow')[0];
      const line = g.children.find(c => c.tagName === 'line');

      expect(Number(line.attributes.x2)).toBeLessThan(Number(line.attributes.x1));
    });

    // ── Edge cases ──

    test('does nothing when overlay is not initialized', () => {
      destroyArrowOverlay();
      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);
      // Should not throw
      expect(true).toBe(true);
    });

    test('does nothing when homeKeyEl is null', () => {
      drawArrow(null, targetKeyEl, 'li', keyboardEl);
      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg ? svg.querySelectorAll('.movement-arrow') : [];
      expect(arrows.length).toBe(0);
    });

    test('does nothing when targetKeyEl is null', () => {
      drawArrow(homeKeyEl, null, 'li', keyboardEl);
      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg ? svg.querySelectorAll('.movement-arrow') : [];
      expect(arrows.length).toBe(0);
    });

    test('does nothing when homeKeyEl is undefined', () => {
      drawArrow(undefined, targetKeyEl, 'li', keyboardEl);
      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg ? svg.querySelectorAll('.movement-arrow') : [];
      expect(arrows.length).toBe(0);
    });

    test('does nothing when targetKeyEl is undefined', () => {
      drawArrow(homeKeyEl, undefined, 'li', keyboardEl);
      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg ? svg.querySelectorAll('.movement-arrow') : [];
      expect(arrows.length).toBe(0);
    });

    test('does nothing when CSS variable for fingerId is not defined', () => {
      drawArrow(homeKeyEl, targetKeyEl, 'nonexistent-finger', keyboardEl);
      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg ? svg.querySelectorAll('.movement-arrow') : [];
      expect(arrows.length).toBe(0);
    });

    test('does nothing when CSS color value is empty string', () => {
      // Simulate missing CSS variable
      const originalColor = mockCSSVarMap['--lp'];
      mockCSSVarMap['--lp'] = '';

      drawArrow(homeKeyEl, targetKeyEl, 'lp', keyboardEl);
      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg ? svg.querySelectorAll('.movement-arrow') : [];
      expect(arrows.length).toBe(0);

      mockCSSVarMap['--lp'] = originalColor;
    });
  });

  /* ============================
   *  clearArrow()
   * ============================ */
  describe('clearArrow()', () => {
    let homeKeyEl, targetKeyEl;

    beforeEach(() => {
      initArrowOverlay(keyboardEl);
      homeKeyEl = new MockElement('div');
      homeKeyEl._boundingRect = { top: 250, left: 200, width: 50, height: 50, right: 250, bottom: 300, x: 200, y: 250 };
      targetKeyEl = new MockElement('div');
      targetKeyEl._boundingRect = { top: 180, left: 150, width: 50, height: 50, right: 200, bottom: 230, x: 150, y: 180 };

      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);
    });

    test('removes all arrow paths from the SVG overlay', () => {
      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      expect(svg.querySelectorAll('.movement-arrow').length).toBe(1);

      clearArrow();

      expect(svg.querySelectorAll('.movement-arrow').length).toBe(0);
    });

    test('is safe to call when no arrows are present', () => {
      clearArrow(); // Remove first arrow
      expect(() => clearArrow()).not.toThrow();
    });

    test('allows drawing a new arrow after clearing', () => {
      clearArrow();

      drawArrow(homeKeyEl, targetKeyEl, 'rp', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      const arrows = svg.querySelectorAll('.movement-arrow');
      expect(arrows.length).toBe(1);

      const line = arrows[0].children.find(c => c.tagName === 'line');
      expect(line.attributes.stroke).toBe('#ff9e9e');
    });

    test('is safe to call when overlay is not initialized', () => {
      destroyArrowOverlay();
      expect(() => clearArrow()).not.toThrow();
    });
  });

  /* ============================
   *  Integration-style tests
   * ============================ */
  describe('integration — lifecycle', () => {
    test('full lifecycle: init → draw → clear → destroy', () => {
      const homeKeyEl = new MockElement('div');
      homeKeyEl._boundingRect = { top: 250, left: 200, width: 50, height: 50, right: 250, bottom: 300, x: 200, y: 250 };
      const targetKeyEl = new MockElement('div');
      targetKeyEl._boundingRect = { top: 180, left: 150, width: 50, height: 50, right: 200, bottom: 230, x: 150, y: 180 };

      expect(isReady()).toBe(false);

      initArrowOverlay(keyboardEl);
      expect(isReady()).toBe(true);

      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      expect(svg.querySelectorAll('.movement-arrow').length).toBe(1);

      clearArrow();
      expect(svg.querySelectorAll('.movement-arrow').length).toBe(0);

      destroyArrowOverlay();
      expect(isReady()).toBe(false);
      expect(keyboardEl.children.filter(el => el.tagName === 'svg').length).toBe(0);
    });

    test('multiple draw and clear cycles', () => {
      initArrowOverlay(keyboardEl);

      const homeKeyEl = new MockElement('div');
      homeKeyEl._boundingRect = { top: 250, left: 200, width: 50, height: 50, right: 250, bottom: 300, x: 200, y: 250 };

      const targets = [
        { rect: { top: 180, left: 150, width: 50, height: 50, right: 200, bottom: 230, x: 150, y: 180 }, finger: 'lp' },
        { rect: { top: 300, left: 400, width: 50, height: 50, right: 450, bottom: 350, x: 400, y: 300 }, finger: 'ri' },
        { rect: { top: 250, left: 100, width: 50, height: 50, right: 150, bottom: 300, x: 100, y: 250 }, finger: 'lm' },
      ];

      targets.forEach((t, idx) => {
        const targetEl = new MockElement('div');
        targetEl._boundingRect = t.rect;

        drawArrow(homeKeyEl, targetEl, t.finger, keyboardEl);

        const svg = keyboardEl.children.find(el => el.tagName === 'svg');
        const arrows = svg.querySelectorAll('.movement-arrow');
        // Should always be exactly 1 (previous arrow replaced)
        expect(arrows.length).toBe(1);

        const line = arrows[0].children.find(c => c.tagName === 'line');
        const expectedColors = ['#f7768e', '#73daca', '#e0af68'];
        expect(line.attributes.stroke).toBe(expectedColors[idx]);
      });

      clearArrow();

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      expect(svg.querySelectorAll('.movement-arrow').length).toBe(0);
    });
  });

  /* ============================
   *  ResizeObserver edge cases
   * ============================ */
  describe('ResizeObserver handling', () => {
    test('resize observer callback redraws arrow when coords exist', () => {
      initArrowOverlay(keyboardEl);

      const homeKeyEl = new MockElement('div');
      homeKeyEl._boundingRect = { top: 250, left: 200, width: 50, height: 50, right: 250, bottom: 300, x: 200, y: 250 };
      const targetKeyEl = new MockElement('div');
      targetKeyEl._boundingRect = { top: 180, left: 150, width: 50, height: 50, right: 200, bottom: 230, x: 150, y: 180 };

      drawArrow(homeKeyEl, targetKeyEl, 'li', keyboardEl);

      // Change size
      keyboardEl.scrollWidth = 1024;
      keyboardEl.scrollHeight = 768;

      // Trigger resize
      resizeObserverCallback();

      const svg = keyboardEl.children.find(el => el.tagName === 'svg');
      // Arrow should still be there after resize
      const arrows = svg.querySelectorAll('.movement-arrow');
      expect(arrows.length).toBe(1);
      // And SVG should have new dimensions
      expect(svg.attributes.width).toBe('1024');
    });

    test('resize observer callback is safe when no coords exist', () => {
      initArrowOverlay(keyboardEl);

      keyboardEl.scrollWidth = 1024;
      keyboardEl.scrollHeight = 768;

      // Should not throw even without drawn arrows
      expect(() => resizeObserverCallback()).not.toThrow();
    });
  });
});
