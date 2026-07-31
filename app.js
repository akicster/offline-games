// アプリ本体（シェル）
//
// 役割: ゲーム一覧の表示、検索、お気に入り、起動、共通APIの提供。
// ゲーム本体は games/<id>.js に1本ずつ置き、遊ぶときだけ動的に読み込む。
// 100本入っても起動は重くならない。

import { GAMES, CATS } from './games/manifest.js';

// ---------------------------------------------------------------------------
// 保存領域
// ---------------------------------------------------------------------------
const LS = {
  get(k, d) { try { const v = localStorage.getItem('og:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('og:' + k, JSON.stringify(v)); } catch { /* 容量超過は無視 */ } },
};

let favs = new Set(LS.get('favs', []));
let recent = LS.get('recent', []);
let soundOn = LS.get('sound', true);

// ---------------------------------------------------------------------------
// 音（音源ファイルを持たず、その場で波形を合成する）
// ---------------------------------------------------------------------------
let actx = null;
const TONES = {
  tap:   [{ f: 440, d: 0.05, t: 'square', g: 0.05 }],
  move:  [{ f: 330, d: 0.05, t: 'sine',   g: 0.07 }],
  good:  [{ f: 660, d: 0.07, t: 'sine',   g: 0.09 }, { f: 880, d: 0.09, t: 'sine', g: 0.09, at: 0.06 }],
  bad:   [{ f: 180, d: 0.16, t: 'sawtooth', g: 0.07 }],
  win:   [{ f: 523, d: 0.10, t: 'sine', g: 0.10 }, { f: 659, d: 0.10, t: 'sine', g: 0.10, at: 0.09 },
          { f: 784, d: 0.10, t: 'sine', g: 0.10, at: 0.18 }, { f: 1047, d: 0.20, t: 'sine', g: 0.10, at: 0.27 }],
  lose:  [{ f: 392, d: 0.13, t: 'triangle', g: 0.09 }, { f: 294, d: 0.22, t: 'triangle', g: 0.09, at: 0.12 }],
};

function sound(name) {
  if (!soundOn) return;
  const spec = TONES[name]; if (!spec) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const now = actx.currentTime;
    for (const s of spec) {
      const osc = actx.createOscillator(), gain = actx.createGain();
      osc.type = s.t; osc.frequency.value = s.f;
      const t0 = now + (s.at || 0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(s.g, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + s.d);
      osc.connect(gain); gain.connect(actx.destination);
      osc.start(t0); osc.stop(t0 + s.d + 0.02);
    }
  } catch { /* 音が出せない環境でもゲームは動く */ }
}

// ---------------------------------------------------------------------------
// DOM ヘルパ
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c.nodeType ? c : String(c));
  return n;
}

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------
let curCat = 'all';
let query = '';

function bestKey(id) { return 'best:' + id; }
function getBest(id) { return LS.get(bestKey(id), null); }

function fmtBest(g) {
  const b = getBest(g.id);
  if (b === null) return '';
  if (g.best === 'time') return `最短 ${(b / 1000).toFixed(1)}秒`;
  if (g.best === 'low') return `最少 ${b}`;
  return `最高 ${b}`;
}

function cardOf(g) {
  const isFav = favs.has(g.id);
  const card = el('div', { class: 'card', onclick: () => openGame(g.id) },
    el('span', { class: 'fav' + (isFav ? ' on' : ''), onclick: (e) => { e.stopPropagation(); toggleFav(g.id); } }, isFav ? '★' : '☆'),
    el('div', { class: 'ic' }, g.ic || '🎮'),
    el('div', { class: 'nm' }, g.name),
    el('div', { class: 'ds' }, g.desc),
    el('div', { class: 'bs' }, fmtBest(g)),
  );
  return card;
}

function renderList() {
  const body = $('listBody');
  body.textContent = '';

  const q = query.trim().toLowerCase();
  const match = (g) => (curCat === 'all' || curCat === 'fav' || g.cat === curCat)
    && (!q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q) || (g.kw || '').includes(q));

  let items = GAMES.filter(match);
  if (curCat === 'fav') items = items.filter((g) => favs.has(g.id));

  if (curCat === 'all' && !q) {
    const rec = recent.map((id) => GAMES.find((g) => g.id === id)).filter(Boolean).slice(0, 6);
    if (rec.length) {
      body.append(el('div', { class: 'sec' }, '最近あそんだ'));
      body.append(el('div', { class: 'grid' }, ...rec.map(cardOf)));
    }
    const favList = GAMES.filter((g) => favs.has(g.id));
    if (favList.length) {
      body.append(el('div', { class: 'sec' }, 'お気に入り'));
      body.append(el('div', { class: 'grid' }, ...favList.map(cardOf)));
    }
    body.append(el('div', { class: 'sec' }, `すべて（${GAMES.length}本）`));
  }

  if (items.length === 0) {
    body.append(el('div', { class: 'empty' }, '見つかりませんでした'));
  } else {
    body.append(el('div', { class: 'grid' }, ...items.map(cardOf)));
  }
}

function toggleFav(id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  LS.set('favs', [...favs]);
  sound('tap');
  renderList();
}

function renderCats() {
  const wrap = $('cats');
  wrap.textContent = '';
  const all = [{ id: 'all', name: 'すべて' }, { id: 'fav', name: '★ お気に入り' }, ...CATS];
  for (const c of all) {
    wrap.append(el('button', {
      class: 'cat' + (curCat === c.id ? ' on' : ''),
      onclick: () => { curCat = c.id; renderCats(); renderList(); $('list').scrollTop = 0; },
    }, c.name));
  }
}

// ---------------------------------------------------------------------------
// ゲーム起動
// ---------------------------------------------------------------------------
let current = null;   // { g, cleanup, api }

function makeApi(g) {
  const stage = $('stage');
  let hud = null, btnBar = null;
  const keyHandlers = [];

  const api = {
    id: g.id,
    meta: g,

    // 画面部品 ---------------------------------------------------------
    el,
    /** 盤面などの本体をここに入れる */
    add(...nodes) { stage.append(...nodes); return nodes[0]; },
    /** 上部の得点表示。{ラベル: 値} を渡す */
    hud(obj) {
      if (!hud) { hud = el('div', { class: 'hud' }); stage.prepend(hud); }
      hud.textContent = '';
      for (const [k, v] of Object.entries(obj)) hud.append(el('span', {}, k + ' ', el('b', {}, String(v))));
      return hud;
    },
    /** 下部のボタン列。[{label,onClick,primary}] */
    buttons(list) {
      if (!btnBar) { btnBar = el('div', { class: 'gbtns' }); stage.append(btnBar); }
      btnBar.textContent = '';
      for (const b of list) {
        btnBar.append(el('button', { class: 'gbtn' + (b.primary ? ' primary' : ''), onclick: () => { sound('tap'); b.onClick(); } }, b.label));
      }
      return btnBar;
    },
    note(text) { return api.add(el('div', { class: 'note' }, text)); },

    // 入力 -------------------------------------------------------------
    onKey(fn) { keyHandlers.push(fn); },
    /** 上下左右のスワイプ／矢印キーをまとめて受ける */
    onDir(fn) {
      api.onKey((e) => {
        const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                    w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
        if (m) { e.preventDefault(); fn(m); }
      });
      let sx = 0, sy = 0, tracking = false;
      const el0 = stage;
      const down = (e) => { const p = e.touches ? e.touches[0] : e; sx = p.clientX; sy = p.clientY; tracking = true; };
      const up = (e) => {
        if (!tracking) return; tracking = false;
        const p = e.changedTouches ? e.changedTouches[0] : e;
        const dx = p.clientX - sx, dy = p.clientY - sy;
        if (Math.hypot(dx, dy) < 24) return;
        fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      };
      el0.addEventListener('touchstart', down, { passive: true });
      el0.addEventListener('touchend', up, { passive: true });
      el0.addEventListener('pointerdown', down);
      el0.addEventListener('pointerup', up);
      api._swipeCleanup = () => {
        el0.removeEventListener('touchstart', down);
        el0.removeEventListener('touchend', up);
        el0.removeEventListener('pointerdown', down);
        el0.removeEventListener('pointerup', up);
      };
    },

    // 音・保存 ---------------------------------------------------------
    sound,
    load: (k, d) => LS.get(g.id + ':' + k, d),
    save: (k, v) => LS.set(g.id + ':' + k, v),
    best: () => getBest(g.id),

    // 乱数 -------------------------------------------------------------
    rand: (n) => Math.floor(Math.random() * n),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },

    // 終了 -------------------------------------------------------------
    /** クリア。score は数値（省略可）、text は補足 */
    win(score, text) { finish(true, score, text); },
    /** 失敗・ゲームオーバー */
    lose(score, text) { finish(false, score, text); },

    _keyHandlers: keyHandlers,
  };
  return api;
}

function updateBest(g, score) {
  if (score === undefined || score === null || !g.best) return { best: getBest(g.id), isNew: false };
  const cur = getBest(g.id);
  const better = cur === null || (g.best === 'high' ? score > cur : score < cur);
  if (better) { LS.set(bestKey(g.id), score); return { best: score, isNew: true }; }
  return { best: cur, isNew: false };
}

function finish(won, score, text) {
  if (!current) return;
  const g = current.g;
  const { best, isNew } = updateBest(g, score);
  sound(won ? 'win' : 'lose');
  $('ovTitle').textContent = won ? 'クリア！' : 'ゲームオーバー';
  $('ovScore').textContent = (score === undefined || score === null) ? ''
    : (g.best === 'time' ? `${(score / 1000).toFixed(1)}秒` : String(score));
  const parts = [];
  if (text) parts.push(text);
  if (isNew && best !== null) parts.push('自己ベスト更新！');
  else if (best !== null && g.best) parts.push(g.best === 'time' ? `自己ベスト ${(best / 1000).toFixed(1)}秒` : `自己ベスト ${best}`);
  $('ovText').textContent = parts.join('　');
  $('over').classList.add('show');
}

async function openGame(id, fromHash = false) {
  const g = GAMES.find((x) => x.id === id);
  if (!g) return;
  sound('tap');
  // URL に残すと、特定のゲームを直接共有できる。端末の戻る操作でも一覧に帰れる
  if (!fromHash && location.hash !== '#g=' + id) location.hash = '#g=' + id;

  recent = [id, ...recent.filter((x) => x !== id)].slice(0, 12);
  LS.set('recent', recent);

  document.body.classList.add('playing');
  $('title').textContent = g.name;
  $('backBtn').hidden = false;
  $('restartBtn').hidden = false;
  const stage = $('stage');
  stage.textContent = '';
  stage.append(el('div', { class: 'note' }, '読み込み中…'));

  let mod;
  try {
    mod = await import(`./games/${g.id}.js`);
  } catch (err) {
    stage.textContent = '';
    stage.append(el('div', { class: 'note' }, 'このゲームを読み込めませんでした。'));
    console.error(err);
    return;
  }

  stage.textContent = '';
  const api = makeApi(g);
  const cleanup = (mod.default || mod).mount(stage, api);
  current = { g, api, cleanup };
}

function closeGame(fromHash = false) {
  if (!fromHash && location.hash) {
    // hashchange 経由で closeGame が呼び直される
    history.pushState(null, '', location.pathname + location.search);
  }
  if (current) {
    try { current.cleanup && current.cleanup(); } catch { /* 後始末の失敗は無視 */ }
    try { current.api._swipeCleanup && current.api._swipeCleanup(); } catch { /* 同上 */ }
  }
  current = null;
  $('over').classList.remove('show');
  document.body.classList.remove('playing');
  $('title').textContent = 'オフラインゲーム集';
  $('backBtn').hidden = true;
  $('restartBtn').hidden = true;
  $('stage').textContent = '';
  renderList();
}

function restartGame() {
  if (!current) return;
  const id = current.g.id;
  const keep = current;
  try { keep.cleanup && keep.cleanup(); } catch { /* 無視 */ }
  try { keep.api._swipeCleanup && keep.api._swipeCleanup(); } catch { /* 無視 */ }
  current = null;
  $('over').classList.remove('show');
  openGame(id);
}

// ---------------------------------------------------------------------------
// 配線
// ---------------------------------------------------------------------------
// addEventListener はイベント引数を渡すため、必ず引数なしで呼び直す
$('backBtn').addEventListener('click', () => closeGame());
$('restartBtn').addEventListener('click', () => restartGame());
$('ovBack').addEventListener('click', () => closeGame());
$('ovAgain').addEventListener('click', () => restartGame());
$('q').addEventListener('input', (e) => { query = e.target.value; renderList(); });

$('soundBtn').addEventListener('click', () => {
  soundOn = !soundOn; LS.set('sound', soundOn);
  $('soundBtn').classList.toggle('on', soundOn);
  if (soundOn) sound('good');
});
$('soundBtn').classList.toggle('on', soundOn);

window.addEventListener('keydown', (e) => {
  if (!current) return;
  if (e.key === 'Escape') { closeGame(); return; }
  for (const h of current.api._keyHandlers) h(e);
});

// URL の #g=<id> と画面を同期させる（戻る操作や共有リンクに対応するため）
function syncFromHash() {
  const m = /^#g=([a-z0-9_-]+)$/i.exec(location.hash);
  if (m) {
    if (!current || current.g.id !== m[1]) openGame(m[1], true);
  } else if (current) {
    closeGame(true);
  }
}
window.addEventListener('hashchange', syncFromHash);

renderCats();
renderList();
syncFromHash();

// 広告枠（config.js が無ければ何も起きない）
import('./lib/ads.js').then(async (m) => {
  if (await m.initAds()) m.showAd($('adSlot'));
}).catch(() => { /* 広告が読めなくても本体は動く */ });

// オフライン動作
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* 未対応環境では素通り */ });
}
