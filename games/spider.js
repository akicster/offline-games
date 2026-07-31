// スパイダーソリティア — 同じスートの K から A を8組完成させる。

import {
  injectCardStyles,
  makeDeck,
  shuffle,
  cardEl,
  pileEl,
  suitSym,
  RANK_LABEL,
} from '../lib/cards.js';

const SUITS_BY_LEVEL = {
  1: ['s'],
  2: ['s', 'h'],
  4: ['s', 'h', 'd', 'c'],
};

const HISTORY_LIMIT = 40;

export default {
  mount(root, api) {
    injectCardStyles();

    let suitCount = Number(api.load('suits', 1));
    if (!SUITS_BY_LEVEL[suitCount]) suitCount = 1;

    let columns = Array.from({ length: 10 }, () => []);
    let stock = [];
    let completed = [];
    let history = [];
    let selected = null; // { col, index, uid }
    let startAt = Date.now();
    let tick = null;
    let done = false;
    let lastTap = { uid: null, at: 0 };

    // 長い列でも先頭までスクロールできるよう、ゲーム中だけ上寄せにする。
    const oldJustify = root.style.justifyContent;
    root.style.justifyContent = 'flex-start';

    const localStyle = api.el('style', {}, `
      .spider-settings{width:min(100%,560px);display:flex;align-items:center;justify-content:center;gap:8px;flex:none}
      .spider-settings label{font-size:12px;color:var(--sub);font-weight:700}
      .spider-settings select{padding:7px 10px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px}
      .spider-table{width:min(100%,560px);min-height:150px;flex:none;touch-action:manipulation}
      .spider-table .cd,.spider-table .pile{touch-action:manipulation}
      .spider-stock-count{position:absolute;z-index:500;min-width:17px;height:17px;padding:0 4px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);display:grid;place-items:center;font-size:10px;font-weight:800;pointer-events:none}
      .spider-status{width:min(100%,560px);min-height:18px;color:var(--sub);font-size:11.5px;line-height:1.45;text-align:center;flex:none}
      .spider-status.bad{color:var(--bad)}
      .spider-status.good{color:var(--good)}
      @media (max-width:390px){
        .spider-settings{gap:6px}
        .spider-settings select{padding:6px 8px;font-size:12px}
      }
    `);
    api.add(localStyle);

    const suitSelect = api.el('select', {
      'aria-label': 'スート数',
      'data-action': 'select-suits',
      onchange: (e) => newGame(Number(e.target.value)),
    });
    for (const [value, label] of [[1, '1スート（易）'], [2, '2スート（中）'], [4, '4スート（難）']]) {
      suitSelect.append(api.el('option', { value }, label));
    }
    suitSelect.value = String(suitCount);

    const settings = api.el('div', { class: 'spider-settings' },
      api.el('label', {}, '難易度'), suitSelect,
    );
    api.add(settings);

    const table = api.el('div', {
      class: 'table spider-table',
      role: 'group',
      'aria-label': 'スパイダーの盤面',
      'data-game': 'spider',
      'data-zone': 'board',
    });
    api.add(table);

    const statusEl = api.el('div', {
      class: 'spider-status',
      role: 'status',
      'aria-live': 'polite',
      'data-role': 'status',
    }, 'カードをタップして移動します');
    api.add(statusEl);

    const buttonBar = api.buttons([
      { label: '戻す', onClick: undo },
      { label: '新しいゲーム', onClick: () => newGame(suitCount), primary: true },
    ]);
    const actionButtons = buttonBar.querySelectorAll('button');
    if (actionButtons[0]) {
      actionButtons[0].dataset.action = 'undo';
      actionButtons[0].setAttribute('aria-label', '1手戻す');
    }
    if (actionButtons[1]) {
      actionButtons[1].dataset.action = 'new-game';
      actionButtons[1].setAttribute('aria-label', '新しいゲーム');
    }
    api.note('タップで選択→タップで移動。同じスートの K〜A は自動で完成枠へ移ります');

    function elapsed() {
      return Math.max(0, Date.now() - startAt);
    }

    function formatTime(ms) {
      const total = Math.floor(ms / 1000);
      const min = Math.floor(total / 60);
      const sec = total % 60;
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }

    function updateHud() {
      api.hud({
        'スート': `${suitCount}種`,
        '完成': `${completed.length}/8`,
        '山': `${stock.length / 10}回`,
        '時間': formatTime(elapsed()),
      });
    }

    function setStatus(text, kind = '') {
      statusEl.textContent = text;
      statusEl.className = `spider-status${kind ? ` ${kind}` : ''}`;
    }

    function cloneCard(card) {
      return { uid: card.uid, suit: card.suit, rank: card.rank, up: card.up };
    }

    function boardSnapshot() {
      return {
        columns: columns.map((col) => col.map(cloneCard)),
        stock: stock.map(cloneCard),
        completed: completed.slice(),
      };
    }

    function restoreSnapshot(snapshot) {
      columns = snapshot.columns.map((col) => col.map(cloneCard));
      stock = snapshot.stock.map(cloneCard);
      completed = snapshot.completed.slice();
      selected = null;
      lastTap = { uid: null, at: 0 };
    }

    function pushHistory() {
      history.push(boardSnapshot());
      if (history.length > HISTORY_LIMIT) history.shift();
    }

    function save() {
      if (done) return;
      api.save('suits', suitCount);
      api.save('saved', {
        version: 1,
        suitCount,
        columns: columns.map((col) => col.map(cloneCard)),
        stock: stock.map(cloneCard),
        completed: completed.slice(),
        history: history.map((item) => ({
          columns: item.columns.map((col) => col.map(cloneCard)),
          stock: item.stock.map(cloneCard),
          completed: item.completed.slice(),
        })),
        elapsed: elapsed(),
      });
    }

    function validSnapshot(snapshot, level) {
      if (!snapshot || !Array.isArray(snapshot.columns) || snapshot.columns.length !== 10) return false;
      if (!Array.isArray(snapshot.stock) || snapshot.stock.length > 50 || snapshot.stock.length % 10 !== 0) return false;
      if (!Array.isArray(snapshot.completed) || snapshot.completed.length > 8) return false;

      const allowed = new Set(SUITS_BY_LEVEL[level]);
      if (snapshot.completed.some((suit) => !allowed.has(suit))) return false;
      const seen = new Set();
      let liveCards = 0;

      const validCard = (card) => {
        if (!card || !Number.isInteger(card.uid) || card.uid < 0 || card.uid >= 104) return false;
        if (seen.has(card.uid) || !allowed.has(card.suit)) return false;
        if (!Number.isInteger(card.rank) || card.rank < 1 || card.rank > 13 || typeof card.up !== 'boolean') return false;
        seen.add(card.uid);
        liveCards++;
        return true;
      };

      for (const col of snapshot.columns) {
        if (!Array.isArray(col) || !col.every(validCard)) return false;
        if (col.length && !col[col.length - 1].up) return false;
      }
      if (!snapshot.stock.every((card) => validCard(card) && !card.up)) return false;
      return liveCards + snapshot.completed.length * 13 === 104;
    }

    function loadSaved() {
      const saved = api.load('saved', null);
      const level = Number(saved && saved.suitCount);
      if (!saved || saved.version !== 1 || !SUITS_BY_LEVEL[level] || !validSnapshot(saved, level)) return false;

      suitCount = level;
      columns = saved.columns.map((col) => col.map(cloneCard));
      stock = saved.stock.map(cloneCard);
      completed = saved.completed.slice();
      history = Array.isArray(saved.history)
        ? saved.history.filter((item) => validSnapshot(item, level)).slice(-HISTORY_LIMIT).map((item) => ({
          columns: item.columns.map((col) => col.map(cloneCard)),
          stock: item.stock.map(cloneCard),
          completed: item.completed.slice(),
        }))
        : [];
      startAt = Date.now() - (Number.isFinite(saved.elapsed) && saved.elapsed >= 0 ? saved.elapsed : 0);
      selected = null;
      done = false;
      return true;
    }

    function isMovableRun(colIndex, index) {
      const col = columns[colIndex];
      if (!col || index < 0 || index >= col.length || !col[index].up) return false;
      for (let i = index; i < col.length - 1; i++) {
        if (!col[i + 1].up || col[i].suit !== col[i + 1].suit || col[i].rank !== col[i + 1].rank + 1) return false;
      }
      return true;
    }

    function isCompleteRun(cards) {
      if (cards.length !== 13 || cards[0].rank !== 13) return false;
      const suit = cards[0].suit;
      return cards.every((card, i) => card.up && card.suit === suit && card.rank === 13 - i);
    }

    function flipExposed(col) {
      if (col.length && !col[col.length - 1].up) col[col.length - 1].up = true;
    }

    function removeCompletedRuns() {
      let removed = 0;
      let found = true;
      while (found) {
        found = false;
        for (const col of columns) {
          if (col.length < 13) continue;
          const run = col.slice(-13);
          if (!isCompleteRun(run)) continue;
          completed.push(run[0].suit);
          col.splice(-13);
          flipExposed(col);
          removed++;
          found = true;
        }
      }
      return removed;
    }

    function finishIfWon() {
      if (completed.length !== 8) return false;
      done = true;
      clearInterval(tick);
      tick = null;
      selected = null;
      render();
      api.save('saved', null);
      api.win(elapsed(), `${suitCount}スートで完成`);
      return true;
    }

    function settle(actionName) {
      const removed = removeCompletedRuns();
      if (finishIfWon()) return;
      if (removed) {
        api.sound('good');
        setStatus(`${removed}組完成しました`, 'good');
      } else {
        api.sound('move');
        setStatus(actionName);
      }
      render();
      save();
    }

    function clearSelection(message, bad = false) {
      selected = null;
      lastTap = { uid: null, at: 0 };
      api.sound(bad ? 'bad' : 'tap');
      setStatus(message, bad ? 'bad' : '');
      render();
    }

    function selectCard(colIndex, index) {
      if (!isMovableRun(colIndex, index)) {
        clearSelection('同じスートで連続した表向きの並びだけ動かせます', true);
        return;
      }
      const card = columns[colIndex][index];
      selected = { col: colIndex, index, uid: card.uid };
      api.sound('tap');
      setStatus(`${RANK_LABEL[card.rank]}${suitSym(card)} から ${columns[colIndex].length - index}枚を選択`);
      render();
    }

    function tryMove(destCol, destIndex) {
      if (!selected) return;
      const from = columns[selected.col];
      const dest = columns[destCol];
      const moving = from[selected.index];
      const tappedBottom = dest.length === 0 ? destIndex === -1 : destIndex === dest.length - 1;
      const canPlace = dest.length === 0 || dest[dest.length - 1].rank === moving.rank + 1;

      if (selected.col === destCol || !tappedBottom || !isMovableRun(selected.col, selected.index) || !canPlace) {
        clearSelection('そこには置けません', true);
        return;
      }

      pushHistory();
      const movingCards = from.splice(selected.index);
      dest.push(...movingCards);
      flipExposed(from);
      selected = null;
      lastTap = { uid: null, at: 0 };
      settle(`${movingCards.length}枚移動しました`);
    }

    function tryManualComplete() {
      if (!selected) return false;
      const col = columns[selected.col];
      const run = col.slice(selected.index);
      if (!isCompleteRun(run)) return false;

      pushHistory();
      completed.push(run[0].suit);
      col.splice(selected.index);
      flipExposed(col);
      selected = null;
      lastTap = { uid: null, at: 0 };
      if (!finishIfWon()) {
        api.sound('good');
        setStatus('1組完成しました', 'good');
        render();
        save();
      }
      return true;
    }

    function onCardTap(colIndex, index) {
      if (done) return;
      const card = columns[colIndex][index];
      if (!card) return;

      const now = Date.now();
      const doubleTap = lastTap.uid === card.uid && now - lastTap.at <= 320;
      lastTap = { uid: card.uid, at: now };

      if (doubleTap) {
        if (!tryManualComplete()) clearSelection('選択を解除しました');
        return;
      }

      if (!selected) {
        selectCard(colIndex, index);
        return;
      }
      if (selected.uid === card.uid) {
        clearSelection('選択を解除しました');
        return;
      }
      tryMove(colIndex, index);
    }

    function onColumnTap(colIndex) {
      if (done) return;
      const col = columns[colIndex];
      if (col.length) return;
      if (!selected) {
        clearSelection('先に動かすカードを選んでください', true);
        return;
      }
      tryMove(colIndex, -1);
    }

    function onCompleteSlotTap() {
      if (done) return;
      if (tryManualComplete()) return;
      if (selected) clearSelection('KからAまで同じスートで揃うと自動で完成します', true);
      else {
        api.sound('tap');
        setStatus('完成した組は自動でここへ移ります');
      }
    }

    function dealStock() {
      if (done) return;
      if (selected) {
        clearSelection('配る前に選択を解除してください', true);
        return;
      }
      if (!stock.length) {
        api.sound('bad');
        setStatus('山札は空です', 'bad');
        return;
      }
      if (columns.some((col) => col.length === 0)) {
        api.sound('bad');
        setStatus('空の列がある間は山札を配れません', 'bad');
        return;
      }

      pushHistory();
      for (let colIndex = 0; colIndex < 10; colIndex++) {
        const card = stock.pop();
        card.up = true;
        columns[colIndex].push(card);
      }
      settle('各列に1枚ずつ配りました');
    }

    function undo() {
      if (done || !history.length) {
        api.sound('bad');
        setStatus('戻せる手がありません', 'bad');
        return;
      }
      restoreSnapshot(history.pop());
      api.sound('move');
      setStatus('1手戻しました');
      render();
      save();
    }

    function newGame(level) {
      if (!SUITS_BY_LEVEL[level]) level = 1;
      suitCount = level;
      suitSelect.value = String(level);
      api.save('suits', level);

      const suits = SUITS_BY_LEVEL[level];
      const deck = shuffle(makeDeck({ decks: 8 / suits.length, suits }));
      columns = Array.from({ length: 10 }, () => []);

      // 最初の4列は6枚、残り6列は5枚になるよう54枚を配る。
      for (let i = 0; i < 54; i++) {
        const card = deck[i];
        card.up = false;
        columns[i % 10].push(card);
      }
      for (const col of columns) col[col.length - 1].up = true;
      stock = deck.slice(54).map((card) => ({ ...card, up: false }));
      completed = [];
      history = [];
      selected = null;
      lastTap = { uid: null, at: 0 };
      startAt = Date.now();
      done = false;
      setStatus(`${level}スートの新しいゲームを始めました`);
      render();
      save();
      startTick();
    }

    function decorateCard(node, card, zone, extra = {}) {
      node.dataset.zone = zone;
      node.dataset.rank = String(card.rank);
      node.dataset.suit = card.suit;
      node.dataset.up = String(card.up);
      node.dataset.uid = String(card.uid);
      for (const [key, value] of Object.entries(extra)) node.dataset[key] = String(value);
      return node;
    }

    function render() {
      table.textContent = '';
      const width = table.clientWidth || Math.min(Math.max(window.innerWidth - 24, 240), 560);
      const gap = width >= 450 ? 4 : 2;
      const cw = Math.max(20, (width - gap * 9) / 10);
      const ch = cw * 1.42;
      const tableauTop = ch + Math.max(8, cw * 0.2);
      const faceDownGap = Math.min(10, Math.max(6, cw * 0.2));
      const faceUpGap = Math.min(23, Math.max(15, cw * 0.48));
      let maxBottom = tableauTop + ch;

      table.style.setProperty('--cw', `${cw}px`);
      table.style.setProperty('--ch', `${ch}px`);
      table.dataset.count = String(columns.reduce((sum, col) => sum + col.length, 0) + stock.length);
      table.dataset.completedCount = String(completed.length);
      table.dataset.stockCount = String(stock.length);

      const xOf = (index) => index * (cw + gap);

      // 山札。見えているカードは1枚でも data-count で残数を公開する。
      const stockPile = pileEl(stock.length ? '' : '山');
      stockPile.style.left = `${xOf(0)}px`;
      stockPile.style.top = '0px';
      stockPile.style.zIndex = '1';
      stockPile.dataset.zone = 'stock';
      stockPile.dataset.count = String(stock.length);
      stockPile.setAttribute('role', 'button');
      stockPile.setAttribute('aria-label', stock.length ? `山札、残り${stock.length}枚` : '空の山札');
      stockPile.addEventListener('click', dealStock);
      table.append(stockPile);

      if (stock.length) {
        const stockCard = decorateCard(cardEl(stock[stock.length - 1]), stock[stock.length - 1], 'stock-card', {
          count: stock.length,
        });
        stockCard.style.left = `${xOf(0)}px`;
        stockCard.style.top = '0px';
        stockCard.style.zIndex = '2';
        stockCard.setAttribute('role', 'button');
        stockCard.setAttribute('aria-label', `山札を配る、残り${stock.length}枚`);
        stockCard.addEventListener('click', dealStock);
        table.append(stockCard);

        const badge = api.el('span', {
          class: 'spider-stock-count',
          style: `left:${xOf(0) + cw - 12}px;top:${ch - 12}px`,
          'aria-hidden': 'true',
        }, String(stock.length / 10));
        table.append(badge);
      }

      // 完成枠は右側8か所。Spiderでは揃った組を自動で移す。
      for (let i = 0; i < 8; i++) {
        const filled = i < completed.length;
        const slot = pileEl(filled ? '' : '✓');
        slot.style.left = `${xOf(i + 2)}px`;
        slot.style.top = '0px';
        slot.style.zIndex = '1';
        slot.dataset.zone = 'completed';
        slot.dataset.index = String(i);
        slot.dataset.count = filled ? '13' : '0';
        slot.setAttribute('role', 'button');
        slot.setAttribute('aria-label', filled ? `完成した組 ${i + 1}` : `完成枠 ${i + 1}`);
        slot.addEventListener('click', onCompleteSlotTap);
        table.append(slot);

        if (filled) {
          const completeCard = { uid: `complete-${i}`, suit: completed[i], rank: 13, up: true };
          const card = decorateCard(cardEl(completeCard), completeCard, 'completed-card', {
            index: i,
            count: 13,
          });
          card.style.left = `${xOf(i + 2)}px`;
          card.style.top = '0px';
          card.style.zIndex = '2';
          card.setAttribute('role', 'button');
          card.setAttribute('aria-label', `完成した${suitSym(completeCard)}の組`);
          card.addEventListener('click', onCompleteSlotTap);
          table.append(card);
        }
      }

      for (let colIndex = 0; colIndex < 10; colIndex++) {
        const col = columns[colIndex];
        const x = xOf(colIndex);
        const columnPile = pileEl('');
        columnPile.style.left = `${x}px`;
        columnPile.style.top = `${tableauTop}px`;
        columnPile.style.zIndex = '1';
        columnPile.dataset.zone = 'tableau-column';
        columnPile.dataset.col = String(colIndex);
        columnPile.dataset.count = String(col.length);
        columnPile.setAttribute('role', 'button');
        columnPile.setAttribute('aria-label', `${colIndex + 1}列目、${col.length}枚`);
        columnPile.addEventListener('click', () => onColumnTap(colIndex));
        table.append(columnPile);

        let y = tableauTop;
        for (let index = 0; index < col.length; index++) {
          const card = col[index];
          const node = decorateCard(cardEl(card), card, 'tableau-card', {
            col: colIndex,
            index,
            movable: isMovableRun(colIndex, index),
            selected: Boolean(selected && selected.col === colIndex && index >= selected.index),
          });
          node.style.left = `${x}px`;
          node.style.top = `${y}px`;
          node.style.zIndex = String(10 + index);
          if (selected && selected.col === colIndex && index >= selected.index) node.classList.add('sel');
          node.setAttribute('role', 'button');
          node.setAttribute('aria-label', card.up
            ? `${colIndex + 1}列目 ${RANK_LABEL[card.rank]}${suitSym(card)}${isMovableRun(colIndex, index) ? '、移動可能' : ''}`
            : `${colIndex + 1}列目 裏向きのカード`);
          node.addEventListener('click', (event) => {
            event.stopPropagation();
            onCardTap(colIndex, index);
          });
          table.append(node);

          if (index < col.length - 1) y += card.up ? faceUpGap : faceDownGap;
        }
        if (col.length) maxBottom = Math.max(maxBottom, y + ch);
      }

      table.style.height = `${Math.ceil(maxBottom + 4)}px`;
      updateHud();
    }

    function startTick() {
      clearInterval(tick);
      tick = setInterval(() => {
        if (!done) {
          updateHud();
          save();
        }
      }, 1000);
    }

    function onResize() {
      if (!done || completed.length === 8) return;
      render();
    }
    window.addEventListener('resize', onResize);

    if (loadSaved()) {
      suitSelect.value = String(suitCount);
      setStatus('前回の続きから再開しました');
      render();
      startTick();
    } else {
      newGame(suitCount);
    }

    return () => {
      clearInterval(tick);
      window.removeEventListener('resize', onResize);
      save();
      root.style.justifyContent = oldJustify;
    };
  },
};
