// カックロ（数字クロスワード）の生成と検証
//
// 白マスに 1〜9 を入れる。連続する白マスの並び（=ブロック）ごとに、
// 手掛かりの数と合計が一致し、同じブロック内で同じ数字は使えない。
//
// 保証すること:
//   1. 解がちょうど1通り
//   2. 手掛かりに矛盾がない
// 自動生成のカックロは「解が複数ある」問題が混ざりやすい。ここでは
// 総当たりの解法器で解の個数を数え、1通りのものだけを採用する。

const BLACK = -1;

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const ri = (rng, n) => Math.floor(rng() * n);
function shuffle(rng, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(rng, i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/**
 * 盤の形を作る。
 * 一番上の行と一番左の列は必ず黒マス（手掛かり置き場）。
 * 長さ1のブロックは答えが一意に決まってしまい面白くないので作らない。
 */
function makeShape(rng, W, H, blackRate) {
  const g = new Array(W * H).fill(0);
  for (let x = 0; x < W; x++) g[x] = BLACK;
  for (let y = 0; y < H; y++) g[y * W] = BLACK;
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W; x++) if (rng() < blackRate) g[y * W + x] = BLACK;
  }

  // 長さ1のブロックができないように黒マスを調整する
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 1; y < H; y++) {
      for (let x = 1; x < W; x++) {
        const i = y * W + x;
        if (g[i] === BLACK) continue;
        const leftBlack = g[i - 1] === BLACK;
        const rightBlack = (x + 1 >= W) || g[i + 1] === BLACK;
        const upBlack = g[i - W] === BLACK;
        const downBlack = (y + 1 >= H) || g[i + W] === BLACK;
        if ((leftBlack && rightBlack) || (upBlack && downBlack)) g[i] = BLACK;
      }
    }
  }
  return g;
}

/** 白マスの並び（ブロック）を洗い出す */
export function blocksOf(g, W, H) {
  const rows = [], cols = [];
  for (let y = 0; y < H; y++) {
    let run = [];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (g[i] === BLACK) { if (run.length >= 2) rows.push({ cells: run, head: run[0] - 1 }); run = []; }
      else run.push(i);
    }
    if (run.length >= 2) rows.push({ cells: run, head: run[0] - 1 });
  }
  for (let x = 0; x < W; x++) {
    let run = [];
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (g[i] === BLACK) { if (run.length >= 2) cols.push({ cells: run, head: run[0] - W }); run = []; }
      else run.push(i);
    }
    if (run.length >= 2) cols.push({ cells: run, head: run[0] - W });
  }
  return { rows, cols };
}

/**
 * 解の個数を数える（limit 個で打ち切る）。
 * 白マスを1つずつ埋め、そのマスが属するブロックの制約だけを確かめる。
 */
export function countSolutions(g, W, H, blocks, limit = 2) {
  const white = [];
  for (let i = 0; i < W * H; i++) if (g[i] !== BLACK) white.push(i);

  // 各マスが属する行ブロック・列ブロックを引けるようにする
  const rowOf = new Map(), colOf = new Map();
  for (const b of blocks.rows) for (const c of b.cells) rowOf.set(c, b);
  for (const b of blocks.cols) for (const c of b.cells) colOf.set(c, b);

  const val = new Map();
  let count = 0;

  const okFor = (b, i, v) => {
    if (!b) return true;
    let sum = 0, filled = 0;
    for (const c of b.cells) {
      const x = c === i ? v : val.get(c);
      if (x === undefined) continue;
      if (c !== i && x === v) return false;      // 同じブロックに同じ数字は入れない
      sum += x; filled++;
    }
    const rest = b.cells.length - filled;
    if (sum > b.sum) return false;
    // 残りのマスに入れられる最小・最大で届くか
    const minRest = (rest * (rest + 1)) / 2;
    const maxRest = rest === 0 ? 0 : (9 + (9 - rest + 1)) * rest / 2;
    if (sum + minRest > b.sum) return false;
    if (sum + maxRest < b.sum) return false;
    if (rest === 0 && sum !== b.sum) return false;
    return true;
  };

  const rec = (k) => {
    if (count >= limit) return;
    if (k === white.length) { count++; return; }
    const i = white[k];
    for (let v = 1; v <= 9; v++) {
      if (!okFor(rowOf.get(i), i, v)) continue;
      if (!okFor(colOf.get(i), i, v)) continue;
      val.set(i, v);
      rec(k + 1);
      val.delete(i);
      if (count >= limit) return;
    }
  };

  rec(0);
  return count;
}

/** 1問作る。解が1通りのものだけを返す */
export function generate({ W = 7, H = 7, seed = 1, tries = 300 } = {}) {
  const rng = makeRng(seed);
  for (let t = 0; t < tries; t++) {
    const g = makeShape(rng, W, H, 0.22 + rng() * 0.1);
    const blocks = blocksOf(g, W, H);
    if (blocks.rows.length < 3 || blocks.cols.length < 3) continue;

    // 白マスが少なすぎる問題は解き応えがない。内側の半分以上を白にする
    const whiteCount = g.filter((v) => v !== BLACK).length;
    if (whiteCount < (W - 1) * (H - 1) * 0.45) continue;

    // まず答えを作る（各ブロックで数字が重複しないように埋める）
    const sol = g.slice();
    let ok = true;
    const white = [];
    for (let i = 0; i < W * H; i++) if (g[i] !== BLACK) white.push(i);
    const rowOf = new Map(), colOf = new Map();
    for (const b of blocks.rows) for (const c of b.cells) rowOf.set(c, b);
    for (const b of blocks.cols) for (const c of b.cells) colOf.set(c, b);

    const fill = (k) => {
      if (k === white.length) return true;
      const i = white[k];
      for (const v of shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        const rb = rowOf.get(i), cb = colOf.get(i);
        if (rb && rb.cells.some((c) => c !== i && sol[c] === v)) continue;
        if (cb && cb.cells.some((c) => c !== i && sol[c] === v)) continue;
        sol[i] = v;
        if (fill(k + 1)) return true;
        sol[i] = 0;
      }
      return false;
    };
    for (const i of white) sol[i] = 0;
    if (!fill(0)) continue;

    // 手掛かり（合計）を計算する
    for (const b of [...blocks.rows, ...blocks.cols]) {
      b.sum = b.cells.reduce((a, c) => a + sol[c], 0);
      if (b.sum < 3 || b.sum > 45) ok = false;
    }
    if (!ok) continue;

    // 解が1通りか確かめる
    if (countSolutions(g, W, H, blocks, 2) !== 1) continue;

    return { W, H, grid: g, solution: sol, blocks, seed, BLACK };
  }
  return null;
}

export { BLACK };
