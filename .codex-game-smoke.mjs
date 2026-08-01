import assert from 'node:assert/strict';

class FakeClassList {
  constructor(element) { this.element = element; }
  values() { return new Set(String(this.element.className || '').split(/\s+/).filter(Boolean)); }
  write(values) { this.element.className = [...values].join(' '); }
  add(...names) { const values = this.values(); names.forEach((name) => values.add(name)); this.write(values); }
  remove(...names) { const values = this.values(); names.forEach((name) => values.delete(name)); this.write(values); }
  contains(name) { return this.values().has(name); }
}

class FakeStyle {
  constructor() { this.cssText = ''; }
  setProperty(name, value) { this[name] = String(value); }
}

class FakeContext {
  constructor() { this.arcCalls = 0; }
  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  arc() { this.arcCalls++; }
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  moveTo() {}
  lineTo() {}
  fillText() {}
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = new FakeStyle();
    this.className = '';
    this.classList = new FakeClassList(this);
    this._textContent = '';
    this.clientWidth = 0;
    this.disabled = false;
    this.capturedPointer = null;
    if (this.tagName === 'CANVAS') this.context = new FakeContext();
  }
  append(...items) {
    for (const item of items.flat()) {
      if (item === null || item === undefined) continue;
      if (typeof item === 'string') {
        const text = new FakeElement('#text');
        text.textContent = item;
        this.children.push(text);
        text.parentNode = this;
      } else {
        this.children.push(item);
        item.parentNode = this;
      }
    }
  }
  appendChild(item) { this.append(item); return item; }
  prepend(...items) {
    const nodes = items.flat().filter((item) => item !== null && item !== undefined);
    for (const item of nodes) item.parentNode = this;
    this.children.unshift(...nodes);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  set textContent(value) {
    this._textContent = String(value ?? '');
    this.children = [];
  }
  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join('');
  }
  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === 'class') this.className = stringValue;
    else if (name === 'style') this.style.cssText = stringValue;
    else if (name === 'width' || name === 'height') this[name] = Number(value);
    else this[name] = value;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event = {}) {
    event.target = this;
    event.preventDefault ||= () => {};
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width || 640, height: this.height || 640 };
  }
  getContext() { return this.context; }
  setPointerCapture(pointerId) { this.capturedPointer = pointerId; }
  hasPointerCapture(pointerId) { return this.capturedPointer === pointerId; }
  releasePointerCapture() { this.capturedPointer = null; }
  querySelector(selector) { return findAll(this, selector)[0] || null; }
  querySelectorAll(selector) { return findAll(this, selector); }
}

function matches(element, selector) {
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
  return element.tagName === selector.toUpperCase();
}

function findAll(root, selector) {
  const found = [];
  const visit = (element) => {
    if (matches(element, selector)) found.push(element);
    element.children.forEach(visit);
  };
  visit(root);
  return found;
}

const documentHead = new FakeElement('head');
globalThis.document = {
  head: documentHead,
  createElement: (tagName) => new FakeElement(tagName),
};

const windowListeners = new Map();
let lastMediaQuery = null;
globalThis.window = {
  innerWidth: 375,
  addEventListener(type, listener) {
    if (!windowListeners.has(type)) windowListeners.set(type, new Set());
    windowListeners.get(type).add(listener);
  },
  removeEventListener(type, listener) { windowListeners.get(type)?.delete(listener); },
  matchMedia() {
    const listeners = new Set();
    lastMediaQuery = {
      matches: false,
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
      listenerCount: () => listeners.size,
    };
    return lastMediaQuery;
  },
};
globalThis.getComputedStyle = () => ({
  getPropertyValue(name) {
    return ({
      '--ink': '#111111', '--sub': '#777777', '--line': '#dddddd', '--panel': '#ffffff',
      '--accent': '#3355ff', '--good': '#118844', '--bad': '#cc3322',
    })[name] || '';
  },
});

let nextRafId = 1;
const rafCallbacks = new Map();
globalThis.requestAnimationFrame = (callback) => {
  const id = nextRafId++;
  rafCallbacks.set(id, callback);
  return id;
};
globalThis.cancelAnimationFrame = (id) => rafCallbacks.delete(id);
function stepRaf(time) {
  const entry = rafCallbacks.entries().next().value;
  assert.ok(entry, 'requestAnimationFrame が予約されている');
  const [id, callback] = entry;
  rafCallbacks.delete(id);
  callback(time);
}

function clone(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function makeApi(preloaded = {}) {
  const root = new FakeElement('div');
  root.clientWidth = 351;
  const store = new Map(Object.entries(preloaded).map(([key, value]) => [key, clone(value)]));
  const state = { root, store, hud: {}, buttons: new Map(), notes: [], keys: [], result: null };
  const el = (tag, attrs = {}, ...kids) => {
    const element = new FakeElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') element.className = value;
      else if (key === 'style') element.style.cssText = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value !== null && value !== undefined) element.setAttribute(key, value);
    }
    element.append(...kids);
    return element;
  };
  const api = {
    el,
    add(...nodes) { root.append(...nodes); return nodes[0]; },
    hud(values) { state.hud = { ...values }; return new FakeElement('div'); },
    buttons(items) {
      const bar = new FakeElement('div');
      for (const item of items) {
        const button = el('button', { onclick: item.onClick }, item.label);
        state.buttons.set(item.label, button);
        bar.append(button);
      }
      root.append(bar);
      return bar;
    },
    note(text) { const note = el('div', {}, text); state.notes.push(note); root.append(note); return note; },
    onKey(listener) { state.keys.push(listener); },
    sound() {},
    load(key, fallback) { return store.has(key) ? clone(store.get(key)) : fallback; },
    save(key, value) { store.set(key, clone(value)); },
    rand(limit) { return limit > 1 ? 1 : 0; },
    pick(items) { return items[0]; },
    win(score, text) { state.result = { won: true, score, text }; },
    lose(score, text) { state.result = { won: false, score, text }; },
  };
  return { api, state };
}

const freecell = (await import('./games/freecell.js')).default;
const reversi = (await import('./games/reversi.js')).default;
const breakout = (await import('./games/breakout.js')).default;

// フリーセル: 52枚、標準配札、カード共通部品、保存、レスポンシブ、cleanup。
{
  const { api, state } = makeApi();
  const cleanup = freecell.mount(state.root, api);
  const saved = state.store.get('saved');
  assert.deepEqual(saved.st.tab.map((column) => column.length), [7, 7, 7, 7, 6, 6, 6, 6]);
  assert.equal(saved.st.tab.flat().length, 52);
  assert.ok(saved.st.tab.flat().every((card) => card.up));
  assert.equal(findAll(state.root, '.cd').length, 52);
  assert.equal(findAll(state.root, '.down').length, 0);
  assert.ok(state.buttons.has('戻す'));
  const table = findAll(state.root, '.fc-table')[0];
  assert.ok(Number.parseInt(table.style.width, 10) <= 351);
  cleanup();
  assert.equal(windowListeners.get('resize')?.size || 0, 0);
}

// リバーシ: 初期石、合法手印、プレイヤー初手、CPU応手、listener cleanup。
{
  const { api, state } = makeApi();
  const cleanup = reversi.mount(state.root, api);
  const canvas = findAll(state.root, 'canvas')[0];
  assert.equal(Number(state.hud['黒']) + Number(state.hud['白']), 4);
  assert.ok(canvas.context.arcCalls >= 8, '初期石4個と合法手4個を描画する');
  canvas.dispatch('click', { clientX: 3.5 * 80, clientY: 2.5 * 80 });
  assert.equal(state.hud['手番'], 'CPU思考中');
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(Number(state.hud['黒']) + Number(state.hud['白']), 6);
  assert.equal(state.hud['手番'], 'あなた');
  cleanup();
  assert.equal(canvas.listenerCount('click'), 0);
  assert.equal(lastMediaQuery.listenerCount(), 0);
}

// ブロック崩し: スマホ入力、発射、キー操作、rAF と pointer listener cleanup。
{
  const { api, state } = makeApi();
  const cleanup = breakout.mount(state.root, api);
  const canvas = findAll(state.root, 'canvas')[0];
  assert.match(canvas.style.cssText, /min\(92vw,400px\)/);
  assert.equal(state.hud['残機'], 3);
  assert.equal(state.hud['状態'], '発射待ち');
  canvas.dispatch('pointerdown', { pointerId: 1, clientX: 80 });
  assert.equal(state.hud['状態'], 'プレイ中');
  canvas.dispatch('pointermove', { pointerId: 1, clientX: 300 });
  assert.equal(state.keys.length, 1);
  state.keys[0]({ key: 'ArrowLeft', preventDefault() {} });
  stepRaf(16);
  stepRaf(32);
  cleanup();
  assert.equal(rafCallbacks.size, 0);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    assert.equal(canvas.listenerCount(type), 0);
  }
}

console.log('smoke ok: freecell, reversi, breakout');
