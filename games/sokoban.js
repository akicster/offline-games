// 倉庫番 — 荷物を押して、すべての目的地へ収める。
//
// 面は手で作り、**全10面が本当に解けることを幅優先探索で確認したものだけ**を収録している。
// 自動生成の倉庫番は「解けない面」が混ざりやすく、遊んで面白くないため。
// 最短手数も探索で求めた値を表示している。

import { LEVELS, MIN_MOVES, parseLevel } from '../lib/sokoban.js';

export default {
  mount(root, api) {
    let li = api.load('level', 0);
    let lv = null;          // { W,H,walls,goals }
    let boxes, player, moves, hist, done;
    let cleared = api.load('cleared', {});

    const board = api.el('div', { style: 'position:relative;width:min(92vw,380px)' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'width:100%;height:auto;display:block;touch-action:none';
    board.append(svg);
    api.add(board);

    const picker = api.el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;justify-content:center;max-width:min(92vw,380px)' });
    api.add(picker);

    api.buttons([
      { label: '1手戻す', onClick: undo },
      { label: 'やり直す', onClick: () => load(li) },
      { label: '次の面', onClick: () => load((li + 1) % LEVELS.length), primary: true },
    ]);
    api.note('スワイプ、または矢印キーで動きます。荷物は押すことしかできません。引けないので、壁ぎわに寄せる向きに注意してください');

    // ---- 面の選択 ----------------------------------------------------
    function renderPicker() {
      picker.textContent = '';
      LEVELS.forEach((_, i) => {
        const isNow = i === li, ok = cleared[i];
        picker.append(api.el('button', {
          style: 'width:32px;height:32px;border-radius:8px;font:inherit;font-size:12px;cursor:pointer;font-weight:700;'
            + `border:1px solid ${isNow ? 'transparent' : 'var(--line)'};`
            + `background:${isNow ? 'var(--accent)' : ok ? 'color-mix(in srgb,var(--good) 22%,var(--panel))' : 'var(--panel)'};`
            + `color:${isNow ? 'var(--accent-ink)' : 'var(--ink)'}`,
          onclick: () => load(i),
        }, ok && !isNow ? '✓' : String(i + 1)));
      });
    }

    // ---- 描画 --------------------------------------------------------
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
    const key = (x, y) => x + ',' + y;

    function draw() {
      const { W, H, walls, goals } = lv;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.textContent = '';
      svg.append(mk('rect', { x: 0, y: 0, width: W, height: H, fill: '#1b1e28', rx: 0.15 }));

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const k = key(x, y);
          if (walls.has(k)) {
            svg.append(mk('rect', { x: x + 0.02, y: y + 0.02, width: 0.96, height: 0.96, fill: '#4a5266', rx: 0.1 }));
          } else {
            svg.append(mk('rect', { x, y, width: 1, height: 1, fill: '#252a36' }));
          }
          if (goals.has(k)) {
            svg.append(mk('circle', { cx: x + 0.5, cy: y + 0.5, r: 0.16, fill: 'none', stroke: '#7ac943', 'stroke-width': 0.09 }));
          }
        }
      }

      // 荷物（目的地の上なら色を変える）
      for (const b of boxes) {
        const [x, y] = b.split(',').map(Number);
        const on = lv.goals.has(b);
        svg.append(mk('rect', {
          x: x + 0.13, y: y + 0.13, width: 0.74, height: 0.74, rx: 0.12,
          fill: on ? '#7ac943' : '#d9a441', stroke: on ? '#4f8a25' : '#a97a22', 'stroke-width': 0.07,
        }));
        svg.append(mk('path', {
          d: `M${x + 0.28} ${y + 0.28} L${x + 0.72} ${y + 0.72} M${x + 0.72} ${y + 0.28} L${x + 0.28} ${y + 0.72}`,
          stroke: on ? '#4f8a25' : '#a97a22', 'stroke-width': 0.06, fill: 'none',
        }));
      }

      // 人
      const [px, py] = player.split(',').map(Number);
      svg.append(mk('circle', { cx: px + 0.5, cy: py + 0.42, r: 0.22, fill: '#6c8cff' }));
      svg.append(mk('rect', { x: px + 0.31, y: py + 0.58, width: 0.38, height: 0.26, rx: 0.1, fill: '#6c8cff' }));

      const onGoal = boxes.filter((b) => lv.goals.has(b)).length;
      api.hud({ '面': `${li + 1}/${LEVELS.length}`, '手数': moves, '最短': MIN_MOVES[li], '収めた': `${onGoal}/${boxes.length}` });
    }

    // ---- 操作 --------------------------------------------------------
    function move(dir) {
      if (done) return;
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      if (!d) return;
      const [px, py] = player.split(',').map(Number);
      const nx = px + d[0], ny = py + d[1];
      const nk = key(nx, ny);
      if (lv.walls.has(nk)) { api.sound('bad'); return; }

      const bi = boxes.indexOf(nk);
      if (bi >= 0) {
        const bk = key(nx + d[0], ny + d[1]);
        if (lv.walls.has(bk) || boxes.includes(bk)) { api.sound('bad'); return; }
        hist.push({ p: player, b: boxes.slice() });
        boxes = boxes.slice();
        boxes[bi] = bk;
        boxes.sort();
        player = nk;
        api.sound(lv.goals.has(bk) ? 'good' : 'move');
      } else {
        hist.push({ p: player, b: boxes.slice() });
        player = nk;
        api.sound('tap');
      }
      moves++;
      draw();

      if (boxes.every((b) => lv.goals.has(b))) {
        done = true;
        cleared[li] = true;
        api.save('cleared', cleared);
        renderPicker();
        const extra = moves === MIN_MOVES[li] ? '最短手数ぴったり！' : `最短より${moves - MIN_MOVES[li]}手多い`;
        api.win(moves, extra);
      }
    }

    function undo() {
      if (done || !hist.length) return;
      const s = hist.pop();
      player = s.p; boxes = s.b;
      moves = Math.max(0, moves - 1);
      api.sound('move');
      draw();
    }

    // ---- 読み込み ----------------------------------------------------
    function load(i) {
      li = i;
      api.save('level', li);
      const p = parseLevel(LEVELS[i]);
      lv = p;
      boxes = p.boxes.slice();
      player = p.player;
      moves = 0; hist = []; done = false;
      renderPicker();
      draw();
    }

    api.onDir(move);
    load(Math.min(li, LEVELS.length - 1));
  },
};
