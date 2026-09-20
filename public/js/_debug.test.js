// Temporary debug test
const SVG_NS = 'http://www.w3.org/2000/svg';

class MockSVGElement {
  constructor(tagName, ns) {
    this.tagName = tagName; this.namespaceURI = ns;
    this.attributes = {}; this.style = {}; this.children = []; this.parentNode = null;
    this._classList = []; this._innerHTML = '';
  }
  setAttribute(n, v) { this.attributes[n] = String(v); }
  getAttribute(n) { return this.attributes[n] || null; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); c.parentNode = null; return c; }
  querySelectorAll(sel) { return this.children.filter(c => c.tagName === 'g' && c.attributes.class === 'movement-arrow'); }
  remove() {}
}

class MockElement {
  constructor() {
    this.tagName = 'div'; this.style = {}; this.attributes = {}; this.children = [];
    this.parentNode = null; this.scrollWidth = 800; this.scrollHeight = 400;
    this.scrollTop = 0; this.scrollLeft = 0;
    this._boundingRect = { top: 0, left: 0, width: 800, height: 400, right: 800, bottom: 400 };
  }
  setAttribute(n, v) { this.attributes[n] = String(v); }
  getAttribute(n) { return this.attributes[n] || null; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); c.parentNode = null; return c; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { ...this._boundingRect }; }
}

global.document = { createElementNS(ns, tag) { return new MockSVGElement(tag, ns); }, documentElement: new MockElement() };
global.getComputedStyle = () => ({ position: 'relative', getPropertyValue: (n) => ({ '--li': '#9ece6a' }[n] || '') });
global.ResizeObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };

import { initArrowOverlay, drawArrow, isReady } from './arrows.js';

test('debug draw', () => {
  const kb = new MockElement();
  initArrowOverlay(kb);
  console.log('isReady', isReady());
  console.log('kb children', kb.children.map(c => c.tagName));
  const home = new MockElement();
  home._boundingRect = { top: 250, left: 200, width: 50, height: 50 };
  const tgt = new MockElement();
  tgt._boundingRect = { top: 180, left: 150, width: 50, height: 50 };
  drawArrow(home, tgt, 'li', kb);
  const svg = kb.children.find(c => c.tagName === 'svg');
  console.log('svg children', svg ? svg.children.map(c => c.tagName + ':' + JSON.stringify(c.attributes)) : 'none');
});
