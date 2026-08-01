// ブロック崩し — バーを動かしてボールを打ち返し、全5面をクリアする。

const WIDTH = 600;
const HEIGHT = 760;
const MAX_STAGE = 5;
const BALL_RADIUS = 9;
const PADDLE_Y = 700;
const PADDLE_WIDTH = 116;
const PADDLE_HEIGHT = 18;
const BASE_SPEED = 345;

export default {
  mount(root, api) {
    const canvas = api.el('canvas', {
      class: 'board',
      width: WIDTH,
      height: HEIGHT,
      role: 'application',
      tabindex: '0',
      'aria-label': 'ブロック崩し。画面を横にドラッグしてバーを動かします',
      style: 'width:min(92vw,400px);height:auto;background:var(--panel);'
        + 'border:1px solid var(--line);border-radius:12px;cursor:ew-resize;touch-action:none',
    });
    api.add(canvas);
    api.note('画面を左右にドラッグしてバーを操作。タップで発射します。キーボードは← →、発射はスペース');
    const buttonBar = api.buttons([
      { label: '発射', onClick: launch, primary: true },
      { label: 'はじめから', onClick: reset },
    ]);
    const launchButton = buttonBar.querySelector('button');
    const ctx = canvas.getContext('2d');

    const computed = getComputedStyle(root);
    const colors = {
      ink: computed.getPropertyValue('--ink').trim(),
      sub: computed.getPropertyValue('--sub').trim(),
      line: computed.getPropertyValue('--line').trim(),
      panel: computed.getPropertyValue('--panel').trim(),
      accent: computed.getPropertyValue('--accent').trim(),
      good: computed.getPropertyValue('--good').trim(),
      bad: computed.getPropertyValue('--bad').trim(),
    };
    const brickColors = [colors.accent, colors.good, colors.bad, colors.sub, colors.ink];

    let paddleX = 0;
    let ball = null;
    let bricks = [];
    let stage = 1;
    let lives = 3;
    let score = 0;
    let speed = BASE_SPEED;
    let waiting = true;
    let done = false;
    let disposed = false;
    let rafId = 0;
    let lastTime = 0;
    let activePointer = null;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function updateHud() {
      api.hud({
        'スコア': score,
        '面': `${stage}/${MAX_STAGE}`,
        '残機': lives,
        '状態': done ? '終了' : waiting ? '発射待ち' : 'プレイ中',
      });
      launchButton.disabled = done || !waiting;
      launchButton.style.opacity = launchButton.disabled ? '.45' : '1';
      launchButton.style.cursor = launchButton.disabled ? 'default' : 'pointer';
    }

    function makeBricks() {
      const columns = 7;
      const rows = [4, 5, 5, 6, 6][stage - 1];
      const gap = 7;
      const margin = 28;
      const height = 28;
      const width = (WIDTH - margin * 2 - gap * (columns - 1)) / columns;
      bricks = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          bricks.push({
            x: margin + col * (width + gap),
            y: 65 + row * (height + gap),
            width,
            height,
            color: brickColors[(row + stage - 1) % brickColors.length],
            alive: true,
          });
        }
      }
    }

    function resetBall() {
      waiting = true;
      ball = {
        x: paddleX + PADDLE_WIDTH / 2,
        y: PADDLE_Y - BALL_RADIUS - 2,
        vx: 0,
        vy: 0,
      };
    }

    function launch() {
      if (done || !waiting) return;
      waiting = false;
      const direction = api.rand(2) ? 1 : -1;
      ball.vx = speed * 0.34 * direction;
      ball.vy = -Math.sqrt(speed * speed - ball.vx * ball.vx);
      lastTime = 0;
      updateHud();
      api.sound('move');
    }

    function movePaddle(centerX) {
      paddleX = clamp(centerX - PADDLE_WIDTH / 2, 0, WIDTH - PADDLE_WIDTH);
      if (waiting && ball) {
        ball.x = paddleX + PADDLE_WIDTH / 2;
        ball.y = PADDLE_Y - BALL_RADIUS - 2;
      }
      draw();
    }

    function canvasX(event) {
      const rect = canvas.getBoundingClientRect();
      return (event.clientX - rect.left) * WIDTH / rect.width;
    }

    function onPointerDown(event) {
      if (done) return;
      event.preventDefault();
      activePointer = event.pointerId;
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
      movePaddle(canvasX(event));
      if (waiting) launch();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointer || done) return;
      event.preventDefault();
      movePaddle(canvasX(event));
    }

    function endPointer(event) {
      if (event.pointerId !== activePointer) return;
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      activePointer = null;
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    api.onKey((event) => {
      if (done) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        movePaddle(paddleX + PADDLE_WIDTH / 2 - 34);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        movePaddle(paddleX + PADDLE_WIDTH / 2 + 34);
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        launch();
      }
    });

    function drawBrick(brick) {
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = colors.panel;
      ctx.lineWidth = 2;
      ctx.strokeRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4);
      ctx.globalAlpha = 1;
    }

    function draw() {
      ctx.fillStyle = colors.panel;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      for (let y = 340; y < PADDLE_Y; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const brick of bricks) if (brick.alive) drawBrick(brick);

      ctx.fillStyle = colors.accent;
      ctx.fillRect(paddleX, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillStyle = colors.panel;
      ctx.fillRect(paddleX + PADDLE_WIDTH / 2 - 3, PADDLE_Y + 3, 6, PADDLE_HEIGHT - 6);

      if (ball) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = colors.ink;
        ctx.fill();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (waiting && !done) {
        ctx.fillStyle = colors.sub;
        ctx.font = '600 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('タップで発射', WIDTH / 2, 620);
      }
    }

    function bounceFromPaddle() {
      // 中央からの距離を反射角に変換し、端ほど横向きに飛ばす。
      const offset = clamp((ball.x - (paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2), -1, 1);
      const angle = offset * Math.PI * 0.36;
      ball.vx = speed * Math.sin(angle);
      ball.vy = -speed * Math.cos(angle);
      ball.y = PADDLE_Y - BALL_RADIUS;
      api.sound('tap');
    }

    function hitBrick(brick, previousX, previousY) {
      const nearestX = clamp(ball.x, brick.x, brick.x + brick.width);
      const nearestY = clamp(ball.y, brick.y, brick.y + brick.height);
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) return false;

      if (previousY + BALL_RADIUS <= brick.y) {
        ball.y = brick.y - BALL_RADIUS;
        ball.vy = -Math.abs(ball.vy);
      } else if (previousY - BALL_RADIUS >= brick.y + brick.height) {
        ball.y = brick.y + brick.height + BALL_RADIUS;
        ball.vy = Math.abs(ball.vy);
      } else if (previousX + BALL_RADIUS <= brick.x) {
        ball.x = brick.x - BALL_RADIUS;
        ball.vx = -Math.abs(ball.vx);
      } else if (previousX - BALL_RADIUS >= brick.x + brick.width) {
        ball.x = brick.x + brick.width + BALL_RADIUS;
        ball.vx = Math.abs(ball.vx);
      } else if (Math.abs(dx) > Math.abs(dy)) {
        ball.vx = -ball.vx;
      } else {
        ball.vy = -ball.vy;
      }
      return true;
    }

    function finishWin() {
      done = true;
      waiting = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
      updateHud();
      draw();
      api.win(score, `全${MAX_STAGE}面クリア・残機${lives}`);
    }

    function advanceStage() {
      score += stage * 100;
      if (stage >= MAX_STAGE) {
        finishWin();
        return;
      }
      stage++;
      speed = BASE_SPEED * (1 + (stage - 1) * 0.09);
      makeBricks();
      resetBall();
      updateHud();
      api.sound('win');
    }

    function loseBall() {
      lives--;
      if (lives <= 0) {
        done = true;
        waiting = false;
        cancelAnimationFrame(rafId);
        rafId = 0;
        updateHud();
        draw();
        api.lose(score, `${stage}面・残機なし`);
        return;
      }
      resetBall();
      updateHud();
      api.sound('bad');
    }

    function moveBall(seconds) {
      const previousX = ball.x;
      const previousY = ball.y;
      ball.x += ball.vx * seconds;
      ball.y += ball.vy * seconds;

      if (ball.x - BALL_RADIUS <= 0 && ball.vx < 0) {
        ball.x = BALL_RADIUS;
        ball.vx = -ball.vx;
      } else if (ball.x + BALL_RADIUS >= WIDTH && ball.vx > 0) {
        ball.x = WIDTH - BALL_RADIUS;
        ball.vx = -ball.vx;
      }
      if (ball.y - BALL_RADIUS <= 0 && ball.vy < 0) {
        ball.y = BALL_RADIUS;
        ball.vy = -ball.vy;
      }

      if (ball.vy > 0
          && ball.x + BALL_RADIUS >= paddleX
          && ball.x - BALL_RADIUS <= paddleX + PADDLE_WIDTH
          && ball.y + BALL_RADIUS >= PADDLE_Y
          && ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT) {
        bounceFromPaddle();
      }

      for (const brick of bricks) {
        if (!brick.alive || !hitBrick(brick, previousX, previousY)) continue;
        brick.alive = false;
        score += 10 * stage;
        api.sound('move');
        updateHud();
        if (!bricks.some((item) => item.alive)) advanceStage();
        break;
      }

      if (!done && !waiting && ball.y - BALL_RADIUS > HEIGHT) loseBall();
    }

    function update(seconds) {
      // 小刻みに進めて、高速な面でもブロックやバーのすり抜けを防ぐ。
      const steps = Math.max(1, Math.ceil(speed * seconds / (BALL_RADIUS * 0.75)));
      const slice = seconds / steps;
      for (let i = 0; i < steps && !done && !waiting; i++) moveBall(slice);
    }

    function loop(time) {
      if (disposed || done) return;
      if (!lastTime) lastTime = time;
      const seconds = Math.min((time - lastTime) / 1000, 1 / 30);
      lastTime = time;
      if (!waiting) update(seconds);
      draw();
      if (!disposed && !done) rafId = requestAnimationFrame(loop);
    }

    function reset() {
      cancelAnimationFrame(rafId);
      stage = 1;
      lives = 3;
      score = 0;
      speed = BASE_SPEED;
      done = false;
      paddleX = (WIDTH - PADDLE_WIDTH) / 2;
      makeBricks();
      resetBall();
      lastTime = 0;
      updateHud();
      draw();
      rafId = requestAnimationFrame(loop);
    }

    reset();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
    };
  },
};
