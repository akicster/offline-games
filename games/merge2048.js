// マージ2048 — スワイプ／矢印キーで寄せて、同じ数を合体させる。
//
// 【ゲーム実装のお手本 その1: 盤面をDOMで描く・スワイプ入力・スコア】
// mount(root, api) を default export する。戻り値に後始末の関数を返せる（不要なら省略可）。

const N = 4;
const COLORS = {
  2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'],
  16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'],
  128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'],
  1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'],
};

export default {
  mount(root, api) {
    let grid, score, over, reached;

    const wrap = api.el('div', { style: 'width:min(88vw,360px);aspect-ratio:1;background:#bbada0;border-radius:10px;padding:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;touch-action:none' });
    api.add(wrap);
    api.note('スワイプ、または矢印キーで動かします');
    api.buttons([{ label: 'はじめから', onClick: reset, primary: true }]);

    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const c = api.el('div', { style: 'display:grid;place-items:center;border-radius:6px;font-weight:800;background:rgba(238,228,218,.35)' });
      cells.push(c); wrap.append(c);
    }

    function draw() {
      for (let i = 0; i < N * N; i++) {
        const v = grid[i], c = cells[i];
        if (!v) { c.textContent = ''; c.style.background = 'rgba(238,228,218,.35)'; c.style.color = 'transparent'; continue; }
        const [bg, fg] = COLORS[v] || ['#3c3a32', '#fff'];
        c.textContent = v;
        c.style.background = bg; c.style.color = fg;
        // 桁数に応じて字を縮める
        c.style.fontSize = v < 100 ? 'clamp(20px,7vw,32px)' : v < 1000 ? 'clamp(17px,6vw,27px)' : 'clamp(14px,5vw,22px)';
      }
      api.hud({ 'スコア': score, '最高': api.best() ?? 0 });
    }

    function addTile() {
      const empty = [];
      for (let i = 0; i < N * N; i++) if (!grid[i]) empty.push(i);
      if (!empty.length) return;
      grid[empty[api.rand(empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    }

    // 1列ぶんを左に寄せて合体させる。戻り値: [新しい列, 得点]
    function slideLine(line) {
      const v = line.filter((x) => x);
      let gained = 0;
      for (let i = 0; i < v.length - 1; i++) {
        if (v[i] === v[i + 1]) { v[i] *= 2; gained += v[i]; v.splice(i + 1, 1); }
      }
      while (v.length < N) v.push(0);
      return [v, gained];
    }

    // 方向にかかわらず「左寄せ」に帰着させるための添字計算
    function lineIndices(dir, k) {
      const idx = [];
      for (let i = 0; i < N; i++) {
        if (dir === 'left') idx.push(k * N + i);
        else if (dir === 'right') idx.push(k * N + (N - 1 - i));
        else if (dir === 'up') idx.push(i * N + k);
        else idx.push((N - 1 - i) * N + k);
      }
      return idx;
    }

    function move(dir) {
      if (over) return;
      let moved = false, gained = 0;
      for (let k = 0; k < N; k++) {
        const idx = lineIndices(dir, k);
        const before = idx.map((i) => grid[i]);
        const [after, g] = slideLine(before);
        gained += g;
        for (let i = 0; i < N; i++) {
          if (grid[idx[i]] !== after[i]) moved = true;
          grid[idx[i]] = after[i];
        }
      }
      if (!moved) return;
      score += gained;
      api.sound(gained ? 'good' : 'move');
      addTile();
      draw();

      if (!reached && grid.includes(2048)) {
        reached = true;
        api.win(score, '2048に到達しました。まだ続けられます');
        return;
      }
      if (!canMove()) { over = true; api.lose(score); }
    }

    function canMove() {
      if (grid.includes(0)) return true;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = grid[r * N + c];
        if (c < N - 1 && grid[r * N + c + 1] === v) return true;
        if (r < N - 1 && grid[(r + 1) * N + c] === v) return true;
      }
      return false;
    }

    function reset() {
      grid = new Array(N * N).fill(0);
      score = 0; over = false; reached = false;
      addTile(); addTile();
      draw();
    }

    api.onDir(move);
    reset();
  },
};
