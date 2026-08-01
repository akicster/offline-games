// ピラミッドソリティア
//
// 露出した札をタップで選び、合計13になる札を続けてタップして取り除く。
// Kは1枚だけで取り除ける。山札の配り直しは1回まで。

import { makeDeck, shuffle, cardEl, pileEl, injectCardStyles, RANK_LABEL, suitSym } from '../lib/cards.js';

const ROWS = 7;
const PYRAMID_SIZE = 28;
const SAVE_VERSION = 1;

export default {
  mount(root, api) {
    injectCardStyles();

    // st = { pyramid[28], stock, waste, redeals }。除去済みの場札は null。
    let st = null;
    let sel = null;           // { pile:'pyramid', index } または { pile:'waste' }
    let hist = [];            // 戻す用。盤面全体を保存しても52枚なので十分軽い。
    let startAt = 0;
    let moves = 0;
    let done = false;
    let tick = null;
    let ticksUntilSave = 20;

    const table = api.el('div', { class: 'table' });
    api.add(table);
    api.note('露出した2枚で13を作ります（A=1、J=11、Q=12）。Kは1枚で取れ、山札は1回だけ戻せます');
    api.buttons([
      { label: '戻す', onClick: undo },
      { label: '新しいゲーム', onClick: newGame, primary: true },
    ]);

    // ---- 寸法 -------------------------------------------------------
    let CW = 46, CH = 65, GAP = 3, STEP_X = 49, STEP_Y = 29, PYRAMID_TOP = 92;

    function measure() {
      // 375px幅では92vw、広い画面でも400pxまでに収める。
      const viewport = window.innerWidth || root.clientWidth || 400;
      const rootWidth = root.clientWidth || viewport;
      const width = Math.max(240, Math.floor(Math.min(viewport * 0.92, rootWidth, 400)));
      GAP = Math.max(2, Math.round(width * 0.009));
      CW = Math.floor((width - GAP * (ROWS - 1)) / ROWS);
      CH = Math.round(CW * 1.42);
      STEP_X = CW + GAP;
      STEP_Y = Math.round(CH * 0.43);
      PYRAMID_TOP = CH + 28;

      const actualWidth = CW * ROWS + GAP * (ROWS - 1);
      table.style.setProperty('--cw', `${CW}px`);
      table.style.setProperty('--ch', `${CH}px`);
      table.style.width = `${actualWidth}px`;
      table.style.height = `${PYRAMID_TOP + CH + STEP_Y * (ROWS - 1) + 2}px`;
    }

    const rowStart = (row) => (row * (row + 1)) / 2;
    const indexOf = (row, col) => rowStart(row) + col;
    const top = (cards) => cards[cards.length - 1] || null;
    const elapsed = () => Math.max(0, Date.now() - startAt);

    function cardName(card) {
      return `${suitSym(card)}${RANK_LABEL[card.rank]}`;
    }

    function formatTime(ms) {
      return `${(ms / 1000).toFixed(1)}秒`;
    }

    function remaining() {
      return st.pyramid.reduce((count, card) => count + (card ? 1 : 0), 0);
    }

    // ---- 判定 -------------------------------------------------------
    function isExposed(index) {
      if (!st.pyramid[index]) return false;

      let row = 0;
      while (row < ROWS - 1 && index >= rowStart(row + 1)) row++;
      if (row === ROWS - 1) return true;

      const col = index - rowStart(row);
      return !st.pyramid[indexOf(row + 1, col)] && !st.pyramid[indexOf(row + 1, col + 1)];
    }

    function cardAt(ref) {
      if (!ref) return null;
      if (ref.pile === 'waste') return top(st.waste);
      return st.pyramid[ref.index] || null;
    }

    function isAvailable(ref) {
      if (!ref) return false;
      if (ref.pile === 'waste') return Boolean(top(st.waste));
      return isExposed(ref.index);
    }

    function sameRef(a, b) {
      if (!a || !b || a.pile !== b.pile) return false;
      return a.pile === 'waste' || a.index === b.index;
    }

    // ---- 盤面操作 ----------------------------------------------------
    function pushHist() {
      hist.push(JSON.stringify({ st, moves }));
      if (hist.length > 80) hist.shift();
    }

    function removeCard(ref) {
      if (ref.pile === 'waste') st.waste.pop();
      else st.pyramid[ref.index] = null;
    }

    function checkWin() {
      if (remaining() !== 0) return false;
      done = true;
      clearInterval(tick);
      api.save('saved', null);
      api.win(elapsed(), `${moves}手`);
      return true;
    }

    function takeCards(first, second = null) {
      pushHist();
      removeCard(first);
      if (second) removeCard(second);
      moves++;
      sel = null;
      api.sound('good');
      render();
      if (!checkWin()) save();
    }

    function onCardTap(ref) {
      if (done || !isAvailable(ref)) return;
      const card = cardAt(ref);
      if (!card) return;

      // Kは相手を選ばず、その1枚だけで取り除ける。
      if (card.rank === 13) {
        takeCards(ref);
        return;
      }

      if (!sel) {
        sel = ref;
        api.sound('tap');
        render();
        return;
      }

      if (sameRef(sel, ref)) {
        sel = null;
        api.sound('tap');
        render();
        return;
      }

      const first = cardAt(sel);
      if (first && isAvailable(sel) && first.rank + card.rank === 13) {
        takeCards(sel, ref);
        return;
      }

      sel = null;
      api.sound('bad');
      render();
    }

    function drawStock() {
      if (done) return;

      if (st.stock.length) {
        pushHist();
        const card = st.stock.pop();
        card.up = true;
        st.waste.push(card);
      } else if (st.waste.length && st.redeals === 0) {
        pushHist();
        while (st.waste.length) {
          const card = st.waste.pop();
          card.up = false;
          st.stock.push(card);
        }
        st.redeals = 1;
      } else {
        api.sound('bad');
        return;
      }

      moves++;
      sel = null;
      api.sound('move');
      render();
      save();
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
    function place(element, x, y, z) {
      element.style.left = `${Math.round(x)}px`;
      element.style.top = `${Math.round(y)}px`;
      element.style.zIndex = String(z);
      table.append(element);
    }

    function bindActivate(element, label, fn) {
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', label);
      element.tabIndex = 0;
      element.addEventListener('click', fn);
      element.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        fn();
      });
    }

    function addLabel(text, x) {
      const label = api.el('div', {
        style: `position:absolute;left:${Math.round(x)}px;top:${CH + 4}px;width:${CW}px;`
          + 'text-align:center;color:var(--sub);font-size:11px;line-height:18px',
      }, text);
      table.append(label);
    }

    function updateHud() {
      if (!st) return;
      api.hud({
        '時間': formatTime(elapsed()),
        '残り': `${remaining()}/28`,
        '手数': moves,
        '戻し': st.redeals === 0 ? '1回' : '済み',
      });
    }

    function render() {
      measure();
      table.textContent = '';

      // 山札。空になったときは同じ場所を押して1回だけ戻せる。
      const stockMark = st.stock.length ? '' : (st.waste.length && st.redeals === 0 ? '↻' : '—');
      const stockSlot = pileEl(stockMark);
      bindActivate(stockSlot, st.stock.length ? '山札から1枚めくる' : 'めくり札を山札へ戻す', drawStock);
      place(stockSlot, 0, 0, 1);
      st.stock.forEach((card, index) => {
        if (index < st.stock.length - 3) return;
        const back = cardEl({ ...card, up: false });
        bindActivate(back, '山札から1枚めくる', drawStock);
        const offset = st.stock.length - 1 - index;
        place(back, offset, offset, 5 + index);
      });
      addLabel('山札', 0);

      // めくり札は一番上だけを選べる。
      const wasteSlot = pileEl('');
      wasteSlot.style.pointerEvents = 'none';
      place(wasteSlot, STEP_X, 0, 1);
      const wasteTop = top(st.waste);
      if (wasteTop) {
        const wasteCard = cardEl({ ...wasteTop, up: true });
        if (sel && sel.pile === 'waste') wasteCard.classList.add('sel');
        bindActivate(wasteCard, `${cardName(wasteTop)}を選ぶ`, () => onCardTap({ pile: 'waste' }));
        place(wasteCard, STEP_X, 0, 12);
      }
      addLabel('めくり札', STEP_X);

      // 空いた位置の輪郭はカードより後ろに置き、露出札の操作を遮らない。
      for (let row = 0; row < ROWS; row++) {
        const rowX = ((ROWS - 1 - row) * STEP_X) / 2;
        for (let col = 0; col <= row; col++) {
          const slot = pileEl('');
          slot.style.opacity = '.24';
          slot.style.pointerEvents = 'none';
          place(slot, rowX + col * STEP_X, PYRAMID_TOP + row * STEP_Y, 1);
        }
      }

      // 下段ほど手前に描き、実際のカードの重なりと露出条件を一致させる。
      for (let row = 0; row < ROWS; row++) {
        const rowX = ((ROWS - 1 - row) * STEP_X) / 2;
        for (let col = 0; col <= row; col++) {
          const index = indexOf(row, col);
          const card = st.pyramid[index];
          if (!card) continue;

          const element = cardEl({ ...card, up: true });
          if (sel && sel.pile === 'pyramid' && sel.index === index) element.classList.add('sel');
          if (isExposed(index)) {
            bindActivate(element, `${cardName(card)}を選ぶ`, () => onCardTap({ pile: 'pyramid', index }));
          } else {
            element.style.cursor = 'default';
            element.setAttribute('aria-hidden', 'true');
          }
          place(element, rowX + col * STEP_X, PYRAMID_TOP + row * STEP_Y, 20 + row);
        }
      }

      updateHud();
    }

    // ---- 保存と再開 --------------------------------------------------
    function save() {
      if (done || !st) return;
      api.save('saved', { version: SAVE_VERSION, st, moves, elapsed: elapsed() });
    }

    function validCard(card) {
      return card && Number.isInteger(card.uid) && card.uid >= 0 && card.uid < 52
        && ['s', 'h', 'd', 'c'].includes(card.suit)
        && Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13;
    }

    function validSaved(saved) {
      if (!saved || saved.version !== SAVE_VERSION || !saved.st) return false;
      const state = saved.st;
      if (!Array.isArray(state.pyramid) || state.pyramid.length !== PYRAMID_SIZE
          || !Array.isArray(state.stock) || !Array.isArray(state.waste)
          || (state.redeals !== 0 && state.redeals !== 1)) return false;

      const cards = [...state.pyramid.filter(Boolean), ...state.stock, ...state.waste];
      if (cards.some((card) => !validCard(card))) return false;
      return new Set(cards.map((card) => card.uid)).size === cards.length;
    }

    function startTick() {
      clearInterval(tick);
      ticksUntilSave = 20;
      tick = setInterval(() => {
        if (done) return;
        updateHud();
        ticksUntilSave--;
        if (ticksUntilSave <= 0) {
          ticksUntilSave = 20;
          save();
        }
      }, 250);
    }

    function newGame() {
      clearInterval(tick);
      const deck = shuffle(makeDeck({ decks: 1 }));
      st = {
        pyramid: deck.slice(0, PYRAMID_SIZE).map((card) => ({ ...card, up: true })),
        stock: deck.slice(PYRAMID_SIZE).map((card) => ({ ...card, up: false })),
        waste: [],
        redeals: 0,
      };
      hist = [];
      sel = null;
      moves = 0;
      done = false;
      startAt = Date.now();
      render();
      save();
      startTick();
    }

    const onResize = () => { if (st) render(); };
    window.addEventListener('resize', onResize);

    const saved = api.load('saved', null);
    if (validSaved(saved)) {
      st = saved.st;
      st.pyramid.forEach((card) => { if (card) card.up = true; });
      st.stock.forEach((card) => { card.up = false; });
      st.waste.forEach((card) => { card.up = true; });
      moves = Number.isFinite(saved.moves) ? Math.max(0, Math.floor(saved.moves)) : 0;
      startAt = Date.now() - (Number.isFinite(saved.elapsed) ? Math.max(0, saved.elapsed) : 0);
      render();
      startTick();
    } else {
      newGame();
    }

    return () => {
      window.removeEventListener('resize', onResize);
      clearInterval(tick);
      save();
    };
  },
};
