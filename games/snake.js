// スネーク — エサを食べて伸びる。壁と自分の体が禁物。
//
// 【ゲーム実装のお手本 その3: ゲームループ・canvas 描画・後始末】
// ループを回すゲームは、mount の戻り値で必ずタイマーを止めること。
// これを忘れると一覧に戻ってもゲームが裏で動き続ける。

const N = 17;          // 盤面のマス数
const START_MS = 190;  // 初速（1マス進むのにかかる時間）
const MIN_MS = 80;

export default {
  mount(root, api) {
    const cv = api.el('canvas', { class: 'board', width: 680, height: 680,
      style: 'width:min(88vw,360px);height:auto;background:#191b24;border-radius:12px' });
    api.add(cv);
    api.note('スワイプ、または矢印キーで曲がります');

    const ctx = cv.getContext('2d');
    const S = cv.width / N;

    let snake, dir, nextDir, food, score, alive, timer, ms;

    function place() {
      let p;
      do { p = { x: api.rand(N), y: api.rand(N) }; }
      while (snake.some((s) => s.x === p.x && s.y === p.y));
      food = p;
    }

    function draw() {
      ctx.fillStyle = '#191b24';
      ctx.fillRect(0, 0, cv.width, cv.height);

      // エサ
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc((food.x + 0.5) * S, (food.y + 0.5) * S, S * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // 体（頭ほど明るく）
      for (let i = snake.length - 1; i >= 0; i--) {
        const t = 1 - i / (snake.length + 4);
        ctx.fillStyle = i === 0 ? '#8fd6ff' : `rgba(108,140,255,${0.35 + t * 0.55})`;
        const s = snake[i];
        const pad = i === 0 ? S * 0.06 : S * 0.12;
        ctx.beginPath();
        ctx.roundRect(s.x * S + pad, s.y * S + pad, S - pad * 2, S - pad * 2, S * 0.25);
        ctx.fill();
      }
      api.hud({ 'スコア': score, '最高': api.best() ?? 0 });
    }

    function step() {
      if (!alive) return;
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      const hitWall = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N;
      const hitSelf = snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) {
        alive = false;
        clearInterval(timer);
        api.lose(score);
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++;
        api.sound('good');
        place();
        // 食べるたび少しずつ速くする
        ms = Math.max(MIN_MS, ms - 4);
        clearInterval(timer);
        timer = setInterval(step, ms);
      } else {
        snake.pop();
      }
      draw();
    }

    function turn(d) {
      const v = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d];
      if (!v) return;
      // 真後ろへは曲がれない
      if (v.x === -dir.x && v.y === -dir.y) return;
      nextDir = v;
    }

    function reset() {
      const mid = (N / 2) | 0;
      snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
      dir = { x: 1, y: 0 }; nextDir = dir;
      score = 0; alive = true; ms = START_MS;
      place(); draw();
      clearInterval(timer);
      timer = setInterval(step, ms);
    }

    api.onDir(turn);
    api.buttons([{ label: 'はじめから', onClick: reset, primary: true }]);
    reset();

    // 後始末: 一覧に戻ったときにループを止める
    return () => clearInterval(timer);
  },
};
