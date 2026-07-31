// 神経衰弱 — 同じ絵柄のカードを2枚ずつそろえる。

const SYMBOLS = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐷', '🐧'];

export default {
  mount(root, api) {
    let cards, first, second, flips, locked, done, hideTimer;

    const board = api.el('div', {
      role: 'grid',
      'aria-label': '神経衰弱のカード',
      style: 'width:min(88vw,360px);display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:clamp(4px,1.5vw,7px);user-select:none',
    });
    api.add(board);
    api.note('カードを2枚ずつめくって、同じ絵柄を12組そろえます');
    api.buttons([{ label: '別の並び', onClick: reset, primary: true }]);

    const cells = [];
    for (let i = 0; i < SYMBOLS.length * 2; i++) {
      const cell = api.el('button', {
        type: 'button',
        role: 'gridcell',
        style: 'min-width:0;aspect-ratio:1;padding:0;border:2px solid var(--line);border-radius:9px;background:var(--accent);color:var(--panel);font:inherit;font-size:clamp(20px,7vw,30px);font-weight:800;cursor:pointer;touch-action:manipulation;transition:transform .12s,background .12s,border-color .12s',
        onclick: () => flip(i),
      });
      cells.push(cell);
      board.append(cell);
    }

    function draw() {
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const visible = card.revealed || card.matched;
        const cell = cells[i];
        cell.textContent = visible ? card.symbol : '?';
        cell.style.background = visible ? 'var(--panel)' : 'var(--accent)';
        cell.style.color = visible ? 'var(--ink)' : 'var(--panel)';
        cell.style.borderColor = card.matched ? 'var(--good)' : visible ? 'var(--accent)' : 'var(--line)';
        cell.style.transform = visible ? 'scale(1)' : 'scale(.96)';
        cell.setAttribute('aria-label', card.matched
          ? `${card.symbol}、そろったカード`
          : visible ? `${card.symbol}のカード` : `${i + 1}番、裏向きのカード`);
        cell.setAttribute('aria-pressed', visible ? 'true' : 'false');
        cell.setAttribute('aria-disabled', card.matched ? 'true' : 'false');
      }
      api.hud({ 'めくった回数': flips, '最少': api.best() ?? '—' });
    }

    function flip(i) {
      if (done || locked) return;
      const card = cards[i];
      if (card.revealed || card.matched) return;

      card.revealed = true;
      flips++;
      api.sound('move');

      if (first === null) {
        first = i;
        draw();
        return;
      }

      second = i;
      draw();
      if (cards[first].symbol === cards[second].symbol) {
        cards[first].matched = true;
        cards[second].matched = true;
        first = null;
        second = null;
        api.sound('good');
        draw();

        if (cards.every((item) => item.matched)) {
          done = true;
          api.win(flips, `${flips}回で全ペアをそろえました`);
        }
        return;
      }

      locked = true;
      api.sound('bad');
      hideTimer = setTimeout(() => {
        cards[first].revealed = false;
        cards[second].revealed = false;
        first = null;
        second = null;
        locked = false;
        hideTimer = null;
        draw();
      }, 700);
    }

    function reset() {
      clearTimeout(hideTimer);
      hideTimer = null;
      cards = api.shuffle([...SYMBOLS, ...SYMBOLS]).map((symbol) => ({
        symbol,
        revealed: false,
        matched: false,
      }));
      first = null;
      second = null;
      flips = 0;
      locked = false;
      done = false;
      draw();
    }

    reset();

    // 後始末: 不一致カードを戻す待機タイマーを止める
    return () => clearTimeout(hideTimer);
  },
};
