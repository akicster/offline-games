// ライツアウト — 押すと十字に反転。すべて消せばクリア。
//
// 【ゲーム実装のお手本 その2: タップ入力・クリア判定・手数記録】
// 出題は「消えた状態からランダムに押す」方式で作る。必ず解ける盤面になる。

const N = 5;

export default {
  mount(root, api) {
    let on, moves, done;

    const wrap = api.el('div', { style: `width:min(84vw,340px);aspect-ratio:1;display:grid;grid-template-columns:repeat(${N},1fr);gap:7px` });
    api.add(wrap);
    api.note('マスを押すと、そのマスと上下左右が切り替わります。すべて消したらクリアです');
    api.buttons([{ label: '別の問題', onClick: reset, primary: true }]);

    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const b = api.el('button', {
        style: 'border:none;border-radius:9px;cursor:pointer;padding:0;transition:background .12s',
        onclick: () => press(i),
      });
      cells.push(b); wrap.append(b);
    }

    function draw() {
      for (let i = 0; i < N * N; i++) {
        cells[i].style.background = on[i] ? '#ffd44d' : '#2f3140';
        cells[i].style.boxShadow = on[i] ? '0 0 12px rgba(255,212,77,.5)' : 'none';
      }
      api.hud({ '手数': moves, '最少': api.best() ?? '—' });
    }

    function toggle(i) {
      const r = (i / N) | 0, c = i % N;
      on[i] = !on[i];
      if (r > 0) on[i - N] = !on[i - N];
      if (r < N - 1) on[i + N] = !on[i + N];
      if (c > 0) on[i - 1] = !on[i - 1];
      if (c < N - 1) on[i + 1] = !on[i + 1];
    }

    function press(i) {
      if (done) return;
      toggle(i);
      moves++;
      api.sound('move');
      draw();
      if (on.every((v) => !v)) {
        done = true;
        api.win(moves, `${moves}手でクリア`);
      }
    }

    function reset() {
      on = new Array(N * N).fill(false);
      moves = 0; done = false;
      // 消えた状態からランダムに押す → 必ず解ける盤面になる
      let lit = 0;
      while (lit < 4) {
        for (let k = 0; k < 6 + api.rand(6); k++) toggle(api.rand(N * N));
        lit = on.filter(Boolean).length;
      }
      draw();
    }

    reset();
  },
};
