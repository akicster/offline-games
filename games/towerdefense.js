// タワーディフェンス — 道を歩いてくる敵を、置いた塔で倒す。
//
// 絵の素材は使わず、図形だけで作っている。
// 敵は決まった道を進み、最後まで通されると命が減る。
// 倒すとお金が入り、塔を建てたり強くしたりできる。

const COLS = 9, ROWS = 12;

// 道順（左上から入って右下へ抜ける）。マス座標で持つ
const PATH = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
  [7, 2], [7, 3], [7, 4],
  [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4],
  [1, 5], [1, 6], [1, 7],
  [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7],
  [7, 8], [7, 9], [7, 10],
  [6, 10], [5, 10], [4, 10], [3, 10], [2, 10], [1, 10], [0, 10],
];
const PATH_SET = new Set(PATH.map((p) => p.join(',')));

// 塔の種類。射程・攻撃力・間隔・値段が違う
const TOWERS = [
  { id: 'gun', name: '速射', cost: 40, color: '#4da3ff', range: 2.1, dmg: 6, rate: 320, desc: '安くて手数が多い' },
  { id: 'cannon', name: '重砲', cost: 90, color: '#ff8c42', range: 2.6, dmg: 34, rate: 1100, desc: '一撃が大きい' },
  { id: 'frost', name: '氷結', cost: 70, color: '#5fe0d0', range: 2.0, dmg: 3, rate: 600, slow: 0.5, desc: '当たると足が遅くなる' },
];

export default {
  mount(root, api) {
    let money, lives, wave, waveActive, enemies, towers, sel, selTower, over, raf, last, spawnQ, spawnT;
    let cellPx = 30;

    const cv = api.el('canvas', {
      class: 'board',
      style: 'width:min(92vw,380px);height:auto;background:#151821;border-radius:12px;border:1px solid var(--line);touch-action:manipulation',
    });
    cv.width = COLS * 60; cv.height = ROWS * 60;
    const ctx = cv.getContext('2d');
    api.add(cv);

    const shop = api.el('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;width:min(92vw,380px)' });
    api.add(shop);

    const info = api.el('div', { class: 'note', style: 'min-height:20px' });
    api.add(info);

    api.buttons([
      { label: '売る', onClick: sell },
      { label: '強化', onClick: upgrade },
      { label: '次の波へ', onClick: startWave, primary: true },
    ]);
    api.note('塔を選んでから、道以外のマスを押すと建てられます。建てた塔を押すと強化や売却ができます');

    // ---- 買い物パネル -------------------------------------------------
    function renderShop() {
      shop.textContent = '';
      for (const t of TOWERS) {
        const on = selTower === t.id;
        shop.append(api.el('button', {
          style: 'flex:1;min-width:96px;padding:8px 6px;border-radius:10px;font:inherit;font-size:12px;cursor:pointer;'
            + `border:2px solid ${on ? t.color : 'var(--line)'};`
            + `background:${on ? `color-mix(in srgb, ${t.color} 22%, var(--panel))` : 'var(--panel)'};`
            + `color:var(--ink);opacity:${money < t.cost ? 0.5 : 1};line-height:1.5`,
          onclick: () => { selTower = t.id; sel = null; renderShop(); info.textContent = t.desc; },
        }, api.el('div', { style: `font-weight:800;color:${t.color}` }, t.name), api.el('div', {}, `${t.cost}`)));
      }
    }

    // ---- 盤面 ---------------------------------------------------------
    const key = (x, y) => x + ',' + y;
    const towerAt = (x, y) => towers.find((t) => t.x === x && t.y === y);

    function cellFromEvent(e) {
      const b = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - b.left) / b.width * COLS);
      const y = Math.floor((e.clientY - b.top) / b.height * ROWS);
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
      return { x, y };
    }

    cv.addEventListener('click', (e) => {
      if (over) return;
      const c = cellFromEvent(e);
      if (!c) return;
      const t = towerAt(c.x, c.y);
      if (t) { sel = t; info.textContent = `${TOWERS.find((k) => k.id === t.id).name} Lv${t.lv}　強化 ${upCost(t)}／売却 ${sellPrice(t)}`; draw(); return; }
      if (PATH_SET.has(key(c.x, c.y))) { info.textContent = '道の上には建てられません'; api.sound('bad'); return; }
      const spec = TOWERS.find((k) => k.id === selTower);
      if (!spec) { info.textContent = 'まず建てる塔を選んでください'; return; }
      if (money < spec.cost) { info.textContent = 'お金が足りません'; api.sound('bad'); return; }
      money -= spec.cost;
      towers.push({ id: spec.id, x: c.x, y: c.y, lv: 1, cd: 0 });
      sel = null;
      api.sound('good');
      renderShop(); draw();
    });

    const upCost = (t) => Math.round(TOWERS.find((k) => k.id === t.id).cost * 0.8 * t.lv);
    const sellPrice = (t) => Math.round(TOWERS.find((k) => k.id === t.id).cost * (0.5 + 0.35 * (t.lv - 1)));

    function upgrade() {
      if (!sel || over) { info.textContent = '強化する塔を押して選んでください'; return; }
      const c = upCost(sel);
      if (money < c) { info.textContent = 'お金が足りません'; api.sound('bad'); return; }
      money -= c; sel.lv++;
      api.sound('good');
      info.textContent = `${TOWERS.find((k) => k.id === sel.id).name} が Lv${sel.lv} になりました`;
      renderShop(); draw();
    }

    function sell() {
      if (!sel || over) { info.textContent = '売る塔を押して選んでください'; return; }
      money += sellPrice(sel);
      towers = towers.filter((t) => t !== sel);
      sel = null;
      api.sound('move');
      renderShop(); draw();
    }

    // ---- 敵と波 -------------------------------------------------------
    function startWave() {
      if (over || waveActive) return;
      wave++;
      waveActive = true;
      const n = 6 + wave * 2;
      const hp = Math.round(20 * Math.pow(1.28, wave - 1));
      const speed = 1.6 + wave * 0.05;
      const boss = wave % 5 === 0;
      spawnQ = [];
      for (let i = 0; i < n; i++) spawnQ.push({ hp, speed, boss: false });
      if (boss) spawnQ.push({ hp: hp * 8, speed: speed * 0.7, boss: true });
      spawnT = 0;
      info.textContent = `第${wave}波${boss ? '（ボスあり）' : ''}`;
      api.sound('tap');
    }

    function step(dt) {
      // 敵を出す
      if (spawnQ.length) {
        spawnT -= dt;
        if (spawnT <= 0) {
          const e = spawnQ.shift();
          enemies.push({ ...e, maxHp: e.hp, t: 0, slow: 0 });
          spawnT = 520;
        }
      }

      // 敵を進める
      for (const e of enemies) {
        const sp = e.speed * (e.slow > 0 ? 0.45 : 1) * (dt / 1000);
        e.t += sp;
        if (e.slow > 0) e.slow -= dt;
        if (e.t >= PATH.length - 1) {
          e.dead = true;
          lives--;
          api.sound('bad');
        }
      }
      enemies = enemies.filter((e) => !e.dead && e.hp > 0);

      // 塔が撃つ
      for (const t of towers) {
        const spec = TOWERS.find((k) => k.id === t.id);
        t.cd -= dt;
        if (t.cd > 0) continue;
        const range = spec.range + (t.lv - 1) * 0.35;
        // 一番先に進んでいる敵を狙う
        let target = null;
        for (const e of enemies) {
          const p = posOf(e.t);
          const d = Math.hypot(p.x - t.x, p.y - t.y);
          if (d <= range && (!target || e.t > target.t)) target = e;
        }
        if (!target) continue;
        target.hp -= spec.dmg * (1 + (t.lv - 1) * 0.7);
        if (spec.slow) target.slow = 900;
        t.cd = spec.rate;
        t.flash = 90;
        if (target.hp <= 0) {
          money += target.boss ? 60 : 8 + Math.floor(wave * 0.8);
          api.sound('good');
        }
      }
      enemies = enemies.filter((e) => e.hp > 0);
      for (const t of towers) if (t.flash > 0) t.flash -= dt;

      if (waveActive && !spawnQ.length && !enemies.length) {
        waveActive = false;
        money += 25 + wave * 5;
        info.textContent = `第${wave}波をしのぎました。次の波へ進めます`;
        api.sound('win');
      }

      if (lives <= 0 && !over) {
        over = true;
        api.lose(wave - 1, `第${wave}波で力尽きました`);
      }
    }

    /** 道に沿った位置（tは道の何番目か。小数で途中を表す） */
    function posOf(t) {
      const i = Math.floor(t);
      const f = t - i;
      const a = PATH[Math.min(i, PATH.length - 1)];
      const b = PATH[Math.min(i + 1, PATH.length - 1)];
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
    }

    // ---- 描画 ---------------------------------------------------------
    function draw() {
      const S = cv.width / COLS;
      cellPx = S;
      ctx.fillStyle = '#151821';
      ctx.fillRect(0, 0, cv.width, cv.height);

      // 建てられるマス
      ctx.fillStyle = 'rgba(255,255,255,.03)';
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (PATH_SET.has(key(x, y))) continue;
          ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
        }
      }

      // 道
      ctx.strokeStyle = '#3a4152';
      ctx.lineWidth = S * 0.82;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      PATH.forEach(([x, y], i) => {
        const px = x * S + S / 2, py = y * S + S / 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // 入口と出口
      const st = PATH[0], en = PATH[PATH.length - 1];
      ctx.fillStyle = '#7ac943';
      ctx.fillRect(st[0] * S + S * 0.2, st[1] * S + S * 0.2, S * 0.6, S * 0.6);
      ctx.fillStyle = '#ef5350';
      ctx.fillRect(en[0] * S + S * 0.2, en[1] * S + S * 0.2, S * 0.6, S * 0.6);

      // 塔
      for (const t of towers) {
        const spec = TOWERS.find((k) => k.id === t.id);
        const cx = t.x * S + S / 2, cy = t.y * S + S / 2;
        if (t === sel) {
          ctx.fillStyle = 'rgba(255,255,255,.07)';
          ctx.beginPath();
          ctx.arc(cx, cy, (spec.range + (t.lv - 1) * 0.35) * S, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = spec.color;
        ctx.beginPath();
        ctx.roundRect(cx - S * 0.3, cy - S * 0.3, S * 0.6, S * 0.6, S * 0.12);
        ctx.fill();
        if (t.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill(); }
        // 強化段階を点で表す
        ctx.fillStyle = '#151821';
        for (let i = 0; i < Math.min(t.lv, 4); i++) {
          ctx.beginPath();
          ctx.arc(cx - S * 0.18 + i * S * 0.12, cy + S * 0.18, S * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
        if (t === sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cx - S * 0.32, cy - S * 0.32, S * 0.64, S * 0.64); }
      }

      // 敵
      for (const e of enemies) {
        const p = posOf(e.t);
        const cx = p.x * S + S / 2, cy = p.y * S + S / 2;
        const r = e.boss ? S * 0.3 : S * 0.2;
        ctx.fillStyle = e.slow > 0 ? '#7fd8ff' : (e.boss ? '#ffca3a' : '#ff6b6b');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        // 体力
        const w = S * 0.6, h = S * 0.075;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(cx - w / 2, cy - r - h * 2.2, w, h);
        ctx.fillStyle = '#7ac943';
        ctx.fillRect(cx - w / 2, cy - r - h * 2.2, w * Math.max(0, e.hp / e.maxHp), h);
      }

      api.hud({ '命': lives, '所持金': money, '波': wave });
    }

    // ---- ループ -------------------------------------------------------
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!last) last = now;
      const dt = Math.min(50, now - last);
      last = now;
      if (!over) step(dt);
      draw();
    }

    function reset() {
      money = 120; lives = 20; wave = 0; waveActive = false;
      enemies = []; towers = []; spawnQ = []; spawnT = 0;
      sel = null; selTower = TOWERS[0].id; over = false; last = 0;
      info.textContent = '塔を建てて「次の波へ」を押してください';
      renderShop(); draw();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }

    reset();
    return () => cancelAnimationFrame(raf);
  },
};
