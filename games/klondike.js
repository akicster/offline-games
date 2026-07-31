// ソリティア（クロンダイク）
//
// 操作はタップ式。ドラッグ＆ドロップはスマホで扱いにくいため採用しない。
//   1回目のタップで動かす札を選び、2回目のタップで置き先を選ぶ。
//   組札に上げられる札は、その札をもう一度タップするだけで自動的に上がる。

import { makeDeck, shuffle, cardEl, pileEl, injectCardStyles, isRed, RANK_LABEL, suitSym } from '../lib/cards.js';

const SUIT_ORDER = ['s', 'h', 'd', 'c'];

export default {
  mount(root, api) {
    injectCardStyles();

    // st = { stock, waste, found[4], tab[7] }。札は {uid,suit,rank,up}
    let st = null;
    let sel = null;           // { pile:'tab'|'waste'|'found', i:列番号, from:何枚目から }
    let hist = [];            // 戻す用（盤面まるごとを保存する。52枚なので軽い）
    let startAt = 0, moves = 0, done = false, tick = null;

    const table = api.el('div', { class: 'table' });
    api.add(table);

    // ---- 寸法 -------------------------------------------------------
    let CW = 44, CH = 62, GAP = 5, FAN_UP = 13, FAN_DOWN = 22;
    function measure() {
      const w = Math.min(window.innerWidth - 20, 460);
      GAP = Math.max(4, Math.round(w * 0.013));
      CW = Math.floor((w - GAP * 6) / 7);
      CH = Math.round(CW * 1.42);
      FAN_UP = Math.round(CH * 0.20);    // 裏向きの札の重なり
      FAN_DOWN = Math.round(CH * 0.34);  // 表向きの札の重なり
      table.style.setProperty('--cw', CW + 'px');
      table.style.setProperty('--ch', CH + 'px');
      table.style.width = w + 'px';
      const maxLen = Math.max(...st.tab.map((c) => c.length), 1);
      const tabTop = CH + GAP * 3;
      table.style.height = (tabTop + CH + maxLen * FAN_DOWN + 20) + 'px';
    }
    const colX = (i) => i * (CW + GAP);

    // ---- 判定 -------------------------------------------------------
    const top = (a) => a[a.length - 1] || null;

    function canToFound(card, fi) {
      const f = st.found[fi];
      if (!f.length) return card.rank === 1 && SUIT_ORDER[fi] === card.suit;
      const t = top(f);
      return t.suit === card.suit && card.rank === t.rank + 1;
    }
    function canToTab(card, ti) {
      const t = top(st.tab[ti]);
      if (!t) return card.rank === 13;              // 空き列にはKだけ
      return t.up && isRed(t) !== isRed(card) && card.rank === t.rank - 1;
    }

    // ---- 盤面操作 ----------------------------------------------------
    function pushHist() { hist.push(JSON.stringify({ st, moves })); if (hist.length > 60) hist.shift(); }

    function takeFrom(p) {
      if (p.pile === 'waste') return st.waste.splice(st.waste.length - 1, 1);
      if (p.pile === 'found') return st.found[p.i].splice(st.found[p.i].length - 1, 1);
      return st.tab[p.i].splice(p.from);
    }

    /** 場札の一番上を自動でめくる */
    function flipUp() {
      for (const col of st.tab) {
        const t = top(col);
        if (t && !t.up) t.up = true;
      }
    }

    function checkWin() {
      if (st.found.every((f) => f.length === 13)) {
        done = true;
        clearInterval(tick);
        api.save('saved', null);
        api.win(Date.now() - startAt, `${moves}手`);
        return true;
      }
      return false;
    }

    /** 選択中の札を置き先へ動かす。動けたら true */
    function tryMove(dest) {
      if (!sel) return false;
      const src = sel.pile === 'tab' ? st.tab[sel.i] : sel.pile === 'waste' ? st.waste : st.found[sel.i];
      const moving = sel.pile === 'tab' ? src.slice(sel.from) : [top(src)];
      if (!moving.length || !moving[0]) return false;

      let ok = false;
      if (dest.pile === 'found') ok = moving.length === 1 && canToFound(moving[0], dest.i);
      else if (dest.pile === 'tab') ok = canToTab(moving[0], dest.i);
      if (!ok) return false;

      pushHist();
      const cards = takeFrom(sel);
      if (dest.pile === 'found') st.found[dest.i].push(...cards);
      else st.tab[dest.i].push(...cards);
      flipUp();
      moves++;
      sel = null;
      api.sound('good');
      render(); save();
      checkWin();
      return true;
    }

    /** その札を組札へ上げられるなら上げる */
    function autoToFound(p) {
      const src = p.pile === 'tab' ? st.tab[p.i] : p.pile === 'waste' ? st.waste : null;
      if (!src) return false;
      const card = top(src);
      if (!card || !card.up) return false;
      if (p.pile === 'tab' && p.from !== src.length - 1) return false;   // 一番上の札だけ
      for (let fi = 0; fi < 4; fi++) {
        if (canToFound(card, fi)) {
          pushHist();
          src.pop();
          st.found[fi].push(card);
          flipUp(); moves++; sel = null;
          api.sound('good');
          render(); save(); checkWin();
          return true;
        }
      }
      return false;
    }

    function drawStock() {
      if (done) return;
      pushHist();
      if (st.stock.length) {
        const c = st.stock.pop();
        c.up = true;
        st.waste.push(c);
      } else if (st.waste.length) {
        // めくり札を裏返して山札へ戻す
        while (st.waste.length) { const c = st.waste.pop(); c.up = false; st.stock.push(c); }
      } else { hist.pop(); return; }
      moves++; sel = null;
      api.sound('move');
      render(); save();
    }

    function undo() {
      if (!hist.length || done) return;
      const prev = JSON.parse(hist.pop());
      st = prev.st; moves = prev.moves;   // 手数も巻き戻す
      sel = null;
      api.sound('move');
      render(); save();
    }

    /** 上げられる札を一気に組札へ送る */
    function autoFinish() {
      let moved = true, guard = 0;
      while (moved && guard++ < 200) {
        moved = false;
        for (const p of [{ pile: 'waste', i: 0 }, ...st.tab.map((_, i) => ({ pile: 'tab', i, from: st.tab[i].length - 1 }))]) {
          const src = p.pile === 'waste' ? st.waste : st.tab[p.i];
          const card = top(src);
          if (!card || !card.up) continue;
          for (let fi = 0; fi < 4; fi++) {
            if (canToFound(card, fi)) { src.pop(); st.found[fi].push(card); flipUp(); moves++; moved = true; break; }
          }
          if (moved) break;
        }
      }
      api.sound('good');
      render(); save(); checkWin();
    }

    // ---- 描画 -------------------------------------------------------
    function place(el, x, y, z) {
      el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.zIndex = String(z);
      table.append(el);
    }

    function render() {
      measure();
      table.textContent = '';
      const rowY = 0;
      const tabY = CH + GAP * 3;

      // 山札
      const stockSlot = pileEl(st.stock.length ? '' : '↻');
      stockSlot.addEventListener('click', drawStock);
      place(stockSlot, colX(0), rowY, 0);
      st.stock.forEach((c, i) => {
        if (i < st.stock.length - 3) return;   // 厚みは3枚ぶんだけ描く
        const e = cardEl({ ...c, up: false });
        e.addEventListener('click', drawStock);
        place(e, colX(0) + (st.stock.length - 1 - i) * -1, rowY + (st.stock.length - 1 - i) * -1, 5 + i);
      });

      // めくり札
      const wasteSlot = pileEl('');
      place(wasteSlot, colX(1), rowY, 0);
      const wTop = top(st.waste);
      if (wTop) {
        const e = cardEl(wTop);
        if (sel && sel.pile === 'waste') e.classList.add('sel');
        e.addEventListener('click', () => onCardTap({ pile: 'waste', i: 0, from: st.waste.length - 1 }));
        place(e, colX(1), rowY, 20);
      }

      // 組札
      for (let fi = 0; fi < 4; fi++) {
        const x = colX(3 + fi);
        const slot = pileEl(suitSym({ suit: SUIT_ORDER[fi] }));
        slot.addEventListener('click', () => onPileTap({ pile: 'found', i: fi }));
        if (sel) slot.classList.add('tgt');
        place(slot, x, rowY, 0);
        const t = top(st.found[fi]);
        if (t) {
          const e = cardEl(t);
          e.addEventListener('click', () => onPileTap({ pile: 'found', i: fi }));
          place(e, x, rowY, 20);
        }
      }

      // 場札
      for (let ti = 0; ti < 7; ti++) {
        const x = colX(ti);
        const slot = pileEl('');
        slot.addEventListener('click', () => onPileTap({ pile: 'tab', i: ti }));
        if (sel) slot.classList.add('tgt');
        place(slot, x, tabY, 0);

        let y = tabY;
        st.tab[ti].forEach((c, ci) => {
          const e = cardEl(c);
          if (sel && sel.pile === 'tab' && sel.i === ti && ci >= sel.from) e.classList.add('sel');
          e.addEventListener('click', () => (c.up ? onCardTap({ pile: 'tab', i: ti, from: ci }) : null));
          place(e, x, y, 10 + ci);
          y += c.up ? FAN_DOWN : FAN_UP;
        });
      }

      api.hud({ '手数': moves, '完成': st.found.reduce((a, f) => a + f.length, 0) + '/52' });
    }

    // ---- タップ処理 --------------------------------------------------
    function onCardTap(p) {
      if (done) return;
      // 同じところをもう一度タップ → 組札に上げられるなら上げる。だめなら選択解除
      if (sel && sel.pile === p.pile && sel.i === p.i && sel.from === p.from) {
        if (!autoToFound(p)) { sel = null; api.sound('tap'); render(); }
        return;
      }
      // 置き先として押された可能性を先に試す
      if (sel && p.pile === 'tab' && tryMove({ pile: 'tab', i: p.i })) return;

      // 選択する。場札は「その札から上が正しく連なっているか」を確かめる
      if (p.pile === 'tab') {
        const col = st.tab[p.i];
        for (let k = p.from; k < col.length - 1; k++) {
          const a = col[k], b = col[k + 1];
          if (!a.up || !b.up || isRed(a) === isRed(b) || b.rank !== a.rank - 1) { api.sound('bad'); sel = null; render(); return; }
        }
      }
      sel = p;
      api.sound('tap');
      render();
    }

    function onPileTap(dest) {
      if (done) return;
      if (sel) {
        if (tryMove(dest)) return;
        api.sound('bad'); sel = null; render(); return;
      }
      // 何も選んでいない状態で組札を押したら、上げられる札を探して上げる
      if (dest.pile === 'found') {
        for (const p of [{ pile: 'waste', i: 0 }, ...st.tab.map((_, i) => ({ pile: 'tab', i, from: st.tab[i].length - 1 }))]) {
          if (autoToFound(p)) return;
        }
      }
    }

    // ---- 保存と再開 --------------------------------------------------
    function save() {
      if (done) return;
      api.save('saved', { st, moves, elapsed: Date.now() - startAt });
    }

    function newGame() {
      const deck = shuffle(makeDeck({ decks: 1 }));
      st = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []] };
      let k = 0;
      for (let i = 0; i < 7; i++) {
        for (let j = i; j < 7; j++) {
          const c = deck[k++];
          c.up = (j === i);
          st.tab[j].push(c);
        }
      }
      // 配り方の都合で各列の最後が表になるよう並べ直す
      for (const col of st.tab) { col.forEach((c) => { c.up = false; }); const t = top(col); if (t) t.up = true; }
      st.stock = deck.slice(k).map((c) => ({ ...c, up: false }));
      hist = []; sel = null; moves = 0; done = false;
      startAt = Date.now();
      render(); save(); startTick();
    }

    function startTick() { clearInterval(tick); tick = setInterval(() => { if (!done) save(); }, 5000); }

    api.buttons([
      { label: '戻す', onClick: undo },
      { label: '一気に上げる', onClick: autoFinish },
      { label: '新しいゲーム', onClick: newGame, primary: true },
    ]);
    api.note('動かす札をタップ → 置き先をタップ。同じ札をもう一度タップすると、上げられる場合は組札へ上がります');

    const onResize = () => render();
    window.addEventListener('resize', onResize);

    const saved = api.load('saved', null);
    if (saved && saved.st && saved.st.tab && saved.st.tab.length === 7) {
      st = saved.st; moves = saved.moves || 0;
      startAt = Date.now() - (saved.elapsed || 0);
      render(); startTick();
    } else {
      newGame();
    }

    return () => { window.removeEventListener('resize', onResize); clearInterval(tick); save(); };
  },
};
