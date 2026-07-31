// LUDO（すごろく式ボードゲーム）
//
// 4色の駒を4つずつ持ち、サイコロを振って一周させ、中央のゴールへ入れる。
// 相手の駒に止まると振り出しに戻せる。★の安全マスでは戻されない。
//
// 盤は 15×15 のマス目。外周の道は 52 マスで、各色は自分の入口から
// 51 マス進んだあと、自分の色のゴール列（5マス）へ入る。

// ---------------------------------------------------------------------------
// 盤面の座標
// ---------------------------------------------------------------------------

/** 外周の道 52 マス（時計回り）。左下の青の入口から始める */
const TRACK = [
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],                  // 0-4  下の腕を上へ
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],              // 5-10 左へ
  [0, 7],                                                       // 11   折り返し
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],              // 12-17 右へ
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],              // 18-23 上の腕を上へ
  [7, 0],                                                       // 24   折り返し
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],              // 25-30 下へ
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],         // 31-36 右へ
  [14, 7],                                                      // 37   折り返し
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],         // 38-43 左へ
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],         // 44-49 下の腕を下へ
  [7, 14],                                                      // 50   折り返し
  [6, 14],                                                      // 51
];

// 参考画像の配置に合わせる: 青=左下 / 黄=左上 / 緑=右上 / 赤=右下
const PLAYERS = [
  { id: 0, name: '青', color: '#3f9ff0', dark: '#2b7cc4', start: 0,
    home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    yard: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]], yardBox: [0, 9] },
  { id: 1, name: '黄', color: '#f5b731', dark: '#c78f18', start: 13,
    home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    yard: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]], yardBox: [0, 0] },
  { id: 2, name: '緑', color: '#7ac943', dark: '#579a2a', start: 26,
    home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    yard: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]], yardBox: [9, 0] },
  { id: 3, name: '赤', color: '#ef5350', dark: '#c13936', start: 39,
    home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    yard: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]], yardBox: [9, 9] },
];

// 安全マス: 各色の入口と、そこから8つ先の★
const SAFE = new Set(PLAYERS.flatMap((p) => [p.start, (p.start + 8) % 52]));

const GOAL = 57;         // ここまで進めば上がり
const TRACK_END = 51;    // 51 まで外周、52〜56 がゴール列

// 駒の進み具合から盤上の座標を求める
function cellOf(p, prog) {
  if (prog === 0) return null;                       // 待機所
  if (prog <= TRACK_END) return TRACK[(p.start + prog - 1) % 52];
  if (prog < GOAL) return p.home[prog - TRACK_END - 1];
  return [7, 7];                                     // 中央のゴール
}

export default {
  mount(root, api) {
    // 参考画像にならい、各席を人間かCPUか選べるようにする
    let kinds = api.load('kinds', ['human', 'cpu', 'cpu', 'cpu']);

    // CPUの強さ。
    // 重要: どちらのモードでも、サイコロは全員まったく同じ乱数から引く。
    // 市販アプリにありがちな「CPUだけ6が出やすい」「必ず踏んでくる」といった
    // 出目の細工は一切していない。違うのは手の選び方だけ。
    let ai = api.load('ai', 'fair');   // 'fair' = 素直 / 'strong' = よく考える（出目は同じ）
    let stats = api.load('dice', null) || [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
    let st = null;         // { pos:[4][4], turn, dice, phase, sixes, winner, order }
    let busy = false;      // CPU思考中などの多重操作よけ
    let timers = [];

    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    // ---- 画面 --------------------------------------------------------
    const board = api.el('div', { style: 'position:relative;width:min(94vw,420px);aspect-ratio:1' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 15 15');
    svg.style.cssText = 'width:100%;height:100%;display:block;touch-action:manipulation';
    board.append(svg);

    const status = api.el('div', { style: 'font-size:14px;font-weight:700;text-align:center;min-height:22px' });
    const diceBtn = api.el('button', {
      style: 'width:74px;height:74px;border-radius:16px;border:2px solid var(--line);background:#fff;'
        + 'cursor:pointer;font-size:34px;font-weight:800;color:#222;display:grid;place-items:center',
      onclick: onDice,
    }, '🎲');

    api.add(status);
    api.add(board);
    api.add(diceBtn);

    // 席の設定（開始前に切り替える）
    const setup = api.el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center' });
    api.add(setup);
    function renderSetup() {
      setup.textContent = '';
      PLAYERS.forEach((p, i) => {
        setup.append(api.el('button', {
          style: 'padding:6px 11px;border-radius:9px;font:inherit;font-size:12.5px;cursor:pointer;'
            + `border:2px solid ${p.color};background:${kinds[i] === 'human' ? p.color : 'transparent'};`
            + `color:${kinds[i] === 'human' ? '#fff' : 'var(--ink)'};font-weight:700`,
          onclick: () => {
            kinds[i] = kinds[i] === 'human' ? 'cpu' : 'human';
            if (kinds.every((k) => k === 'cpu')) kinds[i] = 'human';   // 全部CPUは避ける
            api.save('kinds', kinds);
            renderSetup(); newGame();
          },
        }, `${p.name} ${kinds[i] === 'human' ? 'あなた' : 'CPU'}`));
      });
    }

    // CPUの強さ（出目は変わらない）
    const aiBar = api.el('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap' });
    api.add(aiBar);
    function renderAi() {
      aiBar.textContent = '';
      for (const [k, label, hint] of [
        ['fair', 'CPU 素直', '読みなし・完全公平'],
        ['strong', 'CPU 強い', '読みあり・出目は同じ'],
      ]) {
        aiBar.append(api.el('button', {
          style: 'padding:7px 12px;border-radius:9px;font:inherit;font-size:12.5px;cursor:pointer;'
            + `border:1px solid ${ai === k ? 'transparent' : 'var(--line)'};`
            + `background:${ai === k ? 'var(--accent)' : 'var(--panel)'};`
            + `color:${ai === k ? 'var(--accent-ink)' : 'var(--ink)'};font-weight:${ai === k ? 700 : 400}`,
          title: hint,
          onclick: () => { ai = k; api.save('ai', k); renderAi(); },
        }, label));
      }
    }

    api.buttons([
      { label: '出目の記録', onClick: showStats },
      { label: 'はじめから', onClick: newGame, primary: true },
    ]);
    api.note('サイコロを振り、動かす駒を押します。6が出ると待機所から出せて、もう一度振れます。'
      + '相手の駒に止まると振り出しに戻せます（★と入口は安全）。\n'
      + 'サイコロは全席まったく同じ乱数から引いています。CPUだけ6が出やすい、必ず踏んでくる、といった細工はしていません。'
      + '「出目の記録」で自分で確かめられます。');

    // ---- 描画 --------------------------------------------------------
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };

    function drawBoard() {
      svg.textContent = '';
      svg.append(mk('rect', { x: 0, y: 0, width: 15, height: 15, fill: '#fff', stroke: '#333', 'stroke-width': 0.12 }));

      // 待機所（四隅）
      for (const p of PLAYERS) {
        const [bx, by] = p.yardBox;
        svg.append(mk('rect', { x: bx, y: by, width: 6, height: 6, fill: p.color, rx: 0.3 }));
        svg.append(mk('rect', { x: bx + 0.8, y: by + 0.8, width: 4.4, height: 4.4, fill: '#fff', rx: 0.3 }));
      }

      // 外周の道
      TRACK.forEach(([x, y], i) => {
        const owner = PLAYERS.find((p) => p.start === i);
        svg.append(mk('rect', {
          x, y, width: 1, height: 1,
          fill: owner ? owner.color : '#fff', stroke: '#9aa0a6', 'stroke-width': 0.04,
        }));
        if (SAFE.has(i) && !owner) {
          svg.append(mk('path', {
            d: star(x + 0.5, y + 0.5, 0.34, 0.15),
            fill: 'none', stroke: '#9aa0a6', 'stroke-width': 0.07,
          }));
        }
      });

      // ゴール列
      for (const p of PLAYERS) {
        for (const [x, y] of p.home) {
          svg.append(mk('rect', { x, y, width: 1, height: 1, fill: p.color, stroke: '#fff', 'stroke-width': 0.04 }));
        }
      }

      // 中央（4色の三角形）
      const tri = [
        [[6, 6], [9, 6], [7.5, 7.5]],   // 上 = 緑
        [[9, 6], [9, 9], [7.5, 7.5]],   // 右 = 赤
        [[6, 9], [9, 9], [7.5, 7.5]],   // 下 = 青
        [[6, 6], [6, 9], [7.5, 7.5]],   // 左 = 黄
      ];
      const triColor = [PLAYERS[2].color, PLAYERS[3].color, PLAYERS[0].color, PLAYERS[1].color];
      tri.forEach((pts, i) => {
        svg.append(mk('polygon', { points: pts.map((q) => q.join(',')).join(' '), fill: triColor[i], stroke: '#fff', 'stroke-width': 0.05 }));
      });
    }

    function star(cx, cy, R, r) {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 ? r : R;
        d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(3) + ' ' + (cy + Math.sin(a) * rad).toFixed(3);
      }
      return d + 'Z';
    }

    function drawTokens() {
      [...svg.querySelectorAll('.tk')].forEach((e) => e.remove());
      const movable = legalMoves(st.turn, st.dice);
      const canPick = st.phase === 'move' && kinds[st.turn] === 'human' && !st.winner;

      // 同じマスに複数あるとき少しずらす
      const at = new Map();
      for (const p of PLAYERS) {
        for (let k = 0; k < 4; k++) {
          const prog = st.pos[p.id][k];
          const c = prog === 0 ? p.yard[k] : cellOf(p, prog);
          const key = prog === 0 ? `y${p.id}${k}` : c.join(',');
          const list = at.get(key) || []; list.push({ p, k, c, prog }); at.set(key, list);
        }
      }

      for (const [, list] of at) {
        list.forEach((t, idx) => {
          const n = list.length;
          const off = n > 1 ? (idx - (n - 1) / 2) * 0.22 : 0;
          const cx = (t.prog === 0 ? t.c[0] : t.c[0] + 0.5) + off;
          const cy = (t.prog === 0 ? t.c[1] : t.c[1] + 0.5) + (n > 2 ? off * 0.5 : 0);
          const isMovable = canPick && movable.some((m) => m.k === t.k) && t.p.id === st.turn;
          const g = mk('g', { class: 'tk', style: isMovable ? 'cursor:pointer' : '' });
          g.append(mk('circle', { cx, cy, r: 0.36, fill: t.p.dark, opacity: 0.35 }));
          g.append(mk('circle', { cx, cy: cy - 0.05, r: 0.33, fill: t.p.color, stroke: '#fff', 'stroke-width': 0.09 }));
          if (isMovable) {
            g.append(mk('circle', { cx, cy: cy - 0.05, r: 0.46, fill: 'none', stroke: '#111', 'stroke-width': 0.08, opacity: 0.8 }));
            g.addEventListener('click', () => pick(t.k));
          }
          svg.append(g);
        });
      }
    }

    // ---- ルール ------------------------------------------------------
    /** その駒をその出目で動かせるか */
    function canMove(pi, k, d) {
      const prog = st.pos[pi][k];
      if (prog === 0) return d === 6;          // 待機所からは6でのみ出られる
      if (prog >= GOAL) return false;          // 上がり済み
      return prog + d <= GOAL;                 // ゴールはぴったりでないと入れない
    }

    function legalMoves(pi, d) {
      if (!d) return [];
      const out = [];
      for (let k = 0; k < 4; k++) if (canMove(pi, k, d)) out.push({ k, to: st.pos[pi][k] === 0 ? 1 : st.pos[pi][k] + d });
      return out;
    }

    /** 動かす。戻り値: { captured, goaled } */
    function apply(pi, k, d) {
      const from = st.pos[pi][k];
      const to = from === 0 ? 1 : from + d;
      st.pos[pi][k] = to;

      let captured = false;
      if (to <= TRACK_END) {
        const cell = (PLAYERS[pi].start + to - 1) % 52;
        if (!SAFE.has(cell)) {
          for (const q of PLAYERS) {
            if (q.id === pi) continue;
            for (let j = 0; j < 4; j++) {
              const op = st.pos[q.id][j];
              if (op === 0 || op > TRACK_END) continue;
              if ((q.start + op - 1) % 52 === cell) { st.pos[q.id][j] = 0; captured = true; }
            }
          }
        }
      }
      return { captured, goaled: to === GOAL };
    }

    // ---- 進行 --------------------------------------------------------
    function setStatus(text) { status.textContent = text; status.style.color = PLAYERS[st.turn].color; }

    function onDice() {
      if (busy || st.winner) return;
      if (st.phase !== 'roll') return;
      if (kinds[st.turn] !== 'human') return;
      roll();
    }

    function roll() {
      busy = true;
      st.phase = 'rolling';
      let n = 0;
      const spin = () => {
        n++;
        const v = 1 + api.rand(6);
        diceBtn.textContent = '⚀⚁⚂⚃⚄⚅'[v - 1];
        if (n < 8) later(spin, 55);
        else finishRoll();
      };
      api.sound('tap');
      spin();
    }

    function finishRoll() {
      // 全席がこの1行を共有する。席によって確率を変える処理はどこにも無い
      const d = 1 + api.rand(6);
      stats[st.turn][d - 1]++;
      api.save('dice', stats);
      st.dice = d;
      diceBtn.textContent = '⚀⚁⚂⚃⚄⚅'[d - 1];
      const moves = legalMoves(st.turn, d);

      if (moves.length === 0) {
        setStatus(`${PLAYERS[st.turn].name}　${d} — 動かせる駒がありません`);
        api.sound('bad');
        later(() => { nextTurn(d === 6); }, 750);
        busy = false;
        return;
      }

      st.phase = 'move';
      drawTokens();
      if (kinds[st.turn] === 'human') {
        setStatus(moves.length === 1 ? `${PLAYERS[st.turn].name}　${d} — 駒を押してください` : `${PLAYERS[st.turn].name}　${d} — どの駒を動かしますか`);
        busy = false;
        if (moves.length === 1) later(() => pick(moves[0].k), 350);   // 選択肢が1つなら自動で進める
      } else {
        setStatus(`${PLAYERS[st.turn].name}（CPU）　${d}`);
        later(() => { const m = chooseCpu(st.turn, d, moves); pick(m.k); }, 550);
      }
    }

    function pick(k) {
      if (st.phase !== 'move' || st.winner) return;
      const d = st.dice;
      if (!canMove(st.turn, k, d)) { api.sound('bad'); return; }
      busy = true;
      const r = apply(st.turn, k, d);
      api.sound(r.captured ? 'win' : r.goaled ? 'good' : 'move');
      drawTokens();

      if (st.pos[st.turn].every((v) => v === GOAL)) {
        // 勝者と勝敗はこの時点で確定させる。
        // タイマーの中で st.turn を読むと、その間に手番が進んで取り違える。
        const winner = st.turn;
        const iWon = kinds[winner] === 'human';
        st.winner = winner;
        clearTimers();          // 予約済みの進行が決着後に走って表示を上書きしないようにする
        setStatus(`${PLAYERS[winner].name}の勝ち`);
        drawTokens();
        api.save('saved', null);
        later(() => {
          if (iWon) api.win(undefined, `${PLAYERS[winner].name}（あなた）の勝ちです`);
          else api.lose(undefined, `${PLAYERS[winner].name}（CPU）の勝ちです`);
        }, 500);
        busy = false;
        return;
      }

      // 6・駒を戻した・上がった のいずれかならもう一度振れる
      later(() => nextTurn(d === 6 || r.captured || r.goaled), 450);
      busy = false;
    }

    function nextTurn(again) {
      if (st.winner) return;
      if (again) {
        st.sixes = st.dice === 6 ? st.sixes + 1 : 0;
        if (st.sixes >= 3) { st.sixes = 0; again = false; }   // 6の連続は3回まで
      } else {
        st.sixes = 0;
      }
      if (!again) {
        do { st.turn = (st.turn + 1) % 4; } while (st.pos[st.turn].every((v) => v === GOAL));
      }
      st.phase = 'roll';
      st.dice = 0;
      diceBtn.textContent = '🎲';
      drawTokens();
      if (kinds[st.turn] === 'human') {
        setStatus(`${PLAYERS[st.turn].name}の番　サイコロを振ってください`);
      } else {
        setStatus(`${PLAYERS[st.turn].name}（CPU）の番`);
        later(roll, 500);
      }
      save();
    }

    /** 移動先で相手の駒を戻せるなら、その相手の進み具合を返す（戻せないなら0） */
    function captureValue(pi, to) {
      if (to > TRACK_END) return 0;
      const cell = (PLAYERS[pi].start + to - 1) % 52;
      if (SAFE.has(cell)) return 0;
      let best = 0;
      for (const q of PLAYERS) {
        if (q.id === pi) continue;
        for (let j = 0; j < 4; j++) {
          const op = st.pos[q.id][j];
          if (op > 0 && op <= TRACK_END && (q.start + op - 1) % 52 === cell) best = Math.max(best, op);
        }
      }
      return best;
    }

    /** その位置が、次の相手の番に踏まれうるか（1〜6マス後ろに相手がいるか）を数える */
    function threatCount(pi, to) {
      if (to === 0 || to > TRACK_END) return 0;
      const cell = (PLAYERS[pi].start + to - 1) % 52;
      if (SAFE.has(cell)) return 0;             // ★と入口では戻されない
      let n = 0;
      for (const q of PLAYERS) {
        if (q.id === pi) continue;
        for (let j = 0; j < 4; j++) {
          const op = st.pos[q.id][j];
          if (op <= 0 || op > TRACK_END) continue;
          const from = (q.start + op - 1) % 52;
          const gap = (cell - from + 52) % 52;
          if (gap >= 1 && gap <= 6) n++;
        }
      }
      return n;
    }

    /**
     * CPUの手選び。
     * 'fair'   … 素直に指す。危険の読みはしない
     * 'strong' … 踏まれる危険と安全マスまで読む。ただし**出目には一切手を加えない**
     */
    function chooseCpu(pi, d, moves) {
      const scoreFair = (m) => {
        const from = st.pos[pi][m.k], to = m.to;
        if (to === GOAL) return 1000;
        const cap = captureValue(pi, to);
        if (cap) return 800 + cap;
        if (from === 0) return 600;
        if (to > TRACK_END) return 500 + to;
        return 100 + to;
      };

      const scoreStrong = (m) => {
        const from = st.pos[pi][m.k], to = m.to;
        let s = 0;
        if (to === GOAL) return 2000;
        const cap = captureValue(pi, to);
        if (cap) s += 700 + cap * 4;                       // 進んでいる駒ほど戻す価値が高い
        if (to > TRACK_END) s += 450 + to * 2;             // ゴール列は安全
        if (from === 0) {
          const onBoard = st.pos[pi].filter((v) => v > 0 && v < GOAL).length;
          s += onBoard < 2 ? 520 : 300;                    // 盤上が手薄なら出す価値が高い
        }
        const cell = to <= TRACK_END ? (PLAYERS[pi].start + to - 1) % 52 : -1;
        if (cell >= 0 && SAFE.has(cell)) s += 130;         // 安全マスに乗る
        s -= threatCount(pi, to) * 95;                     // 踏まれる位置は避ける
        s += threatCount(pi, from) * 60;                   // 危ない駒を逃がすのは得
        s += to * 2;                                       // 基本は進める
        return s;
      };

      const score = ai === 'strong' ? scoreStrong : scoreFair;
      let best = moves[0], bestS = score(moves[0]);
      for (const m of moves.slice(1)) {
        const v = score(m);
        // 同点はランダムに散らす（毎回同じ打ち回しにしない）
        if (v > bestS || (v === bestS && api.rand(2) === 0)) { best = m; bestS = v; }
      }
      return best;
    }

    /** 出目の記録を見せる。細工していないことを利用者自身が確かめられるようにする */
    function showStats() {
      const total = stats.flat().reduce((a, b) => a + b, 0);
      const lines = PLAYERS.map((p, i) => {
        const t = stats[i].reduce((a, b) => a + b, 0);
        const six = t ? ((stats[i][5] / t) * 100).toFixed(1) : '—';
        return `${p.name}　${stats[i].join(' / ')}　計${t}回　6の割合 ${six}%`;
      });
      status.style.color = 'var(--ink)';
      status.textContent = '';
      const box = api.el('div', {
        style: 'font-size:11.5px;line-height:1.9;color:var(--sub);text-align:left;white-space:pre-wrap;'
          + 'background:color-mix(in srgb,var(--ink) 6%,transparent);padding:10px 12px;border-radius:9px;max-width:340px;margin:0 auto',
      }, `出目の記録（1/2/3/4/5/6）　総計${total}回\n` + lines.join('\n')
        + '\n\n回数を重ねるほど、どの席も 6 の割合は約16.7%に近づきます。\nサイコロは全席まったく同じ処理で引いており、席によって確率を変える仕掛けはありません。');
      status.append(box);
    }

    // ---- 保存 --------------------------------------------------------
    function save() {
      if (!st || st.winner) { api.save('saved', null); return; }
      api.save('saved', { pos: st.pos, turn: st.turn, kinds });
    }

    function newGame() {
      clearTimers();
      st = { pos: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], turn: 0, dice: 0, phase: 'roll', sixes: 0, winner: null };
      // 人間の席から始める
      const first = kinds.findIndex((k) => k === 'human');
      st.turn = first < 0 ? 0 : first;
      busy = false;
      diceBtn.textContent = '🎲';
      drawBoard(); drawTokens();
      setStatus(kinds[st.turn] === 'human' ? `${PLAYERS[st.turn].name}の番　サイコロを振ってください` : `${PLAYERS[st.turn].name}（CPU）の番`);
      if (kinds[st.turn] !== 'human') later(roll, 600);
      save();
    }

    // ---- 起動 --------------------------------------------------------
    renderSetup();
    renderAi();
    const saved = api.load('saved', null);
    if (saved && Array.isArray(saved.pos) && saved.pos.length === 4) {
      kinds = saved.kinds || kinds;
      st = { pos: saved.pos, turn: saved.turn || 0, dice: 0, phase: 'roll', sixes: 0, winner: null };
      renderSetup();
      drawBoard(); drawTokens();
      setStatus(kinds[st.turn] === 'human' ? `${PLAYERS[st.turn].name}の番　サイコロを振ってください` : `${PLAYERS[st.turn].name}（CPU）の番`);
      if (kinds[st.turn] !== 'human') later(roll, 600);
    } else {
      newGame();
    }

    return () => { clearTimers(); save(); };
  },
};
