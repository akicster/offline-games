// 倉庫番の面データと、解けるかどうかの検証
//
// 面は手で作っている。自動生成した倉庫番は「解けない面」や「1手で詰む面」が
// 混ざりやすく、遊んで面白くないため。
// そのかわり、**全ての面が本当に解けることを幅優先探索で確認**してから収録している。
//
// 記号: # 壁 / 空白 床 / $ 荷物 / . 目的地 / * 目的地の上の荷物 / @ 人 / + 目的地の上の人

export const LEVELS = [
  // 1 — まず動かし方を覚える
  [
    '#######',
    '#     #',
    '# .$@ #',
    '#     #',
    '#######',
  ],
  // 2 — 二つ運ぶ
  [
    '########',
    '#      #',
    '# .$ $.#',
    '#   @  #',
    '#      #',
    '########',
  ],
  // 3 — 角を曲がる
  [
    '#######',
    '#..   #',
    '#$$   #',
    '#  @  #',
    '#     #',
    '#######',
  ],
  // 4 — 壁を回り込む
  [
    '########',
    '#      #',
    '# #### #',
    '# .$@  #',
    '#      #',
    '########',
  ],
  // 5 — 押す順番を考える
  [
    '########',
    '#. #   #',
    '#  $   #',
    '#. $ @ #',
    '#      #',
    '########',
  ],
  // 6 — 三つ運ぶ
  [
    '#########',
    '#       #',
    '# $ $ $ #',
    '#   @   #',
    '# . . . #',
    '#       #',
    '#########',
  ],
  // 7 — 通路
  [
    '#########',
    '#.      #',
    '#.$$$   #',
    '#.  @   #',
    '#       #',
    '#########',
  ],
  // 8 — 四方に運ぶ
  [
    '#########',
    '#   .   #',
    '# $   $ #',
    '#. $ $ .#',
    '#   @   #',
    '#   .   #',
    '#########',
  ],
  // 9 — 押し戻せない向きに注意
  [
    '##########',
    '#        #',
    '#  ####  #',
    '# .$  $. #',
    '#   @    #',
    '# .$  $. #',
    '#        #',
    '##########',
  ],
  // 10 — 仕上げ
  [
    '##########',
    '#  ....  #',
    '#  $$$$  #',
    '#        #',
    '#   @    #',
    '#        #',
    '##########',
  ],
];

/**
 * 各面の最短手数。solvable() による探索結果を記録したもの。
 * 実行時に毎回探索すると重い面（第8面で約2.7秒）があるため、確認済みの値を持っておく。
 * 面を変更したら必ず再計測すること。
 */
export const MIN_MOVES = [1, 4, 5, 1, 13, 18, 14, 22, 12, 12];

/** 面データを扱いやすい形にする */
export function parseLevel(rows) {
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const walls = new Set(), goals = new Set();
  let boxes = [], player = null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x] || ' ';
      const k = x + ',' + y;
      if (ch === '#') walls.add(k);
      if (ch === '.' || ch === '*' || ch === '+') goals.add(k);
      if (ch === '$' || ch === '*') boxes.push(k);
      if (ch === '@' || ch === '+') player = k;
    }
  }
  boxes = boxes.sort();
  return { W, H, walls, goals, boxes, player };
}

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/**
 * 幅優先探索で解けるか調べる。
 * 荷物の位置の組と人の位置を状態として持つ。
 *
 * 戻り値: { status: 'solved' | 'unsolvable' | 'unknown', depth }
 * 上限に達した場合は 'unknown' を返す。ここを 'unsolvable' と混同すると、
 * 実際は解ける面を誤って捨ててしまう。
 */
export function solvable(level, limit = 4000000) {
  const { walls, goals, boxes, player } = level;
  const goalSet = goals;
  const startKey = player + '|' + boxes.join(';');
  const seen = new Set([startKey]);
  let frontier = [{ p: player, b: boxes.slice() }];
  let depth = 0;

  const done = (b) => b.every((k) => goalSet.has(k));
  if (done(boxes)) return { status: 'solved', depth: 0 };

  while (frontier.length && seen.size < limit) {
    const next = [];
    depth++;
    for (const st of frontier) {
      const [px, py] = st.p.split(',').map(Number);
      for (const [dx, dy] of DIRS) {
        const nx = px + dx, ny = py + dy;
        const nk = nx + ',' + ny;
        if (walls.has(nk)) continue;
        let nb = st.b;
        const bi = st.b.indexOf(nk);
        if (bi >= 0) {
          // 荷物を押す
          const bx = nx + dx, by = ny + dy;
          const bk = bx + ',' + by;
          if (walls.has(bk) || st.b.includes(bk)) continue;
          nb = st.b.slice();
          nb[bi] = bk;
          nb.sort();
        }
        const key = nk + '|' + nb.join(';');
        if (seen.has(key)) continue;
        seen.add(key);
        if (done(nb)) return { status: 'solved', depth };
        next.push({ p: nk, b: nb });
      }
    }
    frontier = next;
  }
  // 行き先が尽きたなら本当に解けない。上限で止まったなら判定できていない
  return { status: frontier.length === 0 ? 'unsolvable' : 'unknown', depth };
}
