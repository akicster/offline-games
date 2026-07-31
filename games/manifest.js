// ゲーム一覧のメタ情報。
// 実装は games/<id>.js に置く。ここに載せた id と必ず一致させること。
//
// cat  : カテゴリ id（下の CATS のいずれか）
// best : 記録の向き。'high'=高いほど良い / 'low'=少ないほど良い / 'time'=短いほど良い / null=記録なし
// ic   : 一覧に出す絵文字
// kw   : 検索用の追加キーワード（ひらがな等）

export const CATS = [
  { id: 'number', name: '数字' },
  { id: 'logic', name: '論理' },
  { id: 'action', name: 'アクション' },
  { id: 'memory', name: '記憶' },
  { id: 'board', name: 'ボード' },
  { id: 'word', name: 'ことば' },
];

export const GAMES = [
  { id: 'numplace', name: 'ナンプレ', cat: 'number', best: 'time', ic: '9️⃣',
    desc: 'タテヨコとブロックに同じ数字が入らないように埋める', kw: 'なんぷれ なんばーぷれーす' },

  { id: 'merge2048', name: 'マージ2048', cat: 'number', best: 'high', ic: '🔢',
    desc: '同じ数をくっつけて大きくする定番スライドパズル', kw: 'まーじ すらいど 2048' },

  { id: 'lightsout', name: 'ライツアウト', cat: 'logic', best: 'low', ic: '💡',
    desc: 'すべての明かりを消す。押すと十字に反転', kw: 'らいつあうと あかり' },

  { id: 'snake', name: 'スネーク', cat: 'action', best: 'high', ic: '🐍',
    desc: 'エサを食べて伸びる。自分の体にぶつかると終わり', kw: 'すねーく へび' },

  { id: 'slide15', name: '15パズル', cat: 'logic', best: 'low', ic: '🧩',
    desc: 'バラバラの数字を1から順に並べ直す', kw: 'すらいど 15 じゅうご' },

  { id: 'memoflip', name: '神経衰弱', cat: 'memory', best: 'low', ic: '🃏',
    desc: '同じ絵柄を2枚そろえる。位置を覚えよう', kw: 'しんけいすいじゃく めもりー' },

  { id: 'minesweeper', name: 'マインスイーパ', cat: 'logic', best: 'time', ic: '💣',
    desc: '地雷を避けて安全なマスをすべて開く', kw: 'まいんすいーぱ じらい' },

  { id: 'deduction', name: '犯人当て', cat: 'logic', best: 'time', ic: '🔎',
    desc: '手掛かりを突き合わせて容疑者からただ一人を特定する', kw: 'はんにんあて すいり ろじっく' },

  { id: 'mahjong', name: '麻雀ソリティア', cat: 'board', best: 'time', ic: '🀄',
    desc: '同じ牌を2枚ずつ取り除く。必ず最後まで消せる配牌', kw: 'まーじゃん しゃんはい つみき' },

  { id: 'stackdrop', name: 'つみあげパズル', cat: 'action', best: 'high', ic: '🧱',
    desc: '落ちてくるブロックを積んで横一列を消す', kw: 'つみあげ おちもの ぶろっく' },

  { id: 'klondike', name: 'ソリティア', cat: 'board', best: 'time', ic: '🂡',
    desc: '色違いに並べて4つの組札を完成させる定番トランプゲーム', kw: 'そりてぃあ くろんだいく とらんぷ' },

  { id: 'spider', name: 'スパイダー', cat: 'board', best: 'time', ic: '🕷️',
    desc: '同じスートのKからAを8組そろえて取り除く', kw: 'すぱいだー そりてぃあ とらんぷ' },
];
