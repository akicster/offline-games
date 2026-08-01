// かずタッチ — 散らばった数字を1から順に押し、完了までの時間を競う。

const SIZES = [25, 36, 49];
const PENALTY_MS = 2000;

export default {
  mount(root, api) {
    let total = SIZES[0];
    let next = 1;
    let slots = [];
    let shuffleOn = false;
    let startAt = 0;
    let penaltyMs = 0;
    let finalMs = 0;
    let done = false;
    let tick = null;
    const wrongTimers = new Set();

    const style = api.el('style', {}, `
      .nt-controls{width:min(92vw,400px);display:flex;align-items:center;justify-content:center;
        gap:8px;flex-wrap:wrap}
      .nt-size-group{display:flex;gap:4px}
      .nt-size{padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--panel);
        color:var(--ink);font:inherit;font-size:12px;cursor:pointer}
      .nt-size.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:700}
      .nt-shuffle{display:flex;align-items:center;gap:5px;color:var(--ink);font-size:12px;cursor:pointer;
        user-select:none;white-space:nowrap}
      .nt-shuffle input{width:17px;height:17px;margin:0;accent-color:var(--accent)}
      .nt-board{--nt-cols:5;width:min(92vw,400px);aspect-ratio:1;display:grid;
        grid-template-columns:repeat(var(--nt-cols),minmax(0,1fr));
        grid-template-rows:repeat(var(--nt-cols),minmax(0,1fr));gap:clamp(2px,.8vw,4px);
        touch-action:manipulation;user-select:none}
      .nt-cell{min-width:0;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--panel);
        color:var(--ink);box-shadow:var(--shadow);font:700 clamp(12px,4vw,19px)/1 system-ui,sans-serif;
        font-variant-numeric:tabular-nums;cursor:pointer;transition:transform .1s,box-shadow .1s,
        border-color .1s,color .1s,opacity .1s}
      .nt-cell:active{transform:scale(.94)}
      .nt-cell.done{opacity:.16;cursor:default;box-shadow:none}
      .nt-cell.wrong{color:var(--bad);border-color:var(--bad);
        box-shadow:inset 0 0 0 3px var(--bad),0 0 12px var(--bad);transform:scale(.94)}
    `);

    const sizeButtons = SIZES.map((size) => api.el('button', {
      type: 'button',
      class: 'nt-size',
      onclick: () => {
        api.sound('tap');
        newRound(size);
      },
    }, `1〜${size}`));
    const sizeGroup = api.el('div', { class: 'nt-size-group', 'aria-label': '数字の範囲' }, ...sizeButtons);

    const shuffleInput = api.el('input', {
      type: 'checkbox',
      'aria-label': '正解するたびに数字をシャッフル',
      onchange: (event) => {
        shuffleOn = event.currentTarget.checked;
        api.sound('tap');
        if (shuffleOn && !done) {
          reshuffleSlots();
          renderBoard();
        }
      },
    });
    const shuffleLabel = api.el('label', { class: 'nt-shuffle' }, shuffleInput, 'シャッフルあり');
    const controls = api.el('div', { class: 'nt-controls' }, sizeGroup, shuffleLabel);
    const board = api.el('div', { class: 'nt-board', 'aria-label': '数字の盤面' });

    api.add(style, controls, board);
    api.note('盤面が出たら計測開始。1から順に押します。間違いは2秒加算、シャッフルは途中でも切り替えられます');
    api.buttons([{ label: 'もう一度', onClick: () => newRound(total), primary: true }]);

    function formatTime(ms) {
      return `${(ms / 1000).toFixed(1)}秒`;
    }

    function elapsed() {
      if (done) return finalMs;
      return Math.max(0, performance.now() - startAt) + penaltyMs;
    }

    function updateHud() {
      api.hud({
        '次': done ? '完了' : `${next}/${total}`,
        '時間': formatTime(elapsed()),
        '加算': `+${penaltyMs / 1000}秒`,
      });
    }

    function stopClock() {
      if (tick !== null) clearInterval(tick);
      tick = null;
    }

    function startClock() {
      stopClock();
      tick = setInterval(updateHud, 100);
    }

    function clearWrongTimers() {
      for (const timer of wrongTimers) clearTimeout(timer);
      wrongTimers.clear();
    }

    function flashWrong(button) {
      button.classList.remove('wrong');
      // 連続で同じ数字を押しても発光が最初から見えるようにする。
      void button.offsetWidth;
      button.classList.add('wrong');
      const timer = setTimeout(() => {
        wrongTimers.delete(timer);
        button.classList.remove('wrong');
      }, 260);
      wrongTimers.add(timer);
    }

    function pressNumber(value, button) {
      if (done || value < next) return;
      if (value !== next) {
        penaltyMs += PENALTY_MS;
        flashWrong(button);
        api.sound('bad');
        updateHud();
        return;
      }

      api.sound('move');
      next++;
      if (next > total) {
        finalMs = Math.round(Math.max(0, performance.now() - startAt) + penaltyMs);
        done = true;
        stopClock();
        renderBoard();
        updateHud();
        const mode = shuffleOn ? 'シャッフルあり' : 'シャッフルなし';
        api.win(finalMs, `1〜${total}・${mode}・加算${penaltyMs / 1000}秒`);
        return;
      }

      if (shuffleOn) reshuffleSlots();
      renderBoard();
      updateHud();
    }

    function reshuffleSlots() {
      const oldNextIndex = slots.indexOf(next);
      const shuffled = api.shuffle(slots);
      // 偶然同じ位置になった場合も、次に押す数字だけは必ず別の場所へ動かす。
      if (oldNextIndex >= 0 && shuffled.indexOf(next) === oldNextIndex && shuffled.length > 1) {
        const swapIndex = (oldNextIndex + 1) % shuffled.length;
        [shuffled[oldNextIndex], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[oldNextIndex]];
      }
      slots = shuffled;
    }

    function renderBoard() {
      const columns = Math.sqrt(total);
      board.style.setProperty('--nt-cols', String(columns));
      board.textContent = '';
      for (const value of slots) {
        const completed = value < next;
        const button = api.el('button', {
          type: 'button',
          class: 'nt-cell' + (completed ? ' done' : ''),
          disabled: completed ? '' : null,
          'aria-label': completed ? `${value}（押し終わり）` : String(value),
          onclick: () => pressNumber(value, button),
        }, String(value));
        board.append(button);
      }
    }

    function updateSizeButtons() {
      sizeButtons.forEach((button, index) => {
        const selected = SIZES[index] === total;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }

    function newRound(size) {
      clearWrongTimers();
      stopClock();
      total = size;
      next = 1;
      penaltyMs = 0;
      finalMs = 0;
      done = false;
      slots = api.shuffle(Array.from({ length: total }, (_, index) => index + 1));
      updateSizeButtons();
      // 範囲変更と「もう一度」では、盤面生成時点からゼロで計測し直す。
      startAt = performance.now();
      renderBoard();
      updateHud();
      startClock();
    }

    newRound(total);

    return () => {
      stopClock();
      clearWrongTimers();
    };
  },
};
