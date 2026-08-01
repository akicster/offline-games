// フリーセル
//
// スマホで扱いやすいよう、札をタップして選び、置き先をタップして動かす。

import { makeDeck, shuffle, cardEl, pileEl, injectCardStyles, isRed, suitSym } from '../lib/cards.js';

const SUIT_ORDER = ['s', 'h', 'd', 'c'];

export default {
  mount(root, api) {
    injectCardStyles();

    // st = { cells[4], found[4], tab[8] }。札はすべて表向き。
    let st = null;
    let sel = null;          // { pile:'tab'|'cell', i:列番号, from:場札内の位置 }
    let hist = [];           // 盤面を丸ごと保存する戻す履歴
    let moves = 0;
    let startAt = 0;
    let done = false;
    let tick = null;
    let ticksSinceSave = 0;

    const style = api.el('style', {}, `
      .fc-table{position:relative;margin:0 auto;flex:none;touch-action:manipulation}
      .fc-table .pile,.fc-table .cd{box-sizing:border-box}
      .fc-table .pile.fc-valid{border-color:var(--good);background:color-mix(in srgb,var(--good) 14%,transparent)}
      .fc-table .pile.fc-cell .ph{font-size:calc(var(--cw) * .25);color:var(--sub)}
      .fc-table .pile.fc-home .ph{color:var(--sub)}
    `);
    const table = api.el('div', { class: 'table fc-table', 'aria-label': 'フリーセルの盤面' });
    api.add(style, table);

    let CW = 39;
    let CH = 55;
    let GAP = 3;
    let FAN = 18;

    const top = (cards) => cards[cards.length - 1] || null;
    const colX = (i) => i * (CW + GAP);

    // ---- 寸法 -------------------------------------------------------
    function measure() {
      const viewport = Math.floor(window.innerWidth * 0.92);
      const available = Math.min(root.clientWidth || viewport, viewport);
      const width = Math.min(400, Math.max(240, available));
      GAP = Math.max(3, Math.floor(width * 0.009));
      CW = Math.floor((width - GAP * 7) / 8);
      CH = Math.round(CW * 1.42);
      FAN = Math.max(15, Math.round(CH * 0.32));
      table.style.setProperty('--cw', `${CW}px`);
      table.style.setProperty('--ch', `${CH}px`);
      table.style.width = `${CW * 8 + GAP * 7}px`;

      const maxLen = Math.max(1, ...st.tab.map((col) => col.length));
      const tabY = CH + GAP * 3;
      table.style.height = `${tabY + CH + Math.max(0, maxLen - 1) * FAN + 6}px`;
    }

    // ---- ルール判定 -------------------------------------------------
    function canToFound(card, foundIndex) {
      const pile = st.found[foundIndex];
      if (SUIT_ORDER[foundIndex] !== card.suit) return false;
      const cardOnTop = top(pile);
      return cardOnTop ? card.rank === cardOnTop.rank + 1 : card.rank === 1;
    }

    function canToTableau(card, columnIndex) {
      const cardOnTop = top(st.tab[columnIndex]);
      if (!cardOnTop) return true;
      return isRed(cardOnTop) !== isRed(card) && card.rank === cardOnTop.rank - 1;
    }

    /** 指定位置から上が、色違いの降順で連なっているか調べる。 */
    function isValidRun(column, from) {
      if (from < 0 || from >= column.length) return false;
      for (let i = from; i < column.length - 1; i++) {
        const lower = column[i];
        const upper = column[i + 1];
        if (isRed(lower) === isRed(upper) || upper.rank !== lower.rank - 1) return false;
      }
      return true;
    }

    /**
     * 複数枚を一度に動かせる上限。
     * 空きの置き先列は中継に使えず、移動で空になる元列も今回の中継には使えない。
     */
    function moveCapacity(sourceIndex, destinationIndex) {
      const emptyCells = st.cells.filter((card) => !card).length;
      const emptyColumns = st.tab.reduce((count, column, index) => (
        count + (!column.length && index !== sourceIndex && index !== destinationIndex ? 1 : 0)
      ), 0);
      return (emptyCells + 1) * (2 ** emptyColumns);
    }

    function selectedCards() {
      if (!sel) return [];
      if (sel.pile === 'cell') return st.cells[sel.i] ? [st.cells[sel.i]] : [];
      return st.tab[sel.i].slice(sel.from);
    }

    function canDrop(dest) {
      if (!sel) return false;
      const cards = selectedCards();
      if (!cards.length) return false;

      if (dest.pile === 'cell') return cards.length === 1 && !st.cells[dest.i];
      if (dest.pile === 'found') return cards.length === 1 && canToFound(cards[0], dest.i);
      if (dest.pile !== 'tab') return false;
      if (sel.pile === 'tab' && sel.i === dest.i) return false;
      if (!canToTableau(cards[0], dest.i)) return false;
      if (sel.pile !== 'tab') return cards.length === 1;
      return cards.length <= moveCapacity(sel.i, dest.i);
    }

    // ---- 盤面操作 ---------------------------------------------------
    function pushHist() {
      hist.push(JSON.stringify({ st, moves }));
      if (hist.length > 80) hist.shift();
    }

    function takeSelected() {
      if (sel.pile === 'cell') {
        const card = st.cells[sel.i];
        st.cells[sel.i] = null;
        return card ? [card] : [];
      }
      return st.tab[sel.i].splice(sel.from);
    }

    function checkWin() {
      if (!st.found.every((pile) => pile.length === 13)) return false;
      done = true;
      clearInterval(tick);
      api.save('saved', null);
      api.win(Date.now() - startAt, `${moves}手`);
      return true;
    }

    function tryMove(dest) {
      if (done || !canDrop(dest)) return false;
      pushHist();
      const cards = takeSelected();
      if (dest.pile === 'cell') st.cells[dest.i] = cards[0];
      else if (dest.pile === 'found') st.found[dest.i].push(cards[0]);
      else st.tab[dest.i].push(...cards);
      moves++;
      sel = null;
      api.sound('good');
      render();
      save();
      checkWin();
      return true;
    }

    /** 場札または空きセルの一番上を、対応する組札へ送る。 */
    function autoToFound(source) {
      if (done) return false;
      let card = null;
      if (source.pile === 'cell') card = st.cells[source.i];
      else {
        const column = st.tab[source.i];
        if (source.from !== column.length - 1) return false;
        card = top(column);
      }
      if (!card) return false;

      const foundIndex = SUIT_ORDER.indexOf(card.suit);
      if (foundIndex < 0 || !canToFound(card, foundIndex)) return false;
      pushHist();
      if (source.pile === 'cell') st.cells[source.i] = null;
      else st.tab[source.i].pop();
      st.found[foundIndex].push(card);
      moves++;
      sel = null;
      api.sound('good');
      render();
      save();
      checkWin();
      return true;
    }

    function undo() {
      if (done || !hist.length) return;
      const previous = JSON.parse(hist.pop());
      st = previous.st;
      moves = previous.moves;
      sel = null;
      api.sound('move');
      render();
      save();
    }

    // ---- 描画 -------------------------------------------------------
    function place(element, x, y, zIndex) {
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.zIndex = String(zIndex);
      table.append(element);
    }

    function elapsedText() {
      const totalSeconds = Math.floor(Math.max(0, Date.now() - startAt) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
    }

    function updateHud() {
      api.hud({
        '時間': elapsedText(),
        '手数': moves,
        '完成': `${st.found.reduce((sum, pile) => sum + pile.length, 0)}/52`,
      });
    }

    function markTarget(slot, dest) {
      if (canDrop(dest)) slot.classList.add('fc-valid');
    }

    function render() {
      measure();
      table.textContent = '';
      const rowY = 0;
      const tabY = CH + GAP * 3;

      // 左上の空きセル
      for (let i = 0; i < 4; i++) {
        const x = colX(i);
        const slot = pileEl('空');
        slot.classList.add('fc-cell');
        slot.setAttribute('aria-label', `空きセル${i + 1}`);
        slot.addEventListener('click', () => onPileTap({ pile: 'cell', i }));
        markTarget(slot, { pile: 'cell', i });
        place(slot, x, rowY, 0);

        const card = st.cells[i];
        if (card) {
          const element = cardEl(card);
          if (sel && sel.pile === 'cell' && sel.i === i) element.classList.add('sel');
          element.addEventListener('click', () => onCardTap({ pile: 'cell', i, from: 0 }));
          place(element, x, rowY, 20);
        }
      }

      // 右上の組札
      for (let i = 0; i < 4; i++) {
        const x = colX(i + 4);
        const slot = pileEl(suitSym({ suit: SUIT_ORDER[i] }));
        slot.classList.add('fc-home');
        slot.setAttribute('aria-label', `${suitSym({ suit: SUIT_ORDER[i] })}の組札`);
        slot.addEventListener('click', () => onPileTap({ pile: 'found', i }));
        markTarget(slot, { pile: 'found', i });
        place(slot, x, rowY, 0);

        const card = top(st.found[i]);
        if (card) {
          const element = cardEl(card);
          element.addEventListener('click', () => onPileTap({ pile: 'found', i }));
          place(element, x, rowY, 20);
        }
      }

      // 8列の場札
      for (let columnIndex = 0; columnIndex < 8; columnIndex++) {
        const x = colX(columnIndex);
        const slot = pileEl('');
        slot.setAttribute('aria-label', `場札${columnIndex + 1}`);
        slot.addEventListener('click', () => onPileTap({ pile: 'tab', i: columnIndex }));
        markTarget(slot, { pile: 'tab', i: columnIndex });
        place(slot, x, tabY, 0);

        st.tab[columnIndex].forEach((card, cardIndex) => {
          const element = cardEl(card);
          if (sel && sel.pile === 'tab' && sel.i === columnIndex && cardIndex >= sel.from) {
            element.classList.add('sel');
          }
          element.addEventListener('click', () => onCardTap({ pile: 'tab', i: columnIndex, from: cardIndex }));
          place(element, x, tabY + cardIndex * FAN, 10 + cardIndex);
        });
      }

      updateHud();
    }

    // ---- タップ操作 -------------------------------------------------
    function onCardTap(source) {
      if (done) return;

      // 同じ札をもう一度タップすると、可能なら組札へ上げる。
      if (sel && sel.pile === source.pile && sel.i === source.i && sel.from === source.from) {
        if (!autoToFound(source)) {
          sel = null;
          api.sound('tap');
          render();
        }
        return;
      }

      // 選択済みなら、先に今タップした列を置き先として試す。
      if (sel && source.pile === 'tab' && tryMove({ pile: 'tab', i: source.i })) return;

      if (source.pile === 'tab' && !isValidRun(st.tab[source.i], source.from)) {
        sel = null;
        api.sound('bad');
        render();
        return;
      }
      sel = source;
      api.sound('tap');
      render();
    }

    function onPileTap(dest) {
      if (done) return;
      if (!sel) return;
      if (tryMove(dest)) return;
      sel = null;
      api.sound('bad');
      render();
    }

    // ---- 保存と再開 -------------------------------------------------
    function save() {
      if (done || !st) return;
      api.save('saved', { st, moves, elapsed: Date.now() - startAt });
    }

    function isUsableSave(saved) {
      return !!(saved && saved.st
        && Array.isArray(saved.st.cells) && saved.st.cells.length === 4
        && Array.isArray(saved.st.found) && saved.st.found.length === 4
        && Array.isArray(saved.st.tab) && saved.st.tab.length === 8);
    }

    function startTick() {
      clearInterval(tick);
      ticksSinceSave = 0;
      tick = setInterval(() => {
        if (done) return;
        updateHud();
        ticksSinceSave++;
        if (ticksSinceSave >= 5) {
          ticksSinceSave = 0;
          save();
        }
      }, 1000);
    }

    function newGame() {
      const deck = shuffle(makeDeck({ decks: 1 }));
      deck.forEach((card) => { card.up = true; });
      st = { cells: [null, null, null, null], found: [[], [], [], []], tab: Array.from({ length: 8 }, () => []) };

      // 横一列ずつ配るため、先頭4列が7枚、残り4列が6枚になる。
      deck.forEach((card, index) => st.tab[index % 8].push(card));
      hist = [];
      sel = null;
      moves = 0;
      done = false;
      startAt = Date.now();
      render();
      save();
      startTick();
    }

    api.buttons([
      { label: '戻す', onClick: undo },
      { label: '新しいゲーム', onClick: newGame, primary: true },
    ]);
    api.note('札をタップ → 置き先をタップ。同じ札をもう一度タップすると、上げられる場合は組札へ移動します');

    const onResize = () => render();
    window.addEventListener('resize', onResize);

    const saved = api.load('saved', null);
    if (isUsableSave(saved)) {
      st = saved.st;
      moves = Number.isFinite(saved.moves) ? saved.moves : 0;
      startAt = Date.now() - (Number.isFinite(saved.elapsed) ? saved.elapsed : 0);
      render();
      startTick();
    } else {
      newGame();
    }

    return () => {
      window.removeEventListener('resize', onResize);
      clearInterval(tick);
      save();
      style.remove();
    };
  },
};
