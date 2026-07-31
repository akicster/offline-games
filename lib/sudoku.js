// ナンプレ（ナンバープレース）のソルバ・ジェネレータ（ブラウザ用・依存なし）
//
// 保証すること:
//   - 解がちょうど1通りであること（機械的に検証）
//   - 「裸のシングル」「隠れシングル」だけで最後まで解けること（当てずっぽう不要）
//
// ※「数独」は株式会社ニコリの登録商標のため、名称には使わないこと。

const SHAPES = {
  4: { bw: 2, bh: 2 },
  6: { bw: 3, bh: 2 },
  9: { bw: 3, bh: 3 },
};

function shapeOf(N) {
  const s = SHAPES[N];
  if (!s) throw new Error(`未対応の盤面サイズ: ${N}`);
  return s;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 各マスについて、同じ行・列・ブロックのマス番号を先に作っておく
const peerCache = new Map();
function peersOf(N) {
  if (peerCache.has(N)) return peerCache.get(N);
  const { bw, bh } = shapeOf(N);
  const peers = [];
  for (let i = 0; i < N * N; i++) {
    const r = (i / N) | 0, c = i % N;
    const set = new Set();
    for (let k = 0; k < N; k++) { set.add(r * N + k); set.add(k * N + c); }
    const br = Math.floor(r / bh) * bh, bc = Math.floor(c / bw) * bw;
    for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) set.add((br + dr) * N + bc + dc);
    set.delete(i);
    peers.push([...set]);
  }
  peerCache.set(N, peers);
  return peers;
}

const unitCache = new Map();
function unitsOf(N) {
  if (unitCache.has(N)) return unitCache.get(N);
  const { bw, bh } = shapeOf(N);
  const units = [];
  for (let r = 0; r < N; r++) units.push([...Array(N)].map((_, c) => r * N + c));
  for (let c = 0; c < N; c++) units.push([...Array(N)].map((_, r) => r * N + c));
  for (let br = 0; br < N; br += bh) for (let bc = 0; bc < N; bc += bw) {
    const u = [];
    for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) u.push((br + dr) * N + bc + dc);
    units.push(u);
  }
  unitCache.set(N, units);
  return units;
}

function canPlace(grid, peers, i, v) {
  for (const p of peers[i]) if (grid[p] === v) return false;
  return true;
}

// 解を最大 limit 個まで数える
export function solve(grid, N, limit = 2, randomize = false) {
  const peers = peersOf(N);
  const g = grid.slice();
  const solutions = [];

  const dfs = () => {
    if (solutions.length >= limit) return;
    let best = -1, bestCands = null;
    for (let i = 0; i < N * N; i++) {
      if (g[i] !== 0) continue;
      const cands = [];
      for (let v = 1; v <= N; v++) if (canPlace(g, peers, i, v)) cands.push(v);
      if (cands.length === 0) return;
      if (bestCands === null || cands.length < bestCands.length) {
        best = i; bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (best === -1) { solutions.push(g.slice()); return; }
    for (const v of (randomize ? shuffled(bestCands) : bestCands)) {
      g[best] = v;
      dfs();
      g[best] = 0;
      if (solutions.length >= limit) return;
    }
  };

  dfs();
  return { count: solutions.length, solutions };
}

// 人間の手筋（裸のシングル・隠れシングル）だけで解けるか
export function logicSolve(puzzle, N) {
  const peers = peersOf(N);
  const units = unitsOf(N);
  const g = puzzle.slice();
  let usedT2 = 0, steps = 0, progress = true;

  while (progress) {
    progress = false;
    // 裸のシングル: そのマスに入る数字が1つしかない
    for (let i = 0; i < N * N; i++) {
      if (g[i] !== 0) continue;
      let only = 0, n = 0;
      for (let v = 1; v <= N && n < 2; v++) if (canPlace(g, peers, i, v)) { only = v; n++; }
      if (n === 0) return { solved: false, usedT2, steps };
      if (n === 1) { g[i] = only; steps++; progress = true; }
    }
    if (progress) continue;

    // 隠れシングル: その行/列/ブロックで、その数字が入れるマスが1つしかない
    for (const u of units) {
      for (let v = 1; v <= N; v++) {
        if (u.some((i) => g[i] === v)) continue;
        let spot = -1, n = 0;
        for (const i of u) {
          if (g[i] !== 0) continue;
          if (canPlace(g, peers, i, v)) { spot = i; n++; if (n > 1) break; }
        }
        if (n === 0) return { solved: false, usedT2, steps };
        if (n === 1) { g[spot] = v; steps++; usedT2++; progress = true; }
      }
      if (progress) break;
    }
  }
  return { solved: g.every((v) => v !== 0), usedT2, steps, grid: g };
}

// 1問作る（難易度が合わなければ null）
function generateOnce(N, targetLevel) {
  const full = solve(new Array(N * N).fill(0), N, 1, true);
  if (full.count === 0) return null;
  const answer = full.solutions[0];

  // 点対称に穴をあける。抜いた結果が唯一解でなければ戻す
  const puzzle = answer.slice();
  for (const i of shuffled([...Array(N * N).keys()])) {
    if (puzzle[i] === 0) continue;
    const j = N * N - 1 - i;
    const removed = (j !== i && puzzle[j] !== 0) ? [i, j] : [i];
    const backup = removed.map((k) => puzzle[k]);
    for (const k of removed) puzzle[k] = 0;
    if (solve(puzzle, N, 2).count !== 1) removed.forEach((k, x) => { puzzle[k] = backup[x]; });
  }

  const logic = logicSolve(puzzle, N);
  if (!logic.solved) return null;   // 当てずっぽうが要る問題は出さない

  const t2 = logic.usedT2;
  let level;
  if (t2 === 0) level = 1;
  else if (t2 <= N * 0.6) level = 2;
  else if (t2 <= N * 1.4) level = 3;
  else if (t2 <= N * 2.5) level = 4;
  else level = 5;

  if (targetLevel != null && level !== targetLevel) return null;
  return { N, puzzle, answer, level, givens: puzzle.filter((v) => v) .length };
}

/** 指定難易度で1問作る。作れなければ難易度を妥協して必ず1問返す */
export function generate(N, level, tries = 400) {
  for (let t = 0; t < tries; t++) {
    const p = generateOnce(N, level);
    if (p) return p;
  }
  for (let t = 0; t < 60; t++) {
    const p = generateOnce(N, null);
    if (p) return p;
  }
  return null;
}

export { shapeOf };
