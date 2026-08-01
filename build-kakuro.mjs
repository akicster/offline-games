// カックロの問題を事前に作ってデータ化する。
//
// なぜ事前に作るか:
//   唯一解の問題を見つけるには何度も作り直す必要があり、8×8では1問あたり数秒かかる。
//   遊ぶたびに端末で探させると待たされるので、ここで作って同梱する。
//   作った問題はすべて「解が1通り」であることを確認済み。
//
// 使い方: node build-kakuro.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, blocksOf, countSolutions, BLACK } from './lib/kakuro.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLAN = [
  { W: 6, H: 6, n: 20, level: 1, maxSec: 200 },
  { W: 7, H: 7, n: 10, level: 2, maxSec: 280 },
];
// 8×8 は解の個数を数える探索が重く、1問あたり数十秒かかることがあるため見送った。
// より良い解法器（ブロック単位の枝刈り）を入れてから追加する。

const out = [];
let seed = 20260801;

for (const p of PLAN) {
  let made = 0, guard = 0;
  const t0 = Date.now();
  while (made < p.n && guard < 100000 && (Date.now() - t0) / 1000 < p.maxSec) {
    guard++;
    seed += 104729;
    const g = generate({ W: p.W, H: p.H, seed, tries: 120 });
    if (!g) continue;

    // 生成器とは別経路でもう一度、解が厳密に1通りであることを確認する
    const b = blocksOf(g.grid, g.W, g.H);
    for (const blk of [...b.rows, ...b.cols]) blk.sum = blk.cells.reduce((a, c) => a + g.solution[c], 0);
    if (countSolutions(g.grid, g.W, g.H, b, 3) !== 1) continue;

    // 盤面を短い文字列にする: 黒は '#'、白は答えの数字
    const cells = [];
    for (let i = 0; i < g.W * g.H; i++) cells.push(g.grid[i] === BLACK ? '#' : String(g.solution[i]));
    out.push({ w: g.W, h: g.H, lv: p.level, s: cells.join('') });
    made++;
  }
  console.log(`${p.W}x${p.H}: ${made}/${p.n}問（${Math.round((Date.now() - t0) / 1000)}秒）`);
  writeOut();
}

function writeOut() {
  const body = `// 自動生成。直接編集しないこと（node build-kakuro.mjs で再生成）
// すべて「解がちょうど1通り」であることを確認済みの問題です。
// s は盤面を1文字ずつ並べたもの。'#' が黒マス、数字が答えです。
export const PUZZLES = ${JSON.stringify(out)};
`;
  fs.writeFileSync(path.join(ROOT, 'lib', 'kakuro-data.js'), body, 'utf8');
}
writeOut();
console.log(`lib/kakuro-data.js に ${out.length}問 を書き出しました`);
