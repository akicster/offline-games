// 15パズル — 空きマスへ数字を滑らせ、1から15まで順番に並べる。

const N = 4;
const SHUFFLE_MOVES = 500;

export default {
  mount(root, api) {
    let tiles, empty, moves, done, suppressTapUntil;

    const board = api.el('div', {
      role: 'grid',
      'aria-label': '15パズルの盤面',
      style: `width:min(88vw,360px);max-width:100%;aspect-ratio:1;display:grid;
        grid-template-columns:repeat(${N},minmax(0,1fr));gap:clamp(5px,1.8vw,8px);
        padding:clamp(5px,1.8vw,8px);border:1px solid var(--line);border-radius:12px;
        background:var(--panel);touch-action:none;user-select:none`,
    });
    api.add(board);
    api.note('空きマスの隣をタップ。スワイプ／矢印キーでは空きマスを動かします');
    api.buttons([{ label: '別の問題', onClick: reset, primary: true }]);

    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const cell = api.el('button', {
        role: 'gridcell',
        style: `min-width:0;padding:0;border:1px solid var(--line);border-radius:9px;
          background:var(--panel);color:var(--accent);font:inherit;
          font-size:clamp(20px,7vw,32px);font-weight:800;cursor:pointer;
          touch-action:none;transition:background .1s,border-color .1s`,
        onclick: () => slideTile(i),
      });
      cells.push(cell);
      board.append(cell);
    }

    function isSolved() {
      for (let i = 0; i < N * N - 1; i++) {
        if (tiles[i] !== i + 1) return false;
      }
      return tiles[N * N - 1] === 0;
    }

    function draw() {
      for (let i = 0; i < N * N; i++) {
        const value = tiles[i];
        const cell = cells[i];
        cell.textContent = value || '';
        cell.setAttribute('aria-label', value ? `${value}のタイル` : '空きマス');
        cell.tabIndex = value ? 0 : -1;
        cell.style.background = value ? 'var(--panel)' : 'var(--line)';
        cell.style.color = value ? 'var(--accent)' : 'var(--sub)';
        cell.style.cursor = value ? 'pointer' : 'default';
      }
      api.hud({ '手数': moves, '最少': api.best() ?? '—' });
    }

    function swapWithEmpty(target) {
      [tiles[empty], tiles[target]] = [tiles[target], tiles[empty]];
      empty = target;
    }

    function adjacentTargets(index) {
      const row = (index / N) | 0;
      const col = index % N;
      const targets = [];
      if (row > 0) targets.push(index - N);
      if (row < N - 1) targets.push(index + N);
      if (col > 0) targets.push(index - 1);
      if (col < N - 1) targets.push(index + 1);
      return targets;
    }

    function slideTile(index, fromDirection = false) {
      // スワイプ直後に合成されるclickで、意図せずもう一手動くのを防ぐ。
      if (!fromDirection && Date.now() < suppressTapUntil) return;
      if (done || tiles[index] === 0 || !adjacentTargets(empty).includes(index)) return;
      swapWithEmpty(index);
      moves++;
      api.sound('move');
      draw();
      if (isSolved()) {
        done = true;
        api.win(moves, `${moves}手でクリア`);
      }
    }

    function moveEmpty(dir) {
      if (done) return;
      const row = (empty / N) | 0;
      const col = empty % N;
      let target = -1;
      if (dir === 'up' && row > 0) target = empty - N;
      else if (dir === 'down' && row < N - 1) target = empty + N;
      else if (dir === 'left' && col > 0) target = empty - 1;
      else if (dir === 'right' && col < N - 1) target = empty + 1;
      if (target !== -1) {
        slideTile(target, true);
        suppressTapUntil = Date.now() + 250;
      }
    }

    function makePuzzle() {
      tiles = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N));
      empty = N * N - 1;
      let previousEmpty = -1;

      // 完成状態から合法手だけを重ねるため、必ず解ける配置になる。
      for (let i = 0; i < SHUFFLE_MOVES; i++) {
        let candidates = adjacentTargets(empty);
        // 直前の一手をすぐ戻さず、盤面を十分に混ぜる。
        if (candidates.length > 1) candidates = candidates.filter((index) => index !== previousEmpty);
        const oldEmpty = empty;
        swapWithEmpty(candidates[api.rand(candidates.length)]);
        previousEmpty = oldEmpty;
      }

      // ごくまれに完成形へ戻った場合も、合法手を一手加えて出題する。
      if (isSolved()) {
        const candidates = adjacentTargets(empty);
        swapWithEmpty(candidates[api.rand(candidates.length)]);
      }
    }

    function reset() {
      moves = 0;
      done = false;
      suppressTapUntil = 0;
      makePuzzle();
      draw();
    }

    api.onDir(moveEmpty);
    reset();
  },
};
