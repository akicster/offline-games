// 犯人当て（ロジックパズル）の論理エンジン — ブラウザ用
//
// 目的: 「面白い推理を書く」前に、「論理として破綻していない」ことを機械で保証する。
//
// 保証すること:
//   1. 唯一解    … 提示した手掛かりから導ける犯人がちょうど1人
//   2. フェアプレイ … 解に必要な情報がすべてプレイヤーに提示されている（後出しなし）
//   3. 無矛盾    … どの手掛かりも真犯人と矛盾しない
//   4. 非自明    … どの手掛かりも1つ欠けると犯人が絞れない（無駄な手掛かりがない）
//
// LLMに「推理ものを書いて」と頼むと、ほぼ必ずこの4つのどれかが壊れる。
// 制約充足はコードで解かないと保証できない。

// ---------------------------------------------------------------------------
// 決定的乱数（seedを固定すれば同じ事件を再現できる）
// ---------------------------------------------------------------------------
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const ri = (rng, n) => Math.floor(rng() * n);
function shuffle(rng, a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = ri(rng, i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// ---------------------------------------------------------------------------
// 属性の定義
// 各属性は「犯人はこうだった」と言い切れる形の手掛かりになる
// ---------------------------------------------------------------------------
// label … 容疑者一覧に出す見出し
// tag   … 容疑者一覧に出す短い表示（プレイヤーはこれを見て手掛かりと突き合わせる）
// clue  … 手掛かりの文面
//
// 重要: 手掛かりが属性に言及する以上、各容疑者の属性は必ずプレイヤーに提示すること。
// 提示しなければ、論理的に唯一解でも人間には解けない（フェアプレイ違反になる）。
const ATTRS = [
  { key: 'hand', label: '利き手', values: ['右利き', '左利き'], tag: (v) => v,
    clue: (v) => `争ったときの傷の向きから、犯人は${v}だと分かっている。` },
  { key: 'height', label: '背格好', values: ['背の高い', '中背の', '小柄な'],
    tag: (v) => ({ '背の高い': '長身', '中背の': '中背', '小柄な': '小柄' }[v]),
    clue: (v) => `凶器が振り下ろされた角度から、犯人は${v}人物だと分かっている。` },
  { key: 'smoke', label: '煙草', values: ['煙草を吸う', '煙草を吸わない'],
    tag: (v) => (v === '煙草を吸う' ? '喫煙' : '吸わない'),
    clue: (v) => `現場に残された臭いから、犯人は${v}人物だと分かっている。` },
  { key: 'glove', label: '手元', values: ['手袋をしていた', '素手だった'],
    tag: (v) => (v === '手袋をしていた' ? '手袋' : '素手'),
    clue: (v) => `現場の指紋の状況から、犯人は${v}ことが分かっている。` },
  { key: 'key', label: '合鍵', values: ['合鍵を持っている', '合鍵を持っていない'],
    tag: (v) => (v === '合鍵を持っている' ? '合鍵あり' : '合鍵なし'),
    clue: (v) => `扉に壊された形跡がないため、犯人は${v}人物にしぼられる。` },
  { key: 'wet', label: '衣服', values: ['濡れていた', '濡れていなかった'],
    tag: (v) => (v === '濡れていた' ? '濡れていた' : '乾いていた'),
    clue: (v) => `廊下の足跡の状態から、犯人は事件当時${v}ことが分かっている。` },
  { key: 'perfume', label: '香り', values: ['香水をつけていた', 'つけていなかった'],
    tag: (v) => (v === '香水をつけていた' ? '香水あり' : '香水なし'),
    clue: (v) => `被害者の衣服に残った匂いから、犯人は${v}と考えられる。` },
];

export { ATTRS };

// ---------------------------------------------------------------------------
// 手掛かりの生成
// 手掛かり = 「容疑者のうち誰を除外できるか」の集合として扱う
// ---------------------------------------------------------------------------

/** 属性による手掛かり（真犯人の属性を述べる。合致しない容疑者が消える） */
function attrClues(suspects, culprit) {
  const out = [];
  for (const a of ATTRS) {
    const v = culprit.attrs[a.key];
    if (v === undefined) continue;
    const keeps = suspects.filter((s) => s.attrs[a.key] === v).map((s) => s.id);
    out.push({ kind: 'attr', key: a.key, text: a.clue(v), keeps: new Set(keeps) });
  }
  return out;
}

/** アリバイによる手掛かり（その人物を1人だけ除外する） */
function alibiClues(suspects, culprit, rng) {
  const out = [];
  for (const s of suspects) {
    if (s.id === culprit.id) continue;
    const keeps = new Set(suspects.filter((x) => x.id !== s.id).map((x) => x.id));
    out.push({
      kind: 'alibi', who: s.id,
      text: `${s.name}には、事件のあった時刻に${s.alibi}という裏付けの取れた証言がある。`,
      keeps,
    });
  }
  return out;
}

/** 目撃証言（複数人をまとめて除外する。難易度を上げる役割） */
function witnessClues(suspects, culprit, rng) {
  const out = [];
  const others = suspects.filter((s) => s.id !== culprit.id);
  if (others.length < 3) return out;
  for (let t = 0; t < 4; t++) {
    const k = 2 + ri(rng, 2);
    const excluded = shuffle(rng, others).slice(0, k);
    const keeps = new Set(suspects.filter((s) => !excluded.some((e) => e.id === s.id)).map((s) => s.id));
    const names = excluded.map((s) => s.name).join('と');
    out.push({
      kind: 'witness',
      text: `事件の直前、${names}が別館の食堂で一緒にいたところを、複数の人間が見ている。`,
      keeps,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 検証
// ---------------------------------------------------------------------------

/** 手掛かりの集合から、犯人たりうる容疑者を求める */
export function solve(suspects, clues) {
  let cand = suspects.map((s) => s.id);
  for (const c of clues) cand = cand.filter((id) => c.keeps.has(id));
  return cand;
}

/**
 * 4つの保証をすべて確かめる。
 * ここを通らないものは、どれだけ物語が良くても出題しない。
 */
export function verify(suspects, clues, culpritId) {
  const problems = [];

  // 1. 唯一解
  const cand = solve(suspects, clues);
  if (cand.length !== 1) problems.push(`解が${cand.length}通り（1通りでなければならない）`);
  else if (cand[0] !== culpritId) problems.push('導かれる犯人が意図した犯人と違う');

  // 3. 無矛盾（真犯人がすべての手掛かりと合致するか）
  for (const c of clues) {
    if (!c.keeps.has(culpritId)) problems.push(`手掛かりが真犯人を除外している: ${c.text}`);
  }

  // 4. 非自明（どの手掛かりも欠かせない = 無駄がない）
  for (let i = 0; i < clues.length; i++) {
    const without = clues.filter((_, k) => k !== i);
    if (solve(suspects, without).length === 1) {
      problems.push(`不要な手掛かりが含まれている: ${clues[i].text}`);
    }
  }

  return { ok: problems.length === 0, problems, candidates: cand };
}

// ---------------------------------------------------------------------------
// 事件の生成
// ---------------------------------------------------------------------------
const NAMES = ['青木', '井川', '梅本', '遠藤', '小野塚', '柏木', '桐生', '倉田', '黒沢', '相馬',
  '立花', '津村', '戸倉', '中条', '南部', '灰谷', '早瀬', '牧原', '槙野', '矢代'];
const ROLES = ['この家の書生', '亡くなった主人の主治医', '古くからの使用人', '遠縁の親戚',
  '出入りの骨董商', '主人の秘書', '隣家の主人', '住み込みの料理人', '主人の姪', '会社の共同経営者'];
const ALIBIS = ['厨房で夕食の支度をしていた', '離れの書庫で本を読んでいた', '門番と長話をしていた',
  '駅まで客を送りに出ていた', '庭で犬の世話をしていた', '電話で取引先と話し込んでいた',
  '風呂を使っていた', '二階の広間で来客の相手をしていた'];

function makeSuspects(rng, n) {
  const names = shuffle(rng, NAMES).slice(0, n);
  const roles = shuffle(rng, ROLES).slice(0, n);
  const alibis = shuffle(rng, ALIBIS).slice(0, n);
  return names.map((name, i) => {
    const attrs = {};
    for (const a of ATTRS) attrs[a.key] = a.values[ri(rng, a.values.length)];
    return { id: i, name, role: roles[i], alibi: alibis[i], attrs };
  });
}

/**
 * 事件を1件つくる。
 * 手掛かりの候補を集め、そこから「犯人をちょうど1人に絞る、無駄のない最小の組」を探す。
 */
/**
 * ちょうど k 個の手掛かりで犯人が1人に決まり、かつ1個でも欠けたら決まらない組を探す。
 *
 * 貪欲法だと「1個で解けてしまう強い手掛かり」を選びがちで、推理にならない。
 * そこで、途中の段階では候補が必ず2人以上残るように枝刈りしながら組合せを探索する。
 * これにより「k個すべてを突き合わせて初めて絞れる」問題だけが残る。
 */
function findClueSet(suspects, pool, culpritId, k) {
  const all = suspects.map((s) => s.id);
  const picked = [];

  const rec = (start, cand) => {
    if (picked.length === k) return cand.length === 1 ? picked.slice() : null;
    // 残り手数で1人に絞りきれる見込みがないなら打ち切る
    if (pool.length - start < k - picked.length) return null;

    for (let i = start; i < pool.length; i++) {
      const c = pool[i];
      const next = cand.filter((id) => c.keeps.has(id));
      if (next.length === cand.length) continue;          // 何も絞れない手掛かりは無意味
      if (next.length < 1) continue;
      // 最後の1個を置く前に1人になっていたら、その手掛かりは不要ということ
      if (picked.length < k - 1 && next.length < 2) continue;
      picked.push(c);
      const got = rec(i + 1, next);
      picked.pop();
      if (got) return got;
    }
    return null;
  };

  return rec(0, all);
}

export function generate({ seed = 1, suspects: n = 7, clueCount = 4, tries = 600 } = {}) {
  const rng = makeRng(seed);

  for (let t = 0; t < tries; t++) {
    const suspects = makeSuspects(rng, n);
    const culprit = suspects[ri(rng, n)];

    const pool = shuffle(rng, [
      ...attrClues(suspects, culprit),
      ...alibiClues(suspects, culprit, rng),
      ...witnessClues(suspects, culprit, rng),
    ]);

    const set = findClueSet(suspects, pool, culprit.id, clueCount);
    if (!set) continue;

    const v = verify(suspects, set, culprit.id);
    if (!v.ok) continue;

    return { seed, suspects, culprit, clues: set, verify: v, clueCount };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 文章にする（論理を保証したあとで、物語を着せる）
// ---------------------------------------------------------------------------
const SCENES = [
  { place: '雨の降る晩の、山あいの洋館', victim: '館の主人' },
  { place: '雪に閉ざされた温泉宿', victim: '宿の女将' },
  { place: '嵐で船が出せなくなった島の別荘', victim: '別荘の持ち主' },
  { place: '停電した夜の古い病院', victim: '院長' },
];

export function toText(c) {
  const rng = makeRng(c.seed ^ 0x9e3779b9);
  const sc = SCENES[ri(rng, SCENES.length)];
  const L = [];
  L.push(`${sc.place}で、${sc.victim}が殺された。`);
  L.push('外部から人が出入りした形跡はない。犯人は、その夜そこにいた者の中にいる。');
  L.push('');
  L.push('【容疑者】');
  // 手掛かりが触れている属性は、必ず一覧に出す（出さないと解けない）
  const used = [...new Set(c.clues.filter((x) => x.kind === 'attr').map((x) => x.key))];
  for (const s of c.suspects) {
    const tags = used.map((k) => ATTRS.find((a) => a.key === k)).map((a) => a.tag(s.attrs[a.key]));
    L.push(`　${s.name}　—　${s.role}${tags.length ? '　［' + tags.join('・') + '］' : ''}`);
  }
  L.push('');
  L.push('【判明していること】');
  c.clues.forEach((cl, i) => L.push(`　${i + 1}. ${cl.text}`));
  L.push('');
  L.push('この中に、犯人はただ一人しかいない。誰か。');
  return L.join('\n');
}

export function answerText(c) {
  return `犯人は ${c.culprit.name}（${c.culprit.role}）。`;
}

