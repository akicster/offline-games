// お絵かきロジック（ノノグラム）
//
// 数字は、その行・列で連続して塗るマスの数を、順に並べたもの。
// すべて正しく塗ると絵が現れる。
//
// 出題はすべて機械検証してから出している。
//   ・解がちょうど1通りであること
//   ・行と列を1本ずつ見ていく手筋だけで、当てずっぽうなしに最後まで埋まること

import { generate } from '../lib/nonogram.js';

const SIZES = [
  { W: 5, H: 5, name: '5×5' },
  { W: 10, H: 10, name: '10×10' },
  { W: 15, H: 15, name: '15×15' },
];

const EMPTY = 0, FILL = 1, CROSS = 2;

export default {
  mount(root, api) {
    let si = api.load('size', 1);
    let puz = null;
    let marks = null;       // プレイヤーの塗り（0=なし 1=塗り 2=×）
    let mode = FILL;        // 塗る／×
    let done = false, startAt = 0;
    let drag = null;        // ドラッグ塗り中の状態
    let cellEls = [];       // マスの要素。塗るたびに作り直すとドラッグが途切れるので保持する
    let cellPx = 20;

    const wrap = api.el('div', { style: 'display:flex;flex-direction:column;gap:8px;align-items:center;width:100%' });
    api.add(wrap);

    const selStyle = 'padding:7px 10px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px';
    const sizeSel = api.el('select', { style: selStyle, onchange: (e) => { si = Number(e.target.value); api.save('size', si); newGame(); } });
    SIZES.forEach((s, i) => sizeSel.append(api.el('option', { value: i, ...(si === i ? { selected: '' } : {}) }, s.name)));

    const modeBtn = api.el('button', {
      style: modeStyle(),
      onclick: () => { mode = mode === FILL ? CROSS : FILL; modeBtn.style.cssText = modeStyle(); modeBtn.textContent = mode === FILL ? '塗る' : '× を付ける'; api.sound('tap'); },
    }, '塗る');
    function modeStyle() {
      return 'padding:7px 14px;border-radius:9px;font:inherit;font-size:13px;cursor:pointer;font-weight:700;'
        + (mode === FILL ? 'background:var(--ink);color:var(--panel);border:1px solid transparent'
          : 'background:var(--panel);color:var(--ink);border:1px solid var(--line)');
    }

    api.add(api.el('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap' }, sizeSel, modeBtn));
    api.buttons([
      { label: '消す', onClick: () => { if (done) return; marks.fill(EMPTY); marks.forEach((_, i) => paintCell(i)); updateHud(); } },
      { label: '答えを見る', onClick: reveal },
      { label: '新しい問題', onClick: newGame, primary: true },
    ]);
    api.note('数字は、その並びで連続して塗るマスの数です。'
      + '出題はすべて「解が1通り」「当てずっぽうなしで解ける」ことを確認してから出しています');

    // ---- 描画 --------------------------------------------------------
    function render() {
      const { W, H, rowClues, colClues } = puz;
      const maxRow = Math.max(...rowClues.map((c) => c.length));
      const maxCol = Math.max(...colClues.map((c) => c.length));

      // 画面幅から1マスの大きさを決める
      const avail = Math.min((root.clientWidth || window.innerWidth) - 24, 420);
      const unit = Math.floor(avail / (W + maxRow * 0.62));
      const cell = Math.max(14, Math.min(unit, 34));
      const cw = Math.round(cell * 0.62);            // 手掛かり1文字ぶんの幅
      const fs = Math.max(9, Math.round(cell * 0.44));

      cellPx = cell;
      cellEls = new Array(W * H);
      wrap.textContent = '';
      const grid = api.el('div', {
        style: `display:grid;grid-template-columns:${maxRow * cw}px repeat(${W},${cell}px);`
          + `grid-template-rows:${maxCol * Math.round(cell * 0.72)}px repeat(${H},${cell}px);`
          + 'touch-action:none;user-select:none',
      });

      // 左上の空き
      grid.append(api.el('div', {}));

      // 列の手掛かり
      for (let c = 0; c < W; c++) {
        grid.append(api.el('div', {
          style: `display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:0;`
            + `font-size:${fs}px;line-height:1.15;color:var(--sub);font-variant-numeric:tabular-nums;`
            + `${c % 5 === 0 ? 'border-left:2px solid var(--ink);' : ''}`,
        }, ...colClues[c].map((n) => api.el('span', {}, n === 0 ? '0' : String(n)))));
      }

      for (let r = 0; r < H; r++) {
        // 行の手掛かり
        grid.append(api.el('div', {
          style: `display:flex;justify-content:flex-end;align-items:center;gap:${Math.round(cw * 0.2)}px;`
            + `font-size:${fs}px;color:var(--sub);font-variant-numeric:tabular-nums;padding-right:3px;`
            + `${r % 5 === 0 ? 'border-top:2px solid var(--ink);' : ''}`,
        }, ...rowClues[r].map((n) => api.el('span', {}, n === 0 ? '0' : String(n)))));

        for (let c = 0; c < W; c++) {
          const i = r * W + c;
          const v = marks[i];
          const el = api.el('div', {
            'data-i': i,
            style: `box-sizing:border-box;display:grid;place-items:center;cursor:pointer;`
              + `border-top:${r % 5 === 0 ? 2 : 1}px solid ${r % 5 === 0 ? 'var(--ink)' : 'color-mix(in srgb,var(--ink) 22%,transparent)'};`
              + `border-left:${c % 5 === 0 ? 2 : 1}px solid ${c % 5 === 0 ? 'var(--ink)' : 'color-mix(in srgb,var(--ink) 22%,transparent)'};`
              + `${r === H - 1 ? 'border-bottom:2px solid var(--ink);' : ''}`
              + `${c === W - 1 ? 'border-right:2px solid var(--ink);' : ''}`
              + `background:${v === FILL ? 'var(--ink)' : 'var(--panel)'};`
              + `color:color-mix(in srgb,var(--ink) 45%,transparent);font-size:${Math.round(cell * 0.6)}px;line-height:1`,
          }, v === CROSS ? '×' : '');
          cellEls[i] = el;
          grid.append(el);
        }
      }

      wrap.append(grid);
      bindPaint(grid);
      updateHud();
    }

    /** 1マスだけ描き直す。全体を作り直すとドラッグ中に要素が消えてしまう */
    function paintCell(i) {
      const el = cellEls[i];
      if (!el) return;
      const v = marks[i];
      el.style.background = v === FILL ? 'var(--ink)' : 'var(--panel)';
      el.textContent = v === CROSS ? '×' : '';
    }

    function updateHud() {
      const total = puz.picture.reduce((a, b) => a + b, 0);
      const hit = marks.reduce((a, v, i) => a + (v === FILL && puz.picture[i] === 1 ? 1 : 0), 0);
      api.hud({ '残り': Math.max(0, total - hit), '最短': api.best() ? `${(api.best() / 1000).toFixed(0)}秒` : '—' });
    }

    // ---- 入力（なぞって塗れるようにする） -----------------------------
    function bindPaint(grid) {
      const cellAt = (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el || !el.dataset || el.dataset.i === undefined) return -1;
        return Number(el.dataset.i);
      };
      const apply = (i) => {
        if (i < 0 || done || !drag) return;
        const target = drag.to;
        if (marks[i] === target) return;
        marks[i] = target;
        api.sound(target === EMPTY ? 'move' : 'tap');
        paintCell(i);
        updateHud();
        check();
      };
      grid.addEventListener('pointerdown', (e) => {
        if (done) return;
        const i = cellAt(e.clientX, e.clientY);
        if (i < 0) return;
        e.preventDefault();
        // 端末によっては捕捉に失敗する。失敗しても塗れる方を優先する
        try { grid.setPointerCapture(e.pointerId); } catch { /* 捕捉できなくても続行 */ }
        // 同じ状態を押したら消す、違えば付ける（これを引きずる）
        drag = { to: marks[i] === mode ? EMPTY : mode };
        apply(i);
      });
      grid.addEventListener('pointermove', (e) => {
        if (!drag) return;
        apply(cellAt(e.clientX, e.clientY));
      });
      const end = () => { drag = null; };
      grid.addEventListener('pointerup', end);
      grid.addEventListener('pointercancel', end);
    }

    // ---- 判定 --------------------------------------------------------
    function check() {
      if (done) return;
      for (let i = 0; i < puz.W * puz.H; i++) {
        const want = puz.picture[i] === 1;
        const got = marks[i] === FILL;
        if (want !== got) return;
      }
      done = true;
      api.win(Date.now() - startAt);
    }

    function reveal() {
      if (done) return;
      done = true;
      for (let i = 0; i < puz.W * puz.H; i++) { marks[i] = puz.picture[i] === 1 ? FILL : EMPTY; paintCell(i); }
      updateHud();
      api.lose(undefined, '答えを表示しました');
    }

    // ---- 出題 --------------------------------------------------------
    function newGame() {
      done = false; drag = null;
      wrap.textContent = '';
      wrap.append(api.el('div', { class: 'note', style: 'padding:30px 0' }, '問題を作っています…'));
      setTimeout(() => {
        const { W, H } = SIZES[si];
        let p = null;
        for (let t = 0; t < 40 && !p; t++) p = generate({ W, H, seed: (Math.floor(Math.random() * 2 ** 31) + t * 104729) >>> 0, tries: 600 });
        if (!p) { wrap.textContent = ''; wrap.append(api.el('div', { class: 'note' }, '問題を作れませんでした')); return; }
        puz = p;
        marks = new Array(W * H).fill(EMPTY);
        startAt = Date.now();
        sizeSel.value = String(si);
        render();
      }, 30);
    }

    const onResize = () => { if (puz) render(); };
    window.addEventListener('resize', onResize);

    newGame();
    return () => window.removeEventListener('resize', onResize);
  },
};
