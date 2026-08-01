// れんさパズル — 2個ひと組のブロックをつなげて消す落ち物パズル。

const W = 6;
const H = 12;
const COLOR_COUNT = 4;

// 子ブロックの向き（上、右、下、左）。回転は親ブロックを中心に行う。
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export default {
  mount(root, api) {
    const cv = api.el('canvas', {
      class: 'board',
      width: 360,
      height: 720,
      'aria-label': '6列12段のれんさパズル盤面',
      style: 'width:min(92vw,400px,31dvh);height:auto;'
        + 'background:var(--panel);border:1px solid var(--line);border-radius:12px',
    });
    api.add(cv);

    // スマートフォンで押しやすいよう、4操作を同じ幅で並べる。
    const padStyle = 'padding:11px 2px;border-radius:11px;border:1px solid var(--line);'
      + 'background:var(--panel);color:var(--ink);font:inherit;font-size:17px;font-weight:700;'
      + 'cursor:pointer;touch-action:manipulation;user-select:none';
    const pad = api.el('div', {
      style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:7px;width:min(92vw,400px)',
    });
    for (const [label, fn, aria] of [
      ['◀', () => move(-1), '左へ移動'],
      ['▶', () => move(1), '右へ移動'],
      ['回転', rotate, '右回転'],
      ['⤓', hardDrop, '一気に落とす'],
    ]) {
      pad.append(api.el('button', { style: padStyle, 'aria-label': aria, onclick: fn }, label));
    }
    api.add(pad);
    api.note('矢印キー：←→移動、↑回転、↓落下。スペースで一気に落とします');

    const ctx = cv.getContext('2d');
    const CELL = cv.width / W;
    const css = getComputedStyle(document.documentElement);
    const readColor = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    // 定義済みCSS変数を使い、ライト・ダーク両方で判別できる4色にする。
    const palette = [
      readColor('--accent', '#3d5afe'),
      readColor('--good', '#0f9d58'),
      readColor('--warn', '#e8710a'),
      readColor('--bad', '#d93025'),
    ];
    const panelColor = readColor('--panel', '#191921');
    const lineColor = readColor('--line', '#2b2c37');

    let board;
    let piece;
    let score;
    let cleared;
    let lastChain;
    let maxChain;
    let phase;
    let acc;
    let last;
    let raf = 0;
    let disposed = false;

    function pairCells(p) {
      const [dx, dy] = DIRS[p.dir];
      return [
        { x: p.x, y: p.y, color: p.a },
        { x: p.x + dx, y: p.y + dy, color: p.b },
      ];
    }

    function fits(p) {
      for (const cell of pairCells(p)) {
        if (cell.x < 0 || cell.x >= W || cell.y >= H) return false;
        if (cell.y >= 0 && board[cell.y * W + cell.x] !== null) return false;
      }
      return true;
    }

    function makePair() {
      return {
        a: api.rand(COLOR_COUNT),
        b: api.rand(COLOR_COUNT),
        x: Math.floor(W / 2) - 1,
        y: 0,
        dir: 0,
      };
    }

    function updateHud() {
      api.hud({ 'スコア': score, 'れんさ': lastChain || '—', '最高': maxChain || '—' });
    }

    function spawn() {
      piece = makePair();
      acc = 0;
      phase = 'falling';
      if (!fits(piece)) {
        gameOver();
        return;
      }
      draw();
    }

    function move(dx) {
      if (phase !== 'falling' || !piece) return;
      const moved = { ...piece, x: piece.x + dx };
      if (!fits(moved)) {
        api.sound('bad');
        return;
      }
      piece = moved;
      api.sound('tap');
      draw();
    }

    function rotate() {
      if (phase !== 'falling' || !piece) return;
      const dir = (piece.dir + 1) % DIRS.length;
      // 壁や床の近くでは、1マスだけずらして回転を試す。
      for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [0, -1]]) {
        const turned = { ...piece, dir, x: piece.x + kx, y: piece.y + ky };
        if (fits(turned)) {
          piece = turned;
          api.sound('tap');
          draw();
          return;
        }
      }
      api.sound('bad');
    }

    function softDrop() {
      if (phase !== 'falling' || !piece) return;
      const moved = { ...piece, y: piece.y + 1 };
      if (fits(moved)) {
        piece = moved;
        acc = 0;
        draw();
      } else {
        lock();
      }
    }

    function hardDrop() {
      if (phase !== 'falling' || !piece) return;
      let moved = { ...piece, y: piece.y + 1 };
      while (fits(moved)) {
        piece = moved;
        moved = { ...piece, y: piece.y + 1 };
      }
      lock();
    }

    function lock() {
      if (phase !== 'falling' || !piece) return;
      phase = 'resolving';
      const cells = pairCells(piece);
      piece = null;

      // 盤面より上に残ったブロックは置けないため、その場で終了する。
      if (cells.some((cell) => cell.y < 0)) {
        gameOver();
        return;
      }
      for (const cell of cells) board[cell.y * W + cell.x] = cell.color;

      lastChain = resolveChains();
      maxChain = Math.max(maxChain, lastChain);
      if (lastChain > 0) api.sound(lastChain >= 2 ? 'win' : 'good');
      else api.sound('move');
      updateHud();
      draw();

      // 消去と重力の処理後も最上段に残っていれば積み上がり。
      if (board.slice(0, W).some((color) => color !== null)) {
        gameOver();
        return;
      }
      spawn();
    }

    function resolveChains() {
      let chain = 0;
      while (true) {
        const visited = new Array(W * H).fill(false);
        const removing = new Set();

        for (let start = 0; start < W * H; start++) {
          const color = board[start];
          if (color === null || visited[start]) continue;

          const group = [];
          const queue = [start];
          visited[start] = true;
          for (let head = 0; head < queue.length; head++) {
            const index = queue[head];
            group.push(index);
            const x = index % W;
            const y = Math.floor(index / W);
            for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
              if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
              const next = ny * W + nx;
              if (!visited[next] && board[next] === color) {
                visited[next] = true;
                queue.push(next);
              }
            }
          }
          if (group.length >= 4) for (const index of group) removing.add(index);
        }

        if (removing.size === 0) break;
        chain++;
        for (const index of removing) board[index] = null;
        cleared += removing.size;
        // 後の連鎖ほど倍率が上がる。
        score += removing.size * 10 * chain;
        applyGravity();
      }
      return chain;
    }

    function applyGravity() {
      for (let x = 0; x < W; x++) {
        let writeY = H - 1;
        for (let y = H - 1; y >= 0; y--) {
          const color = board[y * W + x];
          if (color === null) continue;
          board[writeY * W + x] = color;
          if (writeY !== y) board[y * W + x] = null;
          writeY--;
        }
        while (writeY >= 0) {
          board[writeY * W + x] = null;
          writeY--;
        }
      }
    }

    function gameOver() {
      if (phase === 'over') return;
      phase = 'over';
      piece = null;
      cancelAnimationFrame(raf);
      updateHud();
      draw();
      api.lose(score, `${cleared}個消去・最高${maxChain}連鎖`);
    }

    api.onKey((e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        move(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        rotate();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        softDrop();
      } else if (e.key === ' ') {
        e.preventDefault();
        hardDrop();
      }
    });

    function drawBlock(color, x, y, alpha = 1) {
      if (y < 0) return;
      const gap = 5;
      const left = x * CELL + gap;
      const top = y * CELL + gap;
      const size = CELL - gap * 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette[color];
      ctx.beginPath();
      ctx.roundRect(left, top, size, size, size * 0.32);
      ctx.fill();
      // 小さな反射を足して、色だけに頼らず形を読み取りやすくする。
      ctx.fillStyle = 'rgba(255,255,255,.24)';
      ctx.beginPath();
      ctx.ellipse(left + size * 0.34, top + size * 0.28, size * 0.16, size * 0.09, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      ctx.fillStyle = panelColor;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      for (let x = 1; x < W; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, cv.height);
        ctx.stroke();
      }
      for (let y = 1; y < H; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(cv.width, y * CELL);
        ctx.stroke();
      }

      for (let i = 0; i < board.length; i++) {
        if (board[i] !== null) drawBlock(board[i], i % W, Math.floor(i / W));
      }

      if (phase === 'falling' && piece) {
        let ghost = piece;
        let candidate = { ...ghost, y: ghost.y + 1 };
        while (fits(candidate)) {
          ghost = candidate;
          candidate = { ...ghost, y: ghost.y + 1 };
        }
        if (ghost.y !== piece.y) {
          for (const cell of pairCells(ghost)) drawBlock(cell.color, cell.x, cell.y, 0.2);
        }
        for (const cell of pairCells(piece)) drawBlock(cell.color, cell.x, cell.y);
      }
    }

    function loop(time) {
      if (disposed || phase === 'over') return;
      raf = requestAnimationFrame(loop);
      if (phase !== 'falling') {
        last = time;
        return;
      }
      if (!last) last = time;
      acc += Math.min(time - last, 100);
      last = time;
      const dropMs = Math.max(220, 700 - Math.floor(score / 500) * 35);
      if (acc >= dropMs) {
        acc %= dropMs;
        softDrop();
      }
    }

    function reset() {
      cancelAnimationFrame(raf);
      board = new Array(W * H).fill(null);
      piece = null;
      score = 0;
      cleared = 0;
      lastChain = 0;
      maxChain = 0;
      phase = 'resolving';
      acc = 0;
      last = 0;
      updateHud();
      spawn();
      raf = requestAnimationFrame(loop);
    }

    reset();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  },
};
