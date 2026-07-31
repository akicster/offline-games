// ナンプレ — 空きマスに1〜9を埋める。タテ・ヨコ・ブロックで数字が重ならないようにする。
//
// この作品の売りは「問題の質」。出題はすべて
//   ・解がちょうど1通り
//   ・当てずっぽうを使わず論理だけで最後まで解ける
// ことを、その場で機械的に検証してから出している。
//
// ※「数独」はニコリの登録商標のため、名称には使わない。

import { generate, shapeOf } from '../lib/sudoku.js';

const LEVELS = [
  { v: 1, name: '入門' }, { v: 2, name: 'やさしい' }, { v: 3, name: 'ふつう' },
  { v: 4, name: 'むずかしい' }, { v: 5, name: '難問' },
];

export default {
  mount(root, api) {
    let N = api.load('N', 9);
    let level = api.load('level', 3);
    let puz = null;          // { N, puzzle, answer }
    let cur = null;          // 現在の盤面（プレイヤーの記入を含む）
    let memo = null;         // メモ（各マスに Set）
    let sel = -1;            // 選択中のマス
    let memoMode = false;
    let mistakes = 0;
    let startAt = 0, tick = null, done = false;

    // ---- 画面の骨格 ----------------------------------------------------
    const boardWrap = api.el('div', { style: 'width:min(92vw,420px);position:relative' });
    const gridEl = api.el('div', { style: 'display:grid;gap:0;background:var(--ink);border:2.5px solid var(--ink);border-radius:4px;overflow:hidden' });
    boardWrap.append(gridEl);
    api.add(boardWrap);

    const padWrap = api.el('div', { style: 'width:min(92vw,420px);display:flex;flex-direction:column;gap:7px' });
    api.add(padWrap);

    const cells = [];

    // ---- 描画 ----------------------------------------------------------
    function buildGrid() {
      const { bw, bh } = shapeOf(N);
      gridEl.style.gridTemplateColumns = `repeat(${N},1fr)`;
      gridEl.textContent = '';
      cells.length = 0;
      for (let i = 0; i < N * N; i++) {
        const r = (i / N) | 0, c = i % N;
        // ブロックの切れ目は太く濃く、内側の線は細く薄くして、3×3のまとまりを見せる
        const thickT = r % bh === 0 && r !== 0;
        const thickL = c % bw === 0 && c !== 0;
        const bt = `${thickT ? 2.5 : 1}px solid ${thickT ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 24%, transparent)'}`;
        const bl = `${thickL ? 2.5 : 1}px solid ${thickL ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 24%, transparent)'}`;
        const cell = api.el('button', {
          style: `aspect-ratio:1;border:0;border-top:${bt};border-left:${bl};`
               + 'background:var(--panel);color:var(--ink);font:inherit;padding:0;cursor:pointer;'
               + 'display:grid;place-items:center;position:relative;line-height:1',
          onclick: () => select(i),
        });
        cells.push(cell); gridEl.append(cell);
      }
    }

    function conflicts(i) {
      // 同じ行・列・ブロックに同じ数字があるか
      const v = cur[i]; if (!v) return false;
      const { bw, bh } = shapeOf(N);
      const r = (i / N) | 0, c = i % N;
      for (let k = 0; k < N; k++) {
        if (k !== c && cur[r * N + k] === v) return true;
        if (k !== r && cur[k * N + c] === v) return true;
      }
      const br = Math.floor(r / bh) * bh, bc = Math.floor(c / bw) * bw;
      for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) {
        const j = (br + dr) * N + bc + dc;
        if (j !== i && cur[j] === v) return true;
      }
      return false;
    }

    function draw() {
      const selVal = sel >= 0 ? cur[sel] : 0;
      const { bw, bh } = shapeOf(N);
      for (let i = 0; i < N * N; i++) {
        const cell = cells[i];
        const given = puz.puzzle[i] !== 0;
        const v = cur[i];
        const isSel = i === sel;
        const sameRow = sel >= 0 && ((i / N) | 0) === ((sel / N) | 0);
        const sameCol = sel >= 0 && (i % N) === (sel % N);
        const sameBlk = sel >= 0
          && Math.floor(((i / N) | 0) / bh) === Math.floor(((sel / N) | 0) / bh)
          && Math.floor((i % N) / bw) === Math.floor((sel % N) / bw);
        const sameVal = selVal && v === selVal;

        let bg = 'var(--panel)';
        if (sameRow || sameCol || sameBlk) bg = 'color-mix(in srgb, var(--accent) 9%, var(--panel))';
        if (sameVal) bg = 'color-mix(in srgb, var(--accent) 22%, var(--panel))';
        if (isSel) bg = 'color-mix(in srgb, var(--accent) 38%, var(--panel))';
        cell.style.background = bg;

        cell.textContent = '';
        if (v) {
          const bad = conflicts(i);
          cell.append(api.el('span', {
            style: `font-size:clamp(15px,${N === 9 ? 4.6 : 6}vw,26px);font-weight:${given ? 800 : 500};`
                 + `color:${bad ? 'var(--bad)' : given ? 'var(--ink)' : 'var(--accent)'}`,
          }, String(v)));
        } else if (memo[i] && memo[i].size) {
          // メモは小さく格子状に並べる
          const box = api.el('div', {
            style: `display:grid;grid-template-columns:repeat(3,1fr);width:100%;height:100%;font-size:clamp(7px,1.8vw,10px);color:var(--sub);place-items:center`,
          });
          for (let m = 1; m <= 9; m++) box.append(api.el('span', {}, memo[i].has(m) ? String(m) : ''));
          cell.append(box);
        }
      }
      const filled = cur.filter((v) => v).length;
      api.hud({ '難易度': LEVELS.find((l) => l.v === puz.level)?.name ?? '—', '残り': N * N - filled, 'ミス': mistakes });
    }

    function select(i) {
      sel = i;
      api.sound('tap');
      draw();
    }

    // ---- 入力 ----------------------------------------------------------
    function put(v) {
      if (done || sel < 0) return;
      if (puz.puzzle[sel] !== 0) return;   // 最初から入っている数字は動かせない

      if (memoMode && v !== 0) {
        if (memo[sel].has(v)) memo[sel].delete(v); else memo[sel].add(v);
        api.sound('move');
        draw(); save();
        return;
      }

      if (v === 0) { cur[sel] = 0; memo[sel].clear(); api.sound('move'); draw(); save(); return; }

      cur[sel] = v;
      memo[sel].clear();
      if (v !== puz.answer[sel]) {
        mistakes++;
        api.sound('bad');
      } else {
        api.sound('good');
        // 確定したら、同じ行・列・ブロックのメモから消してあげる
        for (let k = 0; k < N * N; k++) if (memo[k].size && sameUnit(k, sel)) memo[k].delete(v);
      }
      draw(); save();

      if (cur.every((x, i) => x === puz.answer[i])) {
        done = true;
        clearInterval(tick);
        api.save('saved', null);
        api.win(Date.now() - startAt, `ミス ${mistakes}回`);
      }
    }

    function sameUnit(a, b) {
      const { bw, bh } = shapeOf(N);
      const ra = (a / N) | 0, ca = a % N, rb = (b / N) | 0, cb = b % N;
      return ra === rb || ca === cb
        || (Math.floor(ra / bh) === Math.floor(rb / bh) && Math.floor(ca / bw) === Math.floor(cb / bw));
    }

    function hint() {
      if (done) return;
      const empties = [];
      for (let i = 0; i < N * N; i++) if (cur[i] !== puz.answer[i]) empties.push(i);
      if (!empties.length) return;
      const i = empties[api.rand(empties.length)];
      sel = i;
      cur[i] = puz.answer[i];
      memo[i].clear();
      api.sound('good');
      draw(); save();
      if (cur.every((x, k) => x === puz.answer[k])) {
        done = true; clearInterval(tick); api.save('saved', null);
        api.win(Date.now() - startAt, `ミス ${mistakes}回・ヒント使用`);
      }
    }

    // ---- 数字パッド ----------------------------------------------------
    function buildPad() {
      padWrap.textContent = '';
      const row = api.el('div', { style: `display:grid;grid-template-columns:repeat(${N},1fr);gap:5px` });
      for (let v = 1; v <= N; v++) {
        // 使い切った数字は薄くする
        row.append(api.el('button', {
          style: 'padding:11px 0;border-radius:9px;border:1px solid var(--line);background:var(--panel);'
               + 'color:var(--ink);font:inherit;font-size:19px;font-weight:700;cursor:pointer',
          onclick: () => put(v),
        }, String(v)));
      }
      padWrap.append(row);

      const row2 = api.el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px' });
      const memoBtn = api.el('button', {
        style: padBtnStyle(memoMode),
        onclick: () => { memoMode = !memoMode; memoBtn.style.cssText = padBtnStyle(memoMode); memoBtn.textContent = memoMode ? 'メモ ON' : 'メモ OFF'; api.sound('tap'); },
      }, memoMode ? 'メモ ON' : 'メモ OFF');
      row2.append(memoBtn);
      row2.append(api.el('button', { style: padBtnStyle(false), onclick: () => put(0) }, '消す'));
      row2.append(api.el('button', { style: padBtnStyle(false), onclick: hint }, 'ヒント'));
      padWrap.append(row2);
    }

    function padBtnStyle(on) {
      return 'padding:10px 0;border-radius:9px;border:1px solid var(--line);font:inherit;font-size:13.5px;cursor:pointer;'
        + (on ? 'background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:700'
              : 'background:var(--panel);color:var(--ink)');
    }

    // ---- 保存と再開（通勤中に中断しても続きから遊べるように） ----------
    function save() {
      if (done) return;
      api.save('saved', {
        N, level: puz.level, puzzle: puz.puzzle, answer: puz.answer,
        cur, memo: memo.map((s) => [...s]), mistakes, elapsed: Date.now() - startAt,
      });
    }

    function loadSaved() {
      const s = api.load('saved', null);
      if (!s || !s.puzzle || s.puzzle.length !== s.N * s.N) return false;
      N = s.N;
      puz = { N: s.N, puzzle: s.puzzle, answer: s.answer, level: s.level };
      cur = s.cur.slice();
      memo = s.memo.map((a) => new Set(a));
      mistakes = s.mistakes || 0;
      startAt = Date.now() - (s.elapsed || 0);
      return true;
    }

    // ---- 出題 ----------------------------------------------------------
    function newGame() {
      done = false; sel = -1; mistakes = 0;
      clearInterval(tick);
      gridEl.textContent = '';
      const wait = api.el('div', { class: 'note', style: 'padding:40px 0' }, '問題を作っています…');
      boardWrap.append(wait);

      // 生成は数十〜数百ms かかるので、先に「作っています」を描かせてから走らせる
      setTimeout(() => {
        const p = generate(N, level);
        wait.remove();
        if (!p) { boardWrap.append(api.el('div', { class: 'note' }, '問題を作れませんでした')); return; }
        puz = p;
        cur = p.puzzle.slice();
        memo = Array.from({ length: N * N }, () => new Set());
        startAt = Date.now();
        api.save('N', N); api.save('level', level);
        buildGrid(); buildPad(); draw(); save(); startTick();
      }, 30);
    }

    function startTick() {
      clearInterval(tick);
      tick = setInterval(() => { if (!done) save(); }, 4000);
    }

    // ---- 設定バー ------------------------------------------------------
    const selStyle = 'padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px';
    const sizeSel = api.el('select', { style: selStyle, onchange: (e) => { N = Number(e.target.value); newGame(); } });
    for (const [v, label] of [[4, '4×4'], [6, '6×6'], [9, '9×9']]) {
      sizeSel.append(api.el('option', { value: v, ...(N === v ? { selected: '' } : {}) }, label));
    }
    const lvSel = api.el('select', { style: selStyle, onchange: (e) => { level = Number(e.target.value); newGame(); } });
    for (const l of LEVELS) lvSel.append(api.el('option', { value: l.v, ...(level === l.v ? { selected: '' } : {}) }, l.name));

    api.add(api.el('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap' }, sizeSel, lvSel));
    api.buttons([{ label: '新しい問題', onClick: newGame, primary: true }]);
    api.note('問題はその場で作り、解が1通りであることと、当てずっぽう不要で解けることを毎回確認しています');

    // キーボード
    api.onKey((e) => {
      if (/^[1-9]$/.test(e.key)) { put(Number(e.key)); return; }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { put(0); return; }
      if (sel < 0) return;
      const r = (sel / N) | 0, c = sel % N;
      const mv = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1] }[e.key];
      if (mv) {
        e.preventDefault();
        const [nr, nc] = mv;
        if (nr >= 0 && nc >= 0 && nr < N && nc < N) { sel = nr * N + nc; draw(); }
      }
    });

    // 前回の続きがあれば復元する
    if (loadSaved()) {
      sizeSel.value = String(N); lvSel.value = String(puz.level);
      buildGrid(); buildPad(); draw(); startTick();
    } else {
      newGame();
    }

    return () => { clearInterval(tick); save(); };
  },
};
