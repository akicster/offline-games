// リバーシ — あなたが黒の先手。相手の石を挟んでひっくり返します。

const N = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],             [0, 1],
  [1, -1],  [1, 0],   [1, 1],
];

export default {
  mount(root, api) {
    const SIZE = 640;
    const CELL = SIZE / N;
    const STONE_R = CELL * 0.37;

    const canvas = api.el('canvas', {
      class: 'board',
      width: SIZE,
      height: SIZE,
      role: 'grid',
      'aria-label': '8かける8のリバーシ盤。あなたは黒です',
      style: 'width:min(92vw,400px);height:auto;background:var(--good);'
        + 'border:1px solid var(--line);border-radius:12px;cursor:pointer;touch-action:manipulation',
    });
    api.add(canvas);

    const note = api.note('あなたは黒（先手）です。青い印のマスに置けます');
    api.buttons([
      { label: 'はじめから', onClick: reset, primary: true },
    ]);

    const ctx = canvas.getContext('2d');
    const board = new Uint8Array(N * N);
    let turn = BLACK;
    let lastMove = -1;
    let done = false;
    let thinking = false;
    let cpuTimer = null;
    let disposed = false;

    function cssColor(name) {
      return getComputedStyle(root).getPropertyValue(name).trim();
    }

    function inside(row, col) {
      return row >= 0 && row < N && col >= 0 && col < N;
    }

    function toIndex(row, col) {
      return row * N + col;
    }

    function opponent(stone) {
      return stone === BLACK ? WHITE : BLACK;
    }

    /** 指定位置へ置いたときに返る石を列挙する。 */
    function flipsFor(position, stone, cells = board) {
      if (position < 0 || position >= cells.length || cells[position] !== EMPTY) return [];

      const row = (position / N) | 0;
      const col = position % N;
      const other = opponent(stone);
      const flips = [];

      for (const [dr, dc] of DIRECTIONS) {
        const line = [];
        let r = row + dr;
        let c = col + dc;
        while (inside(r, c) && cells[toIndex(r, c)] === other) {
          line.push(toIndex(r, c));
          r += dr;
          c += dc;
        }
        if (line.length && inside(r, c) && cells[toIndex(r, c)] === stone) {
          flips.push(...line);
        }
      }
      return flips;
    }

    function legalMoves(stone, cells = board) {
      const moves = [];
      for (let position = 0; position < cells.length; position++) {
        const flips = flipsFor(position, stone, cells);
        if (flips.length) moves.push({ position, flips });
      }
      return moves;
    }

    function place(move, stone, cells = board) {
      cells[move.position] = stone;
      for (const position of move.flips) cells[position] = stone;
    }

    function counts() {
      let black = 0;
      let white = 0;
      for (const stone of board) {
        if (stone === BLACK) black++;
        else if (stone === WHITE) white++;
      }
      return { black, white };
    }

    function drawStone(position, stone, darkMode) {
      const row = (position / N) | 0;
      const col = position % N;
      const x = col * CELL + CELL / 2;
      const y = row * CELL + CELL / 2;
      // CSS変数のうち、現在の配色で暗い方を黒、明るい方を白として使う。
      const blackColor = darkMode ? cssColor('--panel') : cssColor('--ink');
      const whiteColor = darkMode ? cssColor('--ink') : cssColor('--panel');

      ctx.beginPath();
      ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
      ctx.fillStyle = stone === BLACK ? blackColor : whiteColor;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = stone === BLACK ? cssColor('--ink') : cssColor('--sub');
      ctx.stroke();

      if (position === lastMove) {
        ctx.beginPath();
        ctx.arc(x, y, STONE_R * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = cssColor('--accent');
        ctx.fill();
      }
    }

    function draw() {
      const darkMode = !!(colorScheme && colorScheme.matches);
      const boardColor = cssColor('--good');
      const gridColor = darkMode ? cssColor('--ink') : cssColor('--panel');

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = boardColor;
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 2;
      for (let i = 0; i <= N; i++) {
        const p = i * CELL;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(SIZE, p);
        ctx.stroke();
      }
      ctx.restore();

      for (let position = 0; position < board.length; position++) {
        if (board[position] !== EMPTY) drawStone(position, board[position], darkMode);
      }

      // 操作できるときだけ、黒の合法手を青い点で示す。
      if (!done && !thinking && turn === BLACK) {
        ctx.fillStyle = cssColor('--accent');
        for (const move of legalMoves(BLACK)) {
          const row = (move.position / N) | 0;
          const col = move.position % N;
          ctx.beginPath();
          ctx.arc(col * CELL + CELL / 2, row * CELL + CELL / 2, CELL * 0.11, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function render() {
      if (disposed) return;
      const { black, white } = counts();
      const turnText = done ? '終局' : thinking ? 'CPU思考中' : turn === BLACK ? 'あなた' : 'CPU';
      api.hud({ '黒': black, '白': white, '手番': turnText });
      canvas.setAttribute('aria-label', `8かける8のリバーシ盤。黒${black}個、白${white}個。${turnText}の番`);
      draw();
    }

    function finishGame() {
      if (done || disposed) return;
      done = true;
      thinking = false;
      clearTimeout(cpuTimer);
      cpuTimer = null;

      const { black, white } = counts();
      render();
      if (black > white) {
        note.textContent = `終局：黒 ${black} - 白 ${white}。あなたの勝ちです`;
        api.win(null, `黒 ${black} - 白 ${white}`);
      } else if (white > black) {
        note.textContent = `終局：黒 ${black} - 白 ${white}。CPUの勝ちです`;
        api.lose(null, `黒 ${black} - 白 ${white}`);
      } else {
        note.textContent = `終局：黒 ${black} - 白 ${white}。引き分けです`;
        api.lose(null, `黒 ${black} - 白 ${white}　引き分け`);
      }
    }

    function scheduleCpu() {
      clearTimeout(cpuTimer);
      cpuTimer = setTimeout(cpuMove, 240);
    }

    /** 着手後に次の手番、パス、終局をまとめて判定する。 */
    function continueAfter(stone) {
      const next = opponent(stone);
      if (legalMoves(next).length) {
        turn = next;
        if (next === WHITE) {
          thinking = true;
          note.textContent = 'CPUが考えています…';
          render();
          scheduleCpu();
        } else {
          thinking = false;
          note.textContent = 'あなたの番です。青い印のマスに置けます';
          render();
        }
        return;
      }

      if (!legalMoves(stone).length) {
        finishGame();
        return;
      }

      turn = stone;
      if (stone === BLACK) {
        thinking = false;
        note.textContent = 'CPUは置ける場所がないためパスしました';
        render();
      } else {
        thinking = true;
        note.textContent = 'あなたは置ける場所がないためパス。CPUが続けます';
        render();
        scheduleCpu();
      }
    }

    /** 角、辺、相手の合法手数の順を強く反映した軽量評価。 */
    function chooseCpuMove(moves) {
      let best = moves[0];
      let bestScore = -Infinity;

      for (const move of moves) {
        const row = (move.position / N) | 0;
        const col = move.position % N;
        const corner = (row === 0 || row === N - 1) && (col === 0 || col === N - 1);
        const edge = row === 0 || row === N - 1 || col === 0 || col === N - 1;
        const copy = board.slice();
        place(move, WHITE, copy);
        const opponentMobility = legalMoves(BLACK, copy).length;
        const score = (corner ? 1000000 : edge ? 10000 : 0)
          - opponentMobility * 100 + move.flips.length;

        if (score > bestScore) {
          bestScore = score;
          best = move;
        }
      }
      return best;
    }

    function cpuMove() {
      cpuTimer = null;
      if (disposed || done || !thinking || turn !== WHITE) return;

      const moves = legalMoves(WHITE);
      if (!moves.length) {
        thinking = false;
        if (!legalMoves(BLACK).length) finishGame();
        else {
          turn = BLACK;
          note.textContent = 'CPUは置ける場所がないためパスしました';
          render();
        }
        return;
      }

      const move = chooseCpuMove(moves);
      place(move, WHITE);
      lastMove = move.position;
      thinking = false;
      api.sound('move');
      continueAfter(WHITE);
    }

    function onBoardTap(event) {
      if (disposed || done || thinking || turn !== BLACK) return;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * SIZE / rect.width;
      const y = (event.clientY - rect.top) * SIZE / rect.height;
      const col = Math.floor(x / CELL);
      const row = Math.floor(y / CELL);
      if (!inside(row, col)) return;

      const position = toIndex(row, col);
      const flips = flipsFor(position, BLACK);
      if (!flips.length) {
        api.sound('bad');
        note.textContent = 'そこには置けません。青い印のマスを選んでください';
        return;
      }

      place({ position, flips }, BLACK);
      lastMove = position;
      api.sound('move');
      continueAfter(BLACK);
    }

    function reset() {
      clearTimeout(cpuTimer);
      cpuTimer = null;
      board.fill(EMPTY);
      board[toIndex(3, 3)] = WHITE;
      board[toIndex(3, 4)] = BLACK;
      board[toIndex(4, 3)] = BLACK;
      board[toIndex(4, 4)] = WHITE;
      turn = BLACK;
      lastMove = -1;
      done = false;
      thinking = false;
      note.textContent = 'あなたは黒（先手）です。青い印のマスに置けます';
      render();
    }

    canvas.addEventListener('click', onBoardTap);

    // OSの配色が切り替わったときも、CSS変数を読み直して描画する。
    const colorScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const redrawForScheme = () => render();
    if (colorScheme && colorScheme.addEventListener) colorScheme.addEventListener('change', redrawForScheme);
    else if (colorScheme && colorScheme.addListener) colorScheme.addListener(redrawForScheme);

    reset();

    return () => {
      disposed = true;
      clearTimeout(cpuTimer);
      canvas.removeEventListener('click', onBoardTap);
      if (colorScheme && colorScheme.removeEventListener) colorScheme.removeEventListener('change', redrawForScheme);
      else if (colorScheme && colorScheme.removeListener) colorScheme.removeListener(redrawForScheme);
    };
  },
};
