// 五目並べ — あなたが黒の先手。縦・横・斜めに5個以上並べれば勝ち。

const N = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export default {
  mount(root, api) {
    const SIZE = 600;
    const PAD = 30;
    const GAP = (SIZE - PAD * 2) / (N - 1);
    const STONE_R = GAP * 0.41;

    const canvas = api.el('canvas', {
      class: 'board',
      width: SIZE,
      height: SIZE,
      role: 'grid',
      'aria-label': '15かける15の五目並べ盤',
      style: 'width:min(92vw,400px);height:auto;background:var(--panel);'
        + 'border:1px solid var(--line);border-radius:12px;cursor:pointer;touch-action:manipulation',
      onclick: onBoardTap,
    });
    api.add(canvas);
    api.note('あなたは黒（先手）です。空いている交点をタップしてください。青い印が最後の石です');
    const buttonBar = api.buttons([
      { label: '待った（2手戻す）', onClick: undo },
      { label: 'はじめから', onClick: reset, primary: true },
    ]);
    const undoButton = buttonBar.querySelector('button');

    const ctx = canvas.getContext('2d');
    const board = new Uint8Array(N * N);
    const history = [];
    let done = false;
    let thinking = false;
    let cpuTimer = null;

    function cssColor(name) {
      return getComputedStyle(root).getPropertyValue(name).trim();
    }

    function inside(row, col) {
      return row >= 0 && row < N && col >= 0 && col < N;
    }

    function toIndex(row, col) {
      return row * N + col;
    }

    function drawStone(index, stone, last) {
      const row = (index / N) | 0;
      const col = index % N;
      const x = PAD + col * GAP;
      const y = PAD + row * GAP;
      const ink = cssColor('--ink');
      const panel = cssColor('--panel');
      const sub = cssColor('--sub');
      const accent = cssColor('--accent');

      ctx.beginPath();
      ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
      ctx.fillStyle = stone === BLACK ? ink : panel;
      ctx.fill();
      ctx.strokeStyle = stone === BLACK ? sub : ink;
      ctx.lineWidth = stone === BLACK ? 2 : 4;
      ctx.stroke();

      if (last) {
        // 輪と中央の点を併用し、黒石・白石のどちらでも最後の手を見分けやすくする。
        ctx.beginPath();
        ctx.arc(x, y, STONE_R + 4, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
      }
    }

    function draw() {
      const panel = cssColor('--panel');
      const line = cssColor('--line');
      const sub = cssColor('--sub');

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = panel;
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const p = PAD + i * GAP;
        ctx.moveTo(PAD, p);
        ctx.lineTo(SIZE - PAD, p);
        ctx.moveTo(p, PAD);
        ctx.lineTo(p, SIZE - PAD);
      }
      ctx.stroke();

      // 盤面の目安になる星を置く。
      ctx.fillStyle = sub;
      for (const row of [3, 7, 11]) {
        for (const col of [3, 7, 11]) {
          ctx.beginPath();
          ctx.arc(PAD + col * GAP, PAD + row * GAP, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const last = history.length ? history[history.length - 1] : -1;
      for (let i = 0; i < board.length; i++) {
        if (board[i] !== EMPTY) drawStone(i, board[i], i === last);
      }

      const turn = done ? '終了' : thinking ? 'CPU（白）' : 'あなた（黒）';
      api.hud({ '手番': turn, '石数': history.length });
      const canUndo = !done && !thinking && history.length >= 2;
      undoButton.disabled = !canUndo;
      undoButton.style.opacity = canUndo ? '1' : '.45';
      undoButton.style.cursor = canUndo ? 'pointer' : 'default';
    }

    function countLine(index, stone, dr, dc) {
      const row = (index / N) | 0;
      const col = index % N;
      let count = 1;

      for (const sign of [-1, 1]) {
        let r = row + dr * sign;
        let c = col + dc * sign;
        while (inside(r, c) && board[toIndex(r, c)] === stone) {
          count++;
          r += dr * sign;
          c += dc * sign;
        }
      }
      return count;
    }

    function hasFive(index, stone) {
      return DIRECTIONS.some(([dr, dc]) => countLine(index, stone, dr, dc) >= 5);
    }

    function wouldWin(index, stone) {
      board[index] = stone;
      const wins = hasFive(index, stone);
      board[index] = EMPTY;
      return wins;
    }

    function lineShape(index, stone, dr, dc) {
      const row = (index / N) | 0;
      const col = index % N;
      let length = 1;
      let openEnds = 0;

      for (const sign of [-1, 1]) {
        let r = row + dr * sign;
        let c = col + dc * sign;
        while (inside(r, c) && board[toIndex(r, c)] === stone) {
          length++;
          r += dr * sign;
          c += dc * sign;
        }
        if (inside(r, c) && board[toIndex(r, c)] === EMPTY) openEnds++;
      }
      return { length, openEnds };
    }

    function patternScore(index, stone) {
      board[index] = stone;
      let score = 0;
      for (const [dr, dc] of DIRECTIONS) {
        const { length, openEnds } = lineShape(index, stone, dr, dc);
        if (length >= 5) score += 100000;
        else if (length === 4) score += openEnds === 2 ? 18000 : 9000;
        else if (length === 3) score += openEnds === 2 ? 4500 : openEnds === 1 ? 1300 : 0;
        else if (length === 2) score += openEnds === 2 ? 400 : openEnds === 1 ? 100 : 0;
        else if (openEnds === 2) score += 18;
      }
      board[index] = EMPTY;
      return score;
    }

    function nearbyScore(index) {
      const row = (index / N) | 0;
      const col = index % N;
      let score = 0;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if ((dr === 0 && dc === 0) || !inside(row + dr, col + dc)) continue;
          if (board[toIndex(row + dr, col + dc)] !== EMPTY) {
            score += Math.max(1, 5 - Math.abs(dr) - Math.abs(dc));
          }
        }
      }
      return score;
    }

    function centerScore(index) {
      const row = (index / N) | 0;
      const col = index % N;
      return 42 - (Math.abs(row - 7) + Math.abs(col - 7)) * 2;
    }

    function mostCentral(indices) {
      let best = -Infinity;
      let choices = [];
      for (const index of indices) {
        const score = centerScore(index) + nearbyScore(index);
        if (score > best) {
          best = score;
          choices = [index];
        } else if (score === best) {
          choices.push(index);
        }
      }
      return api.pick(choices);
    }

    function chooseCpuMove() {
      const empty = [];
      for (let i = 0; i < board.length; i++) {
        if (board[i] === EMPTY) empty.push(i);
      }

      // 1. 勝てる手、2. 相手の勝ちを止める手を最優先する。
      const wins = empty.filter((index) => wouldWin(index, WHITE));
      if (wins.length) return mostCentral(wins);
      const blocks = empty.filter((index) => wouldWin(index, BLACK));
      if (blocks.length) return mostCentral(blocks);

      // 3・4の作成と防御を評価し、同程度なら盤面中央と既存の石の近くを選ぶ。
      let best = -Infinity;
      let choices = [];
      for (const index of empty) {
        const attack = patternScore(index, WHITE);
        const defense = patternScore(index, BLACK);
        const score = attack * 1.05 + defense + nearbyScore(index) * 5 + centerScore(index);
        if (score > best) {
          best = score;
          choices = [index];
        } else if (score === best) {
          choices.push(index);
        }
      }
      return choices.length ? api.pick(choices) : -1;
    }

    function finishIfNeeded(index, stone) {
      if (hasFive(index, stone)) {
        done = true;
        thinking = false;
        draw();
        if (stone === BLACK) api.win(null, 'あなた（黒）の勝ち');
        else api.lose(null, 'CPU（白）の勝ち');
        return true;
      }
      if (history.length === board.length) {
        done = true;
        thinking = false;
        draw();
        api.lose(null, '引き分け');
        return true;
      }
      return false;
    }

    function cpuMove() {
      cpuTimer = null;
      if (done || !thinking) return;
      const index = chooseCpuMove();
      if (index < 0) {
        done = true;
        thinking = false;
        draw();
        api.lose(null, '引き分け');
        return;
      }
      board[index] = WHITE;
      history.push(index);
      thinking = false;
      api.sound('move');
      draw();
      finishIfNeeded(index, WHITE);
    }

    function onBoardTap(event) {
      if (done || thinking) return;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * SIZE / rect.width;
      const y = (event.clientY - rect.top) * SIZE / rect.height;
      const col = Math.round((x - PAD) / GAP);
      const row = Math.round((y - PAD) / GAP);
      if (!inside(row, col)) return;

      const index = toIndex(row, col);
      if (board[index] !== EMPTY) {
        api.sound('bad');
        return;
      }

      board[index] = BLACK;
      history.push(index);
      api.sound('move');
      draw();
      if (finishIfNeeded(index, BLACK)) return;

      thinking = true;
      draw();
      cpuTimer = setTimeout(cpuMove, 180);
    }

    function undo() {
      if (done || thinking || history.length < 2) return;
      board[history.pop()] = EMPTY;
      board[history.pop()] = EMPTY;
      draw();
    }

    function reset() {
      clearTimeout(cpuTimer);
      cpuTimer = null;
      board.fill(EMPTY);
      history.length = 0;
      done = false;
      thinking = false;
      draw();
    }

    reset();

    // OSの配色が切り替わったときも、CSS変数を読み直して描画する。
    const colorScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const redrawForScheme = () => draw();
    if (colorScheme && colorScheme.addEventListener) colorScheme.addEventListener('change', redrawForScheme);

    return () => {
      clearTimeout(cpuTimer);
      if (colorScheme && colorScheme.removeEventListener) colorScheme.removeEventListener('change', redrawForScheme);
    };
  },
};
