// おとおぼえ — 光った4色の順番を覚えて、同じ順で押し返す。

const PADS = [
  { name: 'あか', mark: '●', color: 'var(--bad)', sound: 'tap' },
  { name: 'あお', mark: '◆', color: 'var(--accent)', sound: 'move' },
  { name: 'きいろ', mark: '▲', color: 'var(--warn)', sound: 'good' },
  { name: 'みどり', mark: '■', color: 'var(--good)', sound: 'bad' },
];

export default {
  mount(root, api) {
    let sequence = [];
    let inputIndex = 0;
    let completed = 0;
    let phase = 'idle';
    let runToken = 0;
    let disposed = false;

    // 予約したタイマーを一括で解除できるように管理する。
    const timers = new Set();
    function later(fn, delay) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, delay);
      timers.add(id);
      return id;
    }
    function clearTimers() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
    }

    const style = api.el('style', {}, `
      .smn-wrap{width:min(92vw,400px);max-width:100%;display:flex;flex-direction:column;align-items:stretch;gap:10px}
      .smn-status{min-height:52px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;
        align-items:center;padding:7px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);
        color:var(--ink);text-align:center}
      .smn-status strong{font-size:16px;line-height:1.3}
      .smn-status span{margin-top:2px;color:var(--sub);font-size:12px;line-height:1.3}
      .smn-board{width:100%;aspect-ratio:1;box-sizing:border-box;display:grid;grid-template-columns:repeat(2,1fr);
        gap:clamp(9px,3vw,14px);padding:clamp(8px,2.5vw,12px);border:1px solid var(--line);border-radius:20px;
        background:var(--panel);box-shadow:var(--shadow);touch-action:manipulation;user-select:none}
      .smn-pad{position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:0;border:2px solid
        color-mix(in srgb,var(--ink) 24%,transparent);border-radius:24%;background:color-mix(in srgb,var(--smn-color) 56%,var(--panel));
        color:var(--ink);cursor:pointer;outline:none;transition:transform .08s ease,filter .08s ease,box-shadow .08s ease,
        background .08s ease;-webkit-tap-highlight-color:transparent}
      .smn-pad:disabled{cursor:default;opacity:1}
      .smn-pad span{display:grid;place-items:center;width:42%;aspect-ratio:1;border-radius:50%;background:var(--panel);
        color:var(--ink);font-size:clamp(22px,8vw,38px);line-height:1;box-shadow:0 0 0 2px var(--line)}
      .smn-pad.smn-active{z-index:1;transform:scale(1.045);filter:brightness(1.38) saturate(1.35);
        background:var(--smn-color);box-shadow:0 0 0 5px var(--ink),0 0 28px 10px
        color-mix(in srgb,var(--smn-color) 72%,transparent)}
      .smn-pad.smn-active span{box-shadow:0 0 0 4px var(--panel);transform:scale(1.08)}
      .smn-pad.smn-wrong{animation:smn-shake .16s linear 2;box-shadow:0 0 0 6px var(--bad),0 0 0 11px var(--panel)}
      @keyframes smn-shake{0%,100%{translate:0}25%{translate:-5px}75%{translate:5px}}
      @media (prefers-reduced-motion:reduce){.smn-pad{transition:none}.smn-pad.smn-wrong{animation:none}}
    `);

    const statusMain = api.el('strong', {}, 'スタートを押してください');
    const statusSub = api.el('span', {}, '光った色を順番どおりに押します');
    const status = api.el('div', { class: 'smn-status', 'aria-live': 'polite' }, statusMain, statusSub);
    const board = api.el('div', { class: 'smn-board', 'aria-label': '4色のボタン' });
    const wrap = api.el('div', { class: 'smn-wrap' }, status, board);
    api.add(style, wrap);

    const padEls = PADS.map((pad, index) => {
      const button = api.el('button', {
        type: 'button',
        class: 'smn-pad',
        style: `--smn-color:${pad.color}`,
        'aria-label': pad.name,
        'aria-pressed': 'false',
        disabled: '',
        onclick: () => onPadPress(index),
      }, api.el('span', { 'aria-hidden': 'true' }, pad.mark));
      board.append(button);
      return button;
    });

    function setPadsEnabled(enabled) {
      for (const pad of padEls) pad.disabled = !enabled;
    }

    function setPadLight(index, on, wrong = false) {
      const pad = padEls[index];
      pad.classList.toggle('smn-active', on);
      pad.classList.toggle('smn-wrong', on && wrong);
      pad.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function clearPadLights() {
      for (let i = 0; i < padEls.length; i++) setPadLight(i, false);
    }

    function updateHud() {
      api.hud({ '成功': completed, '長さ': sequence.length || '—', '最高': api.best() ?? '—' });
    }

    function setStartButton(started) {
      api.buttons([{ label: started ? 'はじめから' : 'スタート', onClick: startGame, primary: true }]);
    }

    function startGame() {
      clearTimers();
      clearPadLights();
      runToken++;
      sequence = [api.rand(PADS.length)];
      inputIndex = 0;
      completed = 0;
      phase = 'ready';
      setPadsEnabled(false);
      statusMain.textContent = '準備してください';
      statusSub.textContent = '最初は1個です';
      updateHud();
      setStartButton(true);

      const token = runToken;
      later(() => {
        if (!disposed && token === runToken) showSequence();
      }, 500);
    }

    function showSequence() {
      clearTimers();
      clearPadLights();
      phase = 'showing';
      setPadsEnabled(false);
      const token = ++runToken;
      const litMs = Math.max(190, 430 - (sequence.length - 1) * 12);
      const gapMs = Math.max(90, 190 - (sequence.length - 1) * 5);

      statusMain.textContent = 'よく見てください';
      statusSub.textContent = `${sequence.length}個の順番を再生します`;

      function playStep(index) {
        if (disposed || token !== runToken || phase !== 'showing') return;
        if (index >= sequence.length) {
          clearPadLights();
          later(() => beginInput(token), 280);
          return;
        }

        clearPadLights();
        const padIndex = sequence[index];
        setPadLight(padIndex, true);
        statusSub.textContent = `${index + 1} / ${sequence.length}`;
        api.sound(PADS[padIndex].sound);
        later(() => {
          if (disposed || token !== runToken || phase !== 'showing') return;
          setPadLight(padIndex, false);
          later(() => playStep(index + 1), gapMs);
        }, litMs);
      }

      later(() => playStep(0), 450);
    }

    function beginInput(token) {
      if (disposed || token !== runToken || phase !== 'showing') return;
      phase = 'input';
      inputIndex = 0;
      setPadsEnabled(true);
      statusMain.textContent = 'あなたの番です';
      statusSub.textContent = `1 / ${sequence.length}`;
    }

    function onPadPress(index) {
      if (phase !== 'input' || disposed) return;
      api.sound(PADS[index].sound);

      if (index !== sequence[inputIndex]) {
        clearTimers();
        clearPadLights();
        phase = 'ended';
        setPadsEnabled(false);
        setPadLight(index, true, true);
        statusMain.textContent = 'まちがいです';
        statusSub.textContent = `${completed}個まで正解しました`;
        const score = completed;
        later(() => {
          if (disposed || phase !== 'ended') return;
          setPadLight(index, false);
          api.lose(score, `${score}個まで正解`);
        }, 380);
        return;
      }

      setPadLight(index, true);
      later(() => setPadLight(index, false), 150);
      inputIndex++;

      if (inputIndex < sequence.length) {
        statusSub.textContent = `${inputIndex + 1} / ${sequence.length}`;
        return;
      }

      completed = sequence.length;
      phase = 'between';
      setPadsEnabled(false);
      statusMain.textContent = '正解！';
      statusSub.textContent = `次は${sequence.length + 1}個です`;
      updateHud();
      const token = runToken;
      later(() => {
        if (disposed || token !== runToken || phase !== 'between') return;
        sequence.push(api.rand(PADS.length));
        updateHud();
        showSequence();
      }, 700);
    }

    api.note('光った色を同じ順番で押してください。正解するたびに順番が1つ長くなり、再生も少し速くなります');
    setStartButton(false);
    updateHud();

    return () => {
      disposed = true;
      runToken++;
      clearTimers();
      clearPadLights();
    };
  },
};
