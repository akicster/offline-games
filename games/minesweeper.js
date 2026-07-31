// マインスイーパ — 地雷を避けて安全なマスをすべて開く。

const N = 9;
const MINE_COUNT = 10;
const LONG_PRESS_MS = 500;

export default {
  mount(root, api) {
    let board, minesPlaced, openedSafe, done, lost;
    let flagMode = false, startedAt = null, elapsedMs = 0, tickTimer = null;
    let pressTimer = null, pressedIndex = -1, pressX = 0, pressY = 0, suppressClickIndex = -1;

    const wrap = api.el('div', {
      role: 'group',
      'aria-label': 'マインスイーパの盤面',
      style: `width:min(88vw,360px);aspect-ratio:1;display:grid;grid-template-columns:repeat(${N},minmax(0,1fr));gap:3px;padding:4px;background:var(--line);border:1px solid var(--line);border-radius:12px;touch-action:manipulation;user-select:none`,
    });
    api.add(wrap);
    api.note('タップで開きます。長押し、または旗モードONで旗を立てられます');

    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const cell = api.el('button', {
        type: 'button',
        style: 'min-width:0;padding:0;border:0;border-radius:4px;display:grid;place-items:center;background:var(--panel);color:var(--ink);font:800 clamp(12px,4vw,17px)/1 system-ui;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-touch-callout:none',
        onpointerdown: (e) => beginPress(e, i),
        onpointermove: (e) => movePress(e, i),
        onpointerup: () => endPress(i),
        onpointercancel: cancelPress,
        onpointerleave: () => endPress(i),
        oncontextmenu: (e) => e.preventDefault(),
        onclick: (e) => clickCell(e, i),
      });
      cells.push(cell);
      wrap.append(cell);
    }

    function neighbors(index) {
      const result = [];
      const row = (index / N) | 0;
      const col = index % N;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && r < N && c >= 0 && c < N) result.push(r * N + c);
        }
      }
      return result;
    }

    // 初手のマスを候補から外してから地雷を置くため、初手では必ず生き残れる。
    function placeMines(firstIndex) {
      const candidates = [];
      for (let i = 0; i < board.length; i++) {
        if (i !== firstIndex) candidates.push(i);
      }
      for (const index of api.shuffle(candidates).slice(0, MINE_COUNT)) {
        board[index].mine = true;
      }
      for (let i = 0; i < board.length; i++) {
        board[i].near = neighbors(i).filter((index) => board[index].mine).length;
      }
      minesPlaced = true;
    }

    function currentElapsed() {
      return startedAt === null ? elapsedMs : Date.now() - startedAt;
    }

    function drawHud() {
      const flags = board.filter((cell) => cell.flagged).length;
      const best = api.best();
      api.hud({
        '時間': `${(currentElapsed() / 1000).toFixed(1)}秒`,
        '旗': `${flags}/${MINE_COUNT}`,
        '最短': best === null ? '—' : `${(best / 1000).toFixed(1)}秒`,
      });
    }

    function startTimer() {
      startedAt = Date.now();
      clearInterval(tickTimer);
      tickTimer = setInterval(drawHud, 100);
    }

    function stopTimer() {
      if (startedAt !== null) {
        elapsedMs = Date.now() - startedAt;
        startedAt = null;
      }
      clearInterval(tickTimer);
      tickTimer = null;
    }

    function draw() {
      const numberColors = [
        'var(--ink)', 'var(--accent)', 'var(--good)', 'var(--bad)',
        'var(--ink)', 'var(--bad)', 'var(--good)', 'var(--ink)', 'var(--sub)',
      ];

      for (let i = 0; i < board.length; i++) {
        const state = board[i];
        const cell = cells[i];
        cell.style.boxShadow = 'none';

        if (state.revealed && state.mine) {
          cell.textContent = '💣';
          cell.style.background = 'var(--bad)';
          cell.style.color = 'var(--panel)';
          cell.setAttribute('aria-label', '地雷');
        } else if (lost && state.mine) {
          cell.textContent = state.flagged ? '🚩' : '💣';
          cell.style.background = 'var(--bad)';
          cell.style.color = 'var(--panel)';
          cell.setAttribute('aria-label', state.flagged ? '旗を立てた地雷' : '地雷');
        } else if (state.revealed) {
          cell.textContent = state.near || '';
          cell.style.background = 'var(--line)';
          cell.style.color = numberColors[state.near];
          cell.setAttribute('aria-label', state.near ? `開いたマス、周囲の地雷${state.near}個` : '開いたマス、周囲に地雷なし');
        } else {
          cell.textContent = state.flagged ? '🚩' : '';
          cell.style.background = 'var(--panel)';
          cell.style.color = 'var(--ink)';
          cell.style.boxShadow = 'inset 0 -3px 0 var(--line)';
          cell.setAttribute('aria-label', state.flagged ? '旗を立てたマス' : '閉じたマス');
        }
        cell.setAttribute('aria-pressed', state.flagged ? 'true' : 'false');
      }
      drawHud();
    }

    // 0のマスから幅優先で広げ、境界にある数字のマスまで一緒に開く。
    function openArea(firstIndex) {
      const queue = [firstIndex];
      for (let head = 0; head < queue.length; head++) {
        const index = queue[head];
        const state = board[index];
        if (state.revealed || state.flagged || state.mine) continue;
        state.revealed = true;
        openedSafe++;
        if (state.near === 0) {
          for (const next of neighbors(index)) {
            if (!board[next].revealed && !board[next].mine) queue.push(next);
          }
        }
      }
    }

    function openCell(index) {
      if (done || board[index].flagged || board[index].revealed) return;

      if (!minesPlaced) {
        placeMines(index);
        startTimer();
      }

      if (board[index].mine) {
        board[index].revealed = true;
        done = true;
        lost = true;
        stopTimer();
        draw();
        api.lose(undefined, '地雷を開きました');
        return;
      }

      openArea(index);
      api.sound('move');
      draw();

      if (openedSafe === N * N - MINE_COUNT) {
        done = true;
        stopTimer();
        draw();
        api.win(elapsedMs, `${(elapsedMs / 1000).toFixed(1)}秒でクリア`);
      }
    }

    function toggleFlag(index) {
      if (done || board[index].revealed) return;
      const flags = board.filter((cell) => cell.flagged).length;
      if (!board[index].flagged && flags >= MINE_COUNT) {
        api.sound('bad');
        return;
      }
      board[index].flagged = !board[index].flagged;
      api.sound('tap');
      draw();
    }

    function activateCell(index) {
      if (flagMode) toggleFlag(index);
      else openCell(index);
    }

    function beginPress(e, index) {
      if (done || (e.pointerType === 'mouse' && e.button !== 0)) return;
      cancelPress();
      suppressClickIndex = -1;
      pressedIndex = index;
      pressX = e.clientX;
      pressY = e.clientY;
      pressTimer = setTimeout(() => {
        if (pressedIndex !== index || done) return;
        pressTimer = null;
        suppressClickIndex = index;
        toggleFlag(index);
      }, LONG_PRESS_MS);
    }

    function movePress(e, index) {
      if (pressedIndex !== index || pressTimer === null) return;
      if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 10) cancelPress();
    }

    function endPress(index) {
      if (pressedIndex !== index) return;
      clearTimeout(pressTimer);
      pressTimer = null;
      pressedIndex = -1;
    }

    function cancelPress() {
      clearTimeout(pressTimer);
      pressTimer = null;
      pressedIndex = -1;
    }

    function clickCell(e, index) {
      if (suppressClickIndex === index) {
        suppressClickIndex = -1;
        e.preventDefault();
        return;
      }
      activateCell(index);
    }

    function renderButtons() {
      api.buttons([
        {
          label: `🚩 旗モード: ${flagMode ? 'ON' : 'OFF'}`,
          primary: flagMode,
          onClick: () => {
            if (done) return;
            flagMode = !flagMode;
            renderButtons();
          },
        },
        { label: 'はじめから', onClick: reset },
      ]);
    }

    function reset() {
      stopTimer();
      cancelPress();
      board = Array.from({ length: N * N }, () => ({
        mine: false,
        near: 0,
        revealed: false,
        flagged: false,
      }));
      minesPlaced = false;
      openedSafe = 0;
      done = false;
      lost = false;
      flagMode = false;
      startedAt = null;
      elapsedMs = 0;
      suppressClickIndex = -1;
      renderButtons();
      draw();
    }

    reset();

    // 一覧へ戻る／再起動する際に、計時と長押し判定を必ず止める。
    return () => {
      clearInterval(tickTimer);
      clearTimeout(pressTimer);
    };
  },
};
