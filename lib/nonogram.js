// お絵かきロジック（ノノグラム）の生成と検証
//
// 保証すること:
//   1. 唯一解        … 手掛かりから決まる絵がちょうど1通り
//   2. 当てずっぽう不要 … 行と列を1本ずつ見ていく手筋だけで最後まで埋まる
//
// 市販・無料を問わず、この2つを保証していない自動生成のノノグラムは多い。
// 「解が2通りある」「どこかで当てずっぽうしないと進めない」問題が混ざる。
// ここでは行・列ごとの全配置を突き合わせる解法器を書き、それで検証してから出す。

const UNKNOWN = -1, EMPTY = 0, FILL = 1;

/** 1行ぶんの塗り方から手掛かり（連続する塗りの長さの並び）を作る */
export function clueOf(line) {
  const out = [];
  let run = 0;
  for (const v of line) {
    if (v === FILL) run++;
    else { if (run) out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

/**
 * 1行を可能な限り確定させる。
 * その行の手掛かりを満たす並べ方をすべて数え上げ、
 * 「どの並べ方でも塗り」なら塗り、「どの並べ方でも空き」なら空きに確定する。
 * 戻り値: 更新後の行 / 矛盾していれば null
 */
export function solveLine(cells, clue) {
  const n = cells.length;
  const runs = clue[0] === 0 ? [] : clue;
  const canFill = new Array(n).fill(false);
  const canEmpty = new Array(n).fill(false);
  let found = 0;

  // pos から先に、runs[ri] 以降を並べていく
  const place = (pos, ri, acc) => {
    if (found > 200000) return;                 // 念のための打ち切り
    if (ri === runs.length) {
      for (let i = pos; i < n; i++) {
        if (cells[i] === FILL) return;          // 残りは全部空きになるので矛盾
        acc[i] = EMPTY;
      }
      found++;
      for (let i = 0; i < n; i++) (acc[i] === FILL ? canFill : canEmpty)[i] = true;
      return;
    }
    const len = runs[ri];
    // 残りの塗りと最低限の隙間が入るか
    let need = 0;
    for (let k = ri; k < runs.length; k++) need += runs[k] + (k > ri ? 1 : 0);

    for (let s = pos; s + need <= n; s++) {
      // s の手前は空き
      let ok = true;
      for (let i = pos; i < s; i++) { if (cells[i] === FILL) { ok = false; break; } acc[i] = EMPTY; }
      if (!ok) break;                            // ここより後ろへずらしても塗りを飛ばせない
      // s から len マスを塗る
      for (let i = s; i < s + len; i++) { if (cells[i] === EMPTY) { ok = false; break; } acc[i] = FILL; }
      if (!ok) continue;
      // 塗りの直後は空き（末尾なら不要）
      let next = s + len;
      if (next < n) {
        if (cells[next] === FILL) continue;
        acc[next] = EMPTY;
        next++;
      }
      place(next, ri + 1, acc);
    }
  };

  place(0, 0, new Array(n).fill(EMPTY));
  if (found === 0) return null;                  // 手掛かりを満たす並べ方がない

  const out = cells.slice();
  for (let i = 0; i < n; i++) {
    if (canFill[i] && !canEmpty[i]) out[i] = FILL;
    else if (!canFill[i] && canEmpty[i]) out[i] = EMPTY;
  }
  return out;
}

/**
 * 行と列を交互に確定させていく。
 * 戻り値: { solved: 全部埋まったか, grid, steps }
 */
export function logicSolve(W, H, rowClues, colClues) {
  const g = new Array(W * H).fill(UNKNOWN);
  let steps = 0, progress = true;

  while (progress) {
    progress = false;

    for (let r = 0; r < H; r++) {
      const line = g.slice(r * W, r * W + W);
      const res = solveLine(line, rowClues[r]);
      if (!res) return { solved: false, grid: g, steps, contradiction: true };
      for (let c = 0; c < W; c++) {
        if (g[r * W + c] !== res[c]) { g[r * W + c] = res[c]; progress = true; steps++; }
      }
    }

    for (let c = 0; c < W; c++) {
      const line = [];
      for (let r = 0; r < H; r++) line.push(g[r * W + c]);
      const res = solveLine(line, colClues[c]);
      if (!res) return { solved: false, grid: g, steps, contradiction: true };
      for (let r = 0; r < H; r++) {
        if (g[r * W + c] !== res[r]) { g[r * W + c] = res[r]; progress = true; steps++; }
      }
    }
  }

  return { solved: g.every((v) => v !== UNKNOWN), grid: g, steps };
}

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/**
 * まとまりのある絵を作る。
 * 完全な乱数だと点々になって絵として面白くなく、解けもしないので、
 * 周囲の状態に合わせて均す処理（ならし）を数回かけて塊を作る。
 */
function makePicture(rng, W, H, density) {
  let g = new Array(W * H).fill(0).map(() => (rng() < density ? 1 : 0));
  for (let pass = 0; pass < 2; pass++) {
    const next = g.slice();
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        let n = 0, t = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue;
            t++; n += g[rr * W + cc];
          }
        }
        next[r * W + c] = n * 2 > t ? 1 : (n * 2 < t ? 0 : g[r * W + c]);
      }
    }
    g = next;
  }
  return g;
}

/**
 * 1問作る。唯一解かつ手筋だけで解けるものだけを返す。
 * 見つからなければ null。
 */
export function generate({ W = 10, H = 10, seed = 1, tries = 400 } = {}) {
  const rng = makeRng(seed);
  for (let t = 0; t < tries; t++) {
    const density = 0.45 + rng() * 0.18;
    const pic = makePicture(rng, W, H, density);

    const filled = pic.reduce((a, b) => a + b, 0);
    if (filled < W * H * 0.25 || filled > W * H * 0.75) continue;   // 極端な絵は避ける
    // 何も塗られていない行や列だらけだと面白くない
    let blankLines = 0;
    for (let r = 0; r < H; r++) if (!pic.slice(r * W, r * W + W).some((v) => v)) blankLines++;
    for (let c = 0; c < W; c++) { let any = false; for (let r = 0; r < H; r++) if (pic[r * W + c]) any = true; if (!any) blankLines++; }
    if (blankLines > (W + H) * 0.2) continue;

    const rowClues = [];
    for (let r = 0; r < H; r++) rowClues.push(clueOf(pic.slice(r * W, r * W + W)));
    const colClues = [];
    for (let c = 0; c < W; c++) { const col = []; for (let r = 0; r < H; r++) col.push(pic[r * W + c]); colClues.push(clueOf(col)); }

    const res = logicSolve(W, H, rowClues, colClues);
    if (!res.solved) continue;                       // 当てずっぽうが要る問題は出さない
    // 手筋だけで一意に埋まった = 解は1通りしかない
    for (let i = 0; i < W * H; i++) if (res.grid[i] !== pic[i]) { return null; }

    return { W, H, seed, picture: pic, rowClues, colClues, steps: res.steps };
  }
  return null;
}

export { UNKNOWN, EMPTY, FILL };
