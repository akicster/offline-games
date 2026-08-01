// 迷路 — 穴掘り法で作られた迷路を、左上から右下まで進む。

const SIZES = [11, 15, 21];
const CELL_PX = 32;

export default {
  mount(root, api) {
    const sizeSelect = api.el('select', {
      'aria-label': '迷路の大きさ',
      style: 'font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 10px',
      onchange: () => reset(Number(sizeSelect.value)),
    }, ...SIZES.map((n) => api.el('option', { value: n }, `${n}×${n}`)));

    const controls = api.el('div', {
      style: 'width:min(92vw,400px);display:flex;align-items:center;justify-content:center;gap:9px;color:var(--ink)',
    }, api.el('label', { style: 'font-size:14px;color:var(--sub)' }, '大きさ ', sizeSelect));

    const canvas = api.el('canvas', {
      class: 'board',
      style: 'width:min(92vw,400px);max-width:100%;height:auto;display:block;background:var(--line);border:1px solid var(--line);border-radius:10px;touch-action:none',
    });
    api.add(controls, canvas);
    api.note('左上から右下の緑のゴールへ。スワイプ、または矢印キーで進みます');
    api.buttons([{ label: '新しい迷路', onClick: () => reset(size), primary: true }]);

    const ctx = canvas.getContext('2d');
    const dirs = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
      left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };

    let size = SIZES[1];
    let maze = [];
    let player = { x: 1, y: 1 };
    let visited = new Set();
    let steps = 0;
    let startedAt = 0;
    let finalElapsed = 0;
    let finished = false;
    let timer = 0;

    function color(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    // 奇数座標を部屋として深さ優先で掘る。部屋同士の接続は全域木になる。
    function generate(n) {
      const cells = Array.from({ length: n }, () => new Array(n).fill(1));
      const stack = [{ x: 1, y: 1 }];
      cells[1][1] = 0;

      while (stack.length) {
        const cur = stack[stack.length - 1];
        const next = [];
        for (const d of [{ x: 0, y: -2 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 2, y: 0 }]) {
          const nx = cur.x + d.x, ny = cur.y + d.y;
          if (nx > 0 && ny > 0 && nx < n - 1 && ny < n - 1 && cells[ny][nx] === 1) {
            next.push({ x: nx, y: ny, dx: d.x, dy: d.y });
          }
        }

        if (!next.length) {
          stack.pop();
          continue;
        }

        const pick = api.pick(next);
        cells[cur.y + pick.dy / 2][cur.x + pick.dx / 2] = 0;
        cells[pick.y][pick.x] = 0;
        stack.push({ x: pick.x, y: pick.y });
      }
      return cells;
    }

    function draw() {
      const unit = CELL_PX;
      const panel = color('--panel');
      const line = color('--line');
      const accent = color('--accent');
      const good = color('--good');
      const ink = color('--ink');

      ctx.fillStyle = line;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = panel;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (maze[y][x] === 0) ctx.fillRect(x * unit, y * unit, unit, unit);
        }
      }

      // 一度通った通路を薄いアクセント色で残す。
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = accent;
      for (const key of visited) {
        const [x, y] = key.split(',').map(Number);
        ctx.fillRect(x * unit, y * unit, unit, unit);
      }
      ctx.restore();

      const center = (v) => (v + 0.5) * unit;

      // スタート地点
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, unit * 0.12);
      ctx.beginPath();
      ctx.arc(center(1), center(1), unit * 0.27, 0, Math.PI * 2);
      ctx.stroke();

      // ゴール地点
      const goal = size - 2;
      ctx.fillStyle = good;
      ctx.beginPath();
      ctx.moveTo(center(goal), goal * unit + unit * 0.16);
      ctx.lineTo(goal * unit + unit * 0.84, center(goal));
      ctx.lineTo(center(goal), goal * unit + unit * 0.84);
      ctx.lineTo(goal * unit + unit * 0.16, center(goal));
      ctx.closePath();
      ctx.fill();

      // プレイヤー
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(center(player.x), center(player.y), unit * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    function elapsed() {
      return finished ? finalElapsed : Math.max(0, performance.now() - startedAt);
    }

    function updateHud() {
      const best = api.best();
      api.hud({
        '時間': `${(elapsed() / 1000).toFixed(1)}秒`,
        '歩数': steps,
        '最短': best === null ? '—' : `${(best / 1000).toFixed(1)}秒`,
      });
    }

    function move(dir) {
      if (finished) return;
      const d = dirs[dir];
      if (!d) return;
      const nx = player.x + d.x, ny = player.y + d.y;
      if (!maze[ny] || maze[ny][nx] !== 0) {
        api.sound('bad');
        return;
      }

      player = { x: nx, y: ny };
      visited.add(`${nx},${ny}`);
      steps++;
      api.sound('move');
      draw();
      updateHud();

      if (nx === size - 2 && ny === size - 2) {
        finalElapsed = Math.max(1, Math.round(performance.now() - startedAt));
        finished = true;
        clearInterval(timer);
        updateHud();
        api.win(finalElapsed, `${steps}歩でゴール`);
      }
    }

    function reset(nextSize = size) {
      clearInterval(timer);
      size = SIZES.includes(nextSize) ? nextSize : SIZES[1];
      sizeSelect.value = String(size);
      canvas.width = size * CELL_PX;
      canvas.height = size * CELL_PX;
      maze = generate(size);
      player = { x: 1, y: 1 };
      visited = new Set(['1,1']);
      steps = 0;
      finalElapsed = 0;
      finished = false;
      startedAt = performance.now();
      draw();
      updateHud();
      timer = setInterval(updateHud, 100);
    }

    api.onDir(move);
    reset();

    // 終了後も経過表示が動き続けないようにする。
    return () => clearInterval(timer);
  },
};
