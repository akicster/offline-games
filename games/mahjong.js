// 麻雀ソリティア — 同じ絵柄の牌を2枚ずつ取り除いていく。
//
// この作品の売りは「配置が必ず解けること」。
// 配牌は逆再生方式で作る。空の盤に対して「いま取れる位置」の組を選び、
// そこへ牌の組を割り当てる、という手順を72回繰り返す。
// こうすると、生成した順番どおりに取れば必ず最後まで消せる配置になる。
// （よくある実装のように牌をランダムに撒くと、絶対に解けない配置が混ざる）

// ---------------------------------------------------------------------------
// 牌の定義
// ---------------------------------------------------------------------------
const KIND = [];
for (let n = 1; n <= 9; n++) KIND.push({ k: 'm' + n, g: 'm', n });   // 萬子
for (let n = 1; n <= 9; n++) KIND.push({ k: 'p' + n, g: 'p', n });   // 筒子
for (let n = 1; n <= 9; n++) KIND.push({ k: 's' + n, g: 's', n });   // 索子
for (const c of ['東', '南', '西', '北']) KIND.push({ k: 'w' + c, g: 'w', c });
for (const c of ['中', '發', '白']) KIND.push({ k: 'd' + c, g: 'd', c });
const FLOWERS = ['梅', '蘭', '菊', '竹'];
const SEASONS = ['春', '夏', '秋', '冬'];

/** 2枚が消せる組み合わせか。花牌どうし・季節牌どうしは絵柄が違っても消せる */
function matches(a, b) {
  if (a.grp === 'f' && b.grp === 'f') return true;
  if (a.grp === 'z' && b.grp === 'z') return true;
  return a.k === b.k;
}

/** 指定した組数ぶんの牌の組を作る（1組=2枚）。同じ種類は最大4枚まで */
function makePairs(shuffle, count) {
  const pool = [];
  for (const kind of KIND) {
    const t = () => ({ k: kind.k, grp: kind.g, n: kind.n, c: kind.c });
    pool.push([t(), t()]);   // 同じ種類が4枚 = 2組
    pool.push([t(), t()]);
  }
  pool.push([{ k: 'f' + FLOWERS[0], grp: 'f', c: FLOWERS[0] }, { k: 'f' + FLOWERS[1], grp: 'f', c: FLOWERS[1] }]);
  pool.push([{ k: 'f' + FLOWERS[2], grp: 'f', c: FLOWERS[2] }, { k: 'f' + FLOWERS[3], grp: 'f', c: FLOWERS[3] }]);
  pool.push([{ k: 'z' + SEASONS[0], grp: 'z', c: SEASONS[0] }, { k: 'z' + SEASONS[1], grp: 'z', c: SEASONS[1] }]);
  pool.push([{ k: 'z' + SEASONS[2], grp: 'z', c: SEASONS[2] }, { k: 'z' + SEASONS[3], grp: 'z', c: SEASONS[3] }]);
  return shuffle(pool).slice(0, count);
}

// ---------------------------------------------------------------------------
// 盤面の形
// 144枚の「亀甲」は牌が小さくなるため、スマホ向けに96枚の小型配置も用意する。
// ---------------------------------------------------------------------------
function turtleSlots() {
  const s = [];
  const add = (x, y, z) => s.push({ x, y, z });

  // 1段目（87マス）
  const rows = [[1, 12], [3, 10], [2, 11], [1, 12], [1, 12], [2, 11], [3, 10], [1, 12]];
  rows.forEach(([a, b], y) => { for (let x = a; x <= b; x++) add(x, y, 0); });
  add(0, 3.5, 0); add(13, 3.5, 0); add(14, 3.5, 0);   // 亀の頭と尻尾

  for (let y = 1; y <= 6; y++) for (let x = 4; x <= 9; x++) add(x, y, 1);   // 2段目 36
  for (let y = 2; y <= 5; y++) for (let x = 5; x <= 8; x++) add(x, y, 2);   // 3段目 16
  for (let y = 3; y <= 4; y++) for (let x = 6; x <= 7; x++) add(x, y, 3);   // 4段目 4
  add(6.5, 3.5, 4);                                                        // 5段目 1
  return s;
}

function compactSlots() {
  const s = [];
  const add = (x, y, z) => s.push({ x, y, z });
  const rows = [[2, 9], [1, 10], [0, 11], [0, 11], [1, 10], [2, 9]];        // 60
  rows.forEach(([a, b], y) => { for (let x = a; x <= b; x++) add(x, y, 0); });
  for (let y = 1; y <= 4; y++) for (let x = 3; x <= 8; x++) add(x, y, 1);   // 24
  for (let y = 2; y <= 3; y++) for (let x = 4; x <= 7; x++) add(x, y, 2);   // 8
  for (let y = 2; y <= 3; y++) for (let x = 5; x <= 6; x++) add(x, y, 3);   // 4
  return s;                                                                 // 合計96
}

const LAYOUTS = {
  compact: { name: '96牌（スマホ向け）', slots: compactSlots, cols: 12, rows: 6 },
  turtle: { name: '144牌（標準・亀甲）', slots: turtleSlots, cols: 15, rows: 8 },
};

const yOverlap = (a, b) => a.y < b.y + 1 && b.y < a.y + 1;

/** その位置が「取れる」か。上に乗られておらず、左右どちらかが空いていること */
function isFree(slot, alive) {
  for (const o of alive) {
    if (o === slot) continue;
    if (o.z > slot.z && o.x < slot.x + 1 && slot.x < o.x + 1 && yOverlap(o, slot)) return false;
  }
  let left = false, right = false;
  for (const o of alive) {
    if (o === slot || o.z !== slot.z || !yOverlap(o, slot)) continue;
    if (o.x < slot.x && o.x + 1 > slot.x - 1) left = true;
    if (o.x > slot.x && o.x < slot.x + 2) right = true;
  }
  return !(left && right);
}

/** 逆再生で配牌する。必ず解ける配置になる */
function deal(shuffle, rand, layoutKey = 'turtle') {
  const L = LAYOUTS[layoutKey] || LAYOUTS.turtle;
  for (let attempt = 0; attempt < 40; attempt++) {
    const slots = L.slots();
    const pairs = makePairs(shuffle, slots.length / 2);
    let alive = slots.slice();
    const order = [];
    let ok = true;

    while (alive.length) {
      const free = alive.filter((s) => isFree(s, alive));
      if (free.length < 2) { ok = false; break; }
      const i = rand(free.length);
      let j = rand(free.length - 1); if (j >= i) j++;
      const [a, b] = [free[i], free[j]];
      const pair = pairs.pop();
      a.tile = pair[0]; b.tile = pair[1];
      order.push([a, b]);
      alive = alive.filter((s) => s !== a && s !== b);
    }
    if (ok) return { slots, order };
  }
  return null;
}

// 生成ロジックの自動検証で使う（画面には関係しない）
export { deal, isFree, turtleSlots, matches };

// ---------------------------------------------------------------------------
// 牌の絵柄を描く
// ---------------------------------------------------------------------------
const NUM_KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function faceHtml(t) {
  if (t.grp === 'm') {
    return `<div class="mj-man"><span class="n">${NUM_KANJI[t.n]}</span><span class="w">萬</span></div>`;
  }
  if (t.grp === 'p') {
    // 筒子は丸を並べる
    const cols = t.n <= 3 ? 1 : (t.n === 5 || t.n === 7 ? 3 : 2);
    const dots = Array.from({ length: t.n }, (_, i) =>
      `<span class="dot" style="background:${i % 2 ? '#1d63c9' : '#c9302c'}"></span>`).join('');
    return `<div class="mj-pin" style="grid-template-columns:repeat(${cols},1fr)">${dots}</div>`;
  }
  if (t.grp === 's') {
    const cols = t.n <= 3 ? 1 : (t.n === 5 || t.n === 7 ? 3 : 2);
    const bars = Array.from({ length: t.n }, (_, i) =>
      `<span class="bar" style="background:${i % 3 === 2 ? '#c9302c' : '#1f8b3d'}"></span>`).join('');
    return `<div class="mj-sou" style="grid-template-columns:repeat(${cols},1fr)">${bars}</div>`;
  }
  if (t.grp === 'd' && t.c === '白') return '<div class="mj-haku"></div>';
  const color = t.c === '中' ? '#c9302c' : t.c === '發' ? '#1f8b3d'
    : t.grp === 'f' ? '#1f8b3d' : t.grp === 'z' ? '#c9302c' : '#1a2a4a';
  return `<div class="mj-ch" style="color:${color}">${t.c}</div>`;
}

let styled = false;
function injectStyles() {
  if (styled) return; styled = true;
  const st = document.createElement('style');
  st.textContent = `
.mj-wrap{position:relative;margin:0 auto;touch-action:manipulation}
.mj-t{position:absolute;background:#f6f3e9;border-radius:calc(var(--tw)*.12);
  border:1px solid #b9b3a0;cursor:pointer;overflow:hidden;
  box-shadow:calc(var(--tw)*.055) calc(var(--tw)*.075) 0 #cdc7b4, 0 1px 3px rgba(0,0,0,.4);
  display:grid;place-items:center;user-select:none}
.mj-t.sel{outline:3px solid #3d5afe;outline-offset:-2px;background:#e6ecff}
.mj-t.hint{outline:3px dashed #0f9d58;outline-offset:-2px}
.mj-t.locked{filter:brightness(.82) saturate(.7)}
.mj-man{display:flex;flex-direction:column;align-items:center;line-height:1;gap:calc(var(--tw)*.04)}
.mj-man .n{font-size:calc(var(--tw)*.40);color:#1a2a4a;font-weight:700}
.mj-man .w{font-size:calc(var(--tw)*.30);color:#c9302c;font-weight:700}
.mj-pin{display:grid;gap:calc(var(--tw)*.07);place-items:center;justify-content:center}
.mj-pin .dot{width:calc(var(--tw)*.17);height:calc(var(--tw)*.17);border-radius:50%;display:block}
.mj-sou{display:grid;gap:calc(var(--tw)*.07);place-items:center;justify-content:center}
.mj-sou .bar{width:calc(var(--tw)*.09);height:calc(var(--tw)*.20);border-radius:calc(var(--tw)*.045);display:block}
.mj-ch{font-size:calc(var(--tw)*.52);font-weight:800;line-height:1}
.mj-haku{width:calc(var(--tw)*.46);height:calc(var(--tw)*.60);border:calc(var(--tw)*.05) solid #1d63c9;border-radius:calc(var(--tw)*.06)}
`;
  document.head.append(st);
}

// ---------------------------------------------------------------------------
export default {
  mount(root, api) {
    injectStyles();

    let slots = [];      // 盤面のマス（tile と el を持つ）
    let alive = [];      // まだ残っているマス
    let sel = null;
    let startAt = 0, done = false, shuffles = 0;
    let history = [];    // 戻す用
    // 狭い画面では既定を小型配置にする（牌が小さすぎて読めなくなるため）
    // 表示領域の実寸で判断する（window.innerWidth は端末やブラウザによって当てにならない）
    const availWidth = () => Math.max(240, (root.clientWidth || window.innerWidth) - 24);
    let layoutKey = api.load('layout', availWidth() < 420 ? 'compact' : 'turtle');

    const wrap = api.el('div', { class: 'mj-wrap' });
    api.add(wrap);

    // ---- 寸法 -------------------------------------------------------
    function layout() {
      const L = LAYOUTS[layoutKey];
      const maxW = Math.min(availWidth(), 560);
      const ux = maxW / (L.cols + 0.6);    // 横1マス
      const uy = ux * 1.30;                // 縦1マス（牌は縦長）
      const dz = ux * 0.13;                // 段の見た目のずれ
      wrap.style.setProperty('--tw', ux + 'px');
      wrap.style.width = maxW + 'px';
      wrap.style.height = (L.rows * uy + 5 * dz + 6) + 'px';
      for (const s of slots) {
        if (!s.el) continue;
        s.el.style.width = ux + 'px';
        s.el.style.height = uy + 'px';
        s.el.style.left = (s.x * ux + ux * 0.3 - s.z * dz) + 'px';
        s.el.style.top = (s.y * uy + 5 - s.z * dz) + 'px';
        // 上の段ほど手前に描く
        s.el.style.zIndex = String(Math.round(s.z * 200 + s.y * 4 + s.x));
      }
    }

    // ---- 描画 -------------------------------------------------------
    function refresh() {
      for (const s of slots) {
        if (!s.el) continue;
        const gone = !alive.includes(s);
        s.el.style.display = gone ? 'none' : '';
        if (gone) continue;
        s.el.classList.toggle('sel', s === sel);
        s.el.classList.toggle('locked', !isFree(s, alive));
        s.el.classList.remove('hint');
      }
      api.hud({ '残り': alive.length, '手詰まり': movesLeft() ? 'なし' : 'あり' });
    }

    function movesLeft() {
      const free = alive.filter((s) => isFree(s, alive));
      for (let i = 0; i < free.length; i++) {
        for (let j = i + 1; j < free.length; j++) if (matches(free[i].tile, free[j].tile)) return [free[i], free[j]];
      }
      return null;
    }

    // ---- 操作 -------------------------------------------------------
    function tap(s) {
      if (done || !alive.includes(s)) return;
      if (!isFree(s, alive)) { api.sound('bad'); return; }
      if (sel === s) { sel = null; api.sound('tap'); refresh(); return; }
      if (!sel) { sel = s; api.sound('tap'); refresh(); return; }

      if (matches(sel.tile, s.tile)) {
        const pair = [sel, s];
        history.push(pair);
        alive = alive.filter((x) => x !== pair[0] && x !== pair[1]);
        sel = null;
        api.sound('good');
        refresh(); save();
        if (!alive.length) {
          done = true;
          api.win(Date.now() - startAt, shuffles ? `シャッフル${shuffles}回` : 'シャッフルなし');
          api.save('saved', null);
        }
      } else {
        sel = s; api.sound('move'); refresh();
      }
    }

    function undo() {
      if (done || !history.length) return;
      const pair = history.pop();
      alive.push(pair[0], pair[1]);
      sel = null;
      api.sound('move');
      refresh(); save();
    }

    function hint() {
      const mv = movesLeft();
      if (!mv) { api.sound('bad'); return; }
      refresh();
      mv[0].el.classList.add('hint'); mv[1].el.classList.add('hint');
      api.sound('tap');
    }

    /** 残っている牌だけを配り直す（手詰まりの救済。標準的な機能） */
    function reshuffle() {
      if (done || alive.length < 2) return;
      const tiles = api.shuffle(alive.map((s) => s.tile));
      alive.forEach((s, i) => { s.tile = tiles[i]; s.el.innerHTML = faceHtml(s.tile); });
      shuffles++; sel = null; history = [];
      api.sound('move');
      refresh(); save();
    }

    // ---- 保存と再開 --------------------------------------------------
    function save() {
      if (done) return;
      api.save('saved', {
        layoutKey,
        tiles: slots.map((s) => s.tile),
        gone: slots.map((s) => !alive.includes(s)),
        elapsed: Date.now() - startAt, shuffles,
      });
    }

    function build(tiles, gone) {
      wrap.textContent = '';
      slots = LAYOUTS[layoutKey].slots();
      slots.forEach((s, i) => {
        s.tile = tiles[i];
        const d = api.el('div', { class: 'mj-t' });
        d.innerHTML = faceHtml(s.tile);
        d.addEventListener('click', () => tap(s));
        s.el = d;
        wrap.append(d);
      });
      alive = slots.filter((_, i) => !(gone && gone[i]));
      sel = null; history = [];
      layout(); refresh();
    }

    function newGame() {
      done = false; shuffles = 0;
      wrap.textContent = '';
      const wait = api.el('div', { class: 'note', style: 'padding:40px 0' }, '配牌しています…');
      wrap.append(wait);
      setTimeout(() => {
        const d = deal(api.shuffle, api.rand, layoutKey);
        if (!d) { wrap.textContent = ''; wrap.append(api.el('div', { class: 'note' }, '配牌に失敗しました')); return; }
        startAt = Date.now();
        api.save('layout', layoutKey);
        build(d.slots.map((s) => s.tile), null);
        save();
      }, 30);
    }

    // ---- 初期化 ------------------------------------------------------
    const laySel = api.el('select', {
      style: 'padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px',
      onchange: (e) => { layoutKey = e.target.value; newGame(); },
    });
    for (const [k, L] of Object.entries(LAYOUTS)) {
      laySel.append(api.el('option', { value: k, ...(layoutKey === k ? { selected: '' } : {}) }, L.name));
    }
    api.add(laySel);

    api.buttons([
      { label: '戻す', onClick: undo },
      { label: 'ヒント', onClick: hint },
      { label: 'シャッフル', onClick: reshuffle },
      { label: '新しい配牌', onClick: newGame, primary: true },
    ]);
    api.note('上に牌が乗っておらず、左右どちらかが空いている牌だけ取れます。配置は必ず最後まで消せることを確認済みです');

    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    const saved = api.load('saved', null);
    const savedLayout = saved && LAYOUTS[saved.layoutKey];
    if (saved && savedLayout && saved.tiles && saved.tiles.length === savedLayout.slots().length) {
      layoutKey = saved.layoutKey;
      laySel.value = layoutKey;
      startAt = Date.now() - (saved.elapsed || 0);
      shuffles = saved.shuffles || 0;
      build(saved.tiles, saved.gone);
    } else {
      newGame();
    }

    return () => { window.removeEventListener('resize', onResize); save(); };
  },
};
