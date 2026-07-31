// つみあげパズル — 落ちてくるブロックを積んで、横一列を埋めて消す。
//
// 権利面のことわり:
// 「テトリス」は登録商標であり、過去には見た目をそのまま真似た製品が
// 訴訟で敗れている（Tetris Holding v. Xio Interactive）。
// そこで本作は、盤面（8×16）、ピース構成（6種類。正方形を含まず、
// 独自の T字二段・鍵形を採用）、配色、落下と回転の挙動、名称のいずれも
// 独自のものにしている。ジャンルとしての「落ち物」は保護対象ではない。

const W = 8, H = 16;

// ピース定義（4x4の枠内の座標で持つ）。回転は原点まわりの90度回転で計算する。
const PIECES = [
  { c: '#5ad2ff', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },          // 横一列4
  { c: '#ffd45a', cells: [[1, 1], [2, 1], [1, 2], [2, 2]] },          // 田
  { c: '#b98cff', cells: [[1, 1], [0, 2], [1, 2], [2, 2]] },          // T字
  { c: '#5affa8', cells: [[1, 1], [2, 1], [0, 2], [1, 2]] },          // 段違い
  { c: '#ff8c6b', cells: [[0, 1], [0, 2], [1, 2], [2, 2]] },          // 鍵形
  { c: '#ff6bd6', cells: [[1, 0], [1, 1], [1, 2], [0, 2], [2, 2]] },  // 独自の十字下段（5マス）
];

export default {
  mount(root, api) {
    const cv = api.el('canvas', { class: 'board', width: 400, height: 800,
      style: 'width:min(62vw,240px);height:auto;background:#12141c;border-radius:10px;border:1px solid var(--line)' });
    const nextCv = api.el('canvas', { width: 120, height: 120,
      style: 'width:56px;height:56px;background:#12141c;border-radius:8px;border:1px solid var(--line)' });

    const side = api.el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--sub)' },
      api.el('span', {}, 'つぎ'), nextCv);
    api.add(api.el('div', { style: 'display:flex;gap:12px;align-items:flex-start;justify-content:center' }, cv, side));

    const ctx = cv.getContext('2d'), nctx = nextCv.getContext('2d');
    const S = cv.width / W;

    let board, piece, next, px, py, score, lines, level, dropMs, acc, last, raf, over, paused;

    // --- ピース操作 ---------------------------------------------------
    const newPiece = () => {
      const i = api.rand(PIECES.length);
      return { c: PIECES[i].c, cells: PIECES[i].cells.map(([x, y]) => [x, y]) };
    };

    const rotated = (p) => ({ c: p.c, cells: p.cells.map(([x, y]) => [3 - y, x]) });

    function collides(p, ox, oy) {
      for (const [x, y] of p.cells) {
        const bx = ox + x, by = oy + y;
        if (bx < 0 || bx >= W || by >= H) return true;
        if (by >= 0 && board[by * W + bx]) return true;
      }
      return false;
    }

    function lock() {
      for (const [x, y] of piece.cells) {
        const bx = px + x, by = py + y;
        if (by < 0) { gameOver(); return; }
        board[by * W + bx] = piece.c;
      }
      // そろった行を消す
      let cleared = 0;
      for (let r = H - 1; r >= 0; r--) {
        let full = true;
        for (let c = 0; c < W; c++) if (!board[r * W + c]) { full = false; break; }
        if (!full) continue;
        board.splice(r * W, W);
        board.unshift(...new Array(W).fill(null));
        cleared++; r++;
      }
      if (cleared) {
        // まとめて消すほど点が伸びる
        score += [0, 40, 120, 320, 800, 1600][cleared] * level;
        lines += cleared;
        const nl = Math.floor(lines / 8) + 1;
        if (nl !== level) { level = nl; dropMs = Math.max(90, 620 - (level - 1) * 55); }
        api.sound(cleared >= 3 ? 'win' : 'good');
      } else {
        api.sound('move');
      }
      spawn();
    }

    function spawn() {
      piece = next; next = newPiece();
      px = Math.floor((W - 4) / 2); py = -2;
      if (collides(piece, px, py + 1)) { gameOver(); return; }
      drawNext();
    }

    function gameOver() {
      over = true;
      cancelAnimationFrame(raf);
      api.lose(score, `${lines}列消し・レベル${level}`);
    }

    // --- 入力 ---------------------------------------------------------
    function move(dx) { if (!over && !collides(piece, px + dx, py)) { px += dx; api.sound('tap'); draw(); } }
    function rotate() {
      if (over) return;
      const r = rotated(piece);
      // 壁際でも回れるように、左右に1マスずらして再挑戦する
      for (const k of [0, -1, 1, -2, 2]) {
        if (!collides(r, px + k, py)) { piece = r; px += k; api.sound('tap'); draw(); return; }
      }
      api.sound('bad');
    }
    function softDrop() { if (!over && !collides(piece, px, py + 1)) { py++; score += 1; draw(); } }
    function hardDrop() {
      if (over) return;
      while (!collides(piece, px, py + 1)) { py++; score += 2; }
      lock(); draw();
    }

    api.onKey((e) => {
      const k = e.key;
      if (k === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (k === 'ArrowRight') { e.preventDefault(); move(1); }
      else if (k === 'ArrowUp' || k === 'x') { e.preventDefault(); rotate(); }
      else if (k === 'ArrowDown') { e.preventDefault(); softDrop(); }
      else if (k === ' ') { e.preventDefault(); hardDrop(); }
    });

    // 画面下の操作ボタン（スマホではこちらが主役）
    const padStyle = 'padding:13px 0;border-radius:11px;border:1px solid var(--line);background:var(--panel);'
      + 'color:var(--ink);font:inherit;font-size:19px;cursor:pointer;user-select:none';
    const pad = api.el('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:min(88vw,340px)' });
    for (const [label, fn] of [['◀', () => move(-1)], ['↻', rotate], ['▶', () => move(1)], ['⤓', hardDrop]]) {
      const b = api.el('button', { style: padStyle }, label);
      // 押しっぱなしで連続移動できるようにする
      let rep = null;
      const start = (e) => { e.preventDefault(); fn(); if (label !== '⤓' && label !== '↻') rep = setInterval(fn, 110); };
      const stop = () => { clearInterval(rep); rep = null; };
      b.addEventListener('pointerdown', start);
      b.addEventListener('pointerup', stop);
      b.addEventListener('pointerleave', stop);
      b.addEventListener('pointercancel', stop);
      pad.append(b);
    }
    api.add(pad);
    api.buttons([{ label: 'はじめから', onClick: reset, primary: true }]);
    api.note('◀▶で移動、↻で回転、⤓で一気に落とす。キーボードは矢印キーとスペース');

    // --- 描画 ----------------------------------------------------------
    function cellRect(c, x, y, s, g) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.roundRect(x * s + g, y * s + g, s - g * 2, s - g * 2, s * 0.18); ctx.fill();
    }

    function draw() {
      ctx.fillStyle = '#12141c'; ctx.fillRect(0, 0, cv.width, cv.height);
      // うっすら格子
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (let i = 1; i < W; i++) { ctx.beginPath(); ctx.moveTo(i * S, 0); ctx.lineTo(i * S, cv.height); ctx.stroke(); }
      for (let i = 1; i < H; i++) { ctx.beginPath(); ctx.moveTo(0, i * S); ctx.lineTo(cv.width, i * S); ctx.stroke(); }

      for (let i = 0; i < W * H; i++) if (board[i]) cellRect(board[i], i % W, (i / W) | 0, S, 2);

      if (piece && !over) {
        // 落下位置の目印
        let gy = py;
        while (!collides(piece, px, gy + 1)) gy++;
        ctx.globalAlpha = 0.22;
        for (const [x, y] of piece.cells) if (gy + y >= 0) cellRect(piece.c, px + x, gy + y, S, 3);
        ctx.globalAlpha = 1;
        for (const [x, y] of piece.cells) if (py + y >= 0) cellRect(piece.c, px + x, py + y, S, 2);
      }
      api.hud({ 'スコア': score, '列': lines, 'Lv': level });
    }

    function drawNext() {
      nctx.fillStyle = '#12141c'; nctx.fillRect(0, 0, 120, 120);
      const s = 26;
      const xs = next.cells.map((c) => c[0]), ys = next.cells.map((c) => c[1]);
      const ox = (120 - (Math.max(...xs) - Math.min(...xs) + 1) * s) / 2 - Math.min(...xs) * s;
      const oy = (120 - (Math.max(...ys) - Math.min(...ys) + 1) * s) / 2 - Math.min(...ys) * s;
      nctx.fillStyle = next.c;
      for (const [x, y] of next.cells) {
        nctx.beginPath(); nctx.roundRect(ox + x * s + 2, oy + y * s + 2, s - 4, s - 4, 5); nctx.fill();
      }
    }

    // --- ループ ---------------------------------------------------------
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (over || paused) { last = t; return; }
      if (!last) last = t;
      acc += t - last; last = t;
      if (acc >= dropMs) {
        acc = 0;
        if (collides(piece, px, py + 1)) lock(); else py++;
        draw();
      }
    }

    function reset() {
      board = new Array(W * H).fill(null);
      score = 0; lines = 0; level = 1; dropMs = 620; acc = 0; last = 0;
      over = false; paused = false;
      next = newPiece(); spawn(); draw();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }

    reset();
    return () => cancelAnimationFrame(raf);
  },
};
