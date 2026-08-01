// カックロ — 白マスに 1〜9 を入れる数字クロスワード。
//
// 連続する白マスの並びごとに、手掛かりの数と合計を一致させる。
// 同じ並びの中で同じ数字は使えない。
//
// 収録している問題はすべて事前に作り、**解がちょうど1通りであることを確認済み**。
// 自動生成のカックロは「解が複数ある」問題が混ざりやすいため。

import { PUZZLES } from '../lib/kakuro-data.js';

// 収録は 6×6 のみ。7×7 以上は解の個数を数える探索が重く、
// 実用的な時間で唯一解の問題を作れないため見送っている。
// より良い解法器（ブロック単位の枝刈り）を入れてから追加する。
const LEVELS = [
  { lv: 1, name: '6×6' },
];

export default {
  mount(root, api) {
    let li = api.load('level', 0);
    let puz = null;         // { W,H,cells,solution,rightSum,downSum,white }
    let vals = null;        // プレイヤーの記入
    let sel = -1;
    let done = false, startAt = 0;
    let cellEls = [];

    const wrap = api.el('div', { style: 'display:flex;flex-direction:column;gap:9px;align-items:center;width:100%' });
    api.add(wrap);

    const selStyle = 'padding:7px 10px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px';
    const lvSel = api.el('select', { style: selStyle, onchange: (e) => { li = Number(e.target.value); api.save('level', li); newGame(); } });
    LEVELS.forEach((l, i) => lvSel.append(api.el('option', { value: i, ...(li === i ? { selected: '' } : {}) }, l.name)));
    api.add(lvSel);

    api.buttons([
      { label: '消す', onClick: () => { if (!done) { vals.fill(0); paintAll(); } } },
      { label: '答えを見る', onClick: reveal },
      { label: '新しい問題', onClick: newGame, primary: true },
    ]);
    api.note('タテ・ヨコそれぞれの並びで、手掛かりの数と合計を合わせます。同じ並びに同じ数字は入れられません。'
      + '収録している問題はすべて、解が1通りであることを確認済みです');

    // ---- 問題の読み込み ----------------------------------------------
    function loadPuzzle(p) {
      const W = p.w, H = p.h;
      const cells = p.s.split('');
      const solution = cells.map((c) => (c === '#' ? -1 : Number(c)));
      const isBlack = (i) => cells[i] === '#';

      // 並び（ブロック）を洗い出し、手掛かりの合計を求める
      const rightSum = new Map(), downSum = new Map();
      for (let y = 0; y < H; y++) {
        let run = [];
        for (let x = 0; x <= W; x++) {
          const i = y * W + x;
          if (x === W || isBlack(i)) {
            if (run.length >= 2) rightSum.set(run[0] - 1, run.reduce((a, c) => a + solution[c], 0));
            run = [];
          } else run.push(i);
        }
      }
      for (let x = 0; x < W; x++) {
        let run = [];
        for (let y = 0; y <= H; y++) {
          const i = y * W + x;
          if (y === H || isBlack(i)) {
            if (run.length >= 2) downSum.set(run[0] - W, run.reduce((a, c) => a + solution[c], 0));
            run = [];
          } else run.push(i);
        }
      }

      const white = [];
      for (let i = 0; i < W * H; i++) if (!isBlack(i)) white.push(i);
      return { W, H, cells, solution, rightSum, downSum, white, isBlack };
    }

    // ---- 描画 --------------------------------------------------------
    function render() {
      const { W, H } = puz;
      const avail = Math.min((root.clientWidth || window.innerWidth) - 24, 400);
      const cell = Math.floor(avail / W);
      const fs = Math.round(cell * 0.46);
      const cs = Math.round(cell * 0.29);

      wrap.textContent = '';
      cellEls = new Array(W * H);
      const grid = api.el('div', {
        style: `display:grid;grid-template-columns:repeat(${W},${cell}px);grid-template-rows:repeat(${H},${cell}px);`
          + 'border:2px solid var(--ink);border-radius:3px;overflow:hidden',
      });

      for (let i = 0; i < W * H; i++) {
        if (puz.isBlack(i)) {
          const r = puz.rightSum.get(i), d = puz.downSum.get(i);
          // 手掛かりのマスは沈んで見えるように、記入するマスよりはっきり暗くする
          const el = api.el('div', {
            style: 'position:relative;background:color-mix(in srgb, var(--ink) 78%, #000);'
              + 'border-right:1px solid rgba(255,255,255,.10);border-bottom:1px solid rgba(255,255,255,.10);'
              + `background-image:${(r || d) ? 'linear-gradient(to bottom right, transparent calc(50% - 0.7px), rgba(255,255,255,.45) 50%, transparent calc(50% + 0.7px))' : 'none'}`,
          });
          const clueStyle = (pos) => `position:absolute;${pos};font-size:${cs}px;color:#fff;line-height:1;font-weight:700;font-variant-numeric:tabular-nums`;
          if (r !== undefined) el.append(api.el('span', { style: clueStyle(`right:${cell * 0.08}px;top:${cell * 0.05}px`) }, String(r)));
          if (d !== undefined) el.append(api.el('span', { style: clueStyle(`left:${cell * 0.08}px;bottom:${cell * 0.05}px`) }, String(d)));
          grid.append(el);
          continue;
        }
        const el = api.el('button', {
          style: `border:0;border-right:1px solid color-mix(in srgb,var(--ink) 25%,transparent);`
            + `border-bottom:1px solid color-mix(in srgb,var(--ink) 25%,transparent);`
            + `background:var(--panel);color:var(--ink);font:inherit;font-size:${fs}px;font-weight:600;cursor:pointer;padding:0`,
          onclick: () => { if (!done) { sel = i; paintAll(); } },
        }, '');
        cellEls[i] = el;
        grid.append(el);
      }
      wrap.append(grid);

      // 数字パッド
      const pad = api.el('div', { style: `display:grid;grid-template-columns:repeat(5,1fr);gap:5px;width:${W * cell}px;max-width:100%` });
      for (let v = 1; v <= 9; v++) {
        pad.append(api.el('button', {
          style: 'padding:11px 0;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:18px;font-weight:700;cursor:pointer',
          onclick: () => put(v),
        }, String(v)));
      }
      pad.append(api.el('button', {
        style: 'padding:11px 0;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px;cursor:pointer',
        onclick: () => put(0),
      }, '消す'));
      wrap.append(pad);

      paintAll();
    }

    /** その並びの中で数字が重複していないか（間違いを赤で知らせるため） */
    function conflicts(i) {
      const v = vals[i];
      if (!v) return false;
      const { W, H } = puz;
      const x = i % W, y = (i / W) | 0;
      for (let k = x - 1; k >= 0 && !puz.isBlack(y * W + k); k--) if (vals[y * W + k] === v) return true;
      for (let k = x + 1; k < W && !puz.isBlack(y * W + k); k++) if (vals[y * W + k] === v) return true;
      for (let k = y - 1; k >= 0 && !puz.isBlack(k * W + x); k--) if (vals[k * W + x] === v) return true;
      for (let k = y + 1; k < H && !puz.isBlack(k * W + x); k++) if (vals[k * W + x] === v) return true;
      return false;
    }

    function paintAll() {
      for (const i of puz.white) {
        const el = cellEls[i];
        if (!el) continue;
        const v = vals[i];
        el.textContent = v ? String(v) : '';
        const bad = conflicts(i);
        // 記入するマスは、手掛かりのマスよりはっきり明るくして「ここに書く」と分かるようにする
        el.style.background = i === sel
          ? 'color-mix(in srgb,var(--accent) 34%,var(--panel))'
          : 'color-mix(in srgb, var(--ink) 12%, var(--panel))';
        el.style.color = bad ? 'var(--bad)' : 'var(--ink)';
      }
      const left = puz.white.filter((i) => !vals[i]).length;
      api.hud({ '残り': left, '最短': api.best() ? `${(api.best() / 1000).toFixed(0)}秒` : '—' });
    }

    function put(v) {
      if (done || sel < 0 || puz.isBlack(sel)) return;
      vals[sel] = v;
      api.sound(v ? 'tap' : 'move');
      paintAll();
      check();
    }

    function check() {
      if (done) return;
      for (const i of puz.white) if (vals[i] !== puz.solution[i]) return;
      done = true;
      api.win(Date.now() - startAt);
    }

    function reveal() {
      if (done) return;
      done = true;
      for (const i of puz.white) vals[i] = puz.solution[i];
      paintAll();
      api.lose(undefined, '答えを表示しました');
    }

    // ---- 出題 --------------------------------------------------------
    function newGame() {
      const lv = LEVELS[li].lv;
      const pool = PUZZLES.filter((p) => p.lv === lv);
      if (!pool.length) { wrap.textContent = ''; wrap.append(api.el('div', { class: 'note' }, 'この大きさの問題がありません')); return; }
      const p = pool[api.rand(pool.length)];
      puz = loadPuzzle(p);
      vals = new Array(puz.W * puz.H).fill(0);
      sel = -1; done = false; startAt = Date.now();
      lvSel.value = String(li);
      render();
    }

    const onResize = () => { if (puz) render(); };
    window.addEventListener('resize', onResize);
    api.onKey((e) => {
      if (/^[1-9]$/.test(e.key)) put(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') put(0);
    });

    newGame();
    return () => window.removeEventListener('resize', onResize);
  },
};
