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
  { id: 'daily', name: '今日の一問', cat: 'logic', best: 'time', ic: '📅',
    desc: '1日1問だけ。全員が同じ問題に挑みます', kw: 'きょう でいりー まいにち' },

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

  { id: 'towerdefense', name: 'タワーディフェンス', cat: 'action', best: 'high', ic: '🏰',
    desc: '道を進む敵を、建てた塔で食い止める', kw: 'たわーでぃふぇんす とりで まもる' },

  { id: 'kakuro', name: 'カックロ', cat: 'number', best: 'time', ic: '➕',
    desc: 'タテヨコの合計を手掛かりに1〜9を入れる数字クロスワード', kw: 'かっくろ かずくろす けいさん' },

  { id: 'sokoban', name: '倉庫番', cat: 'logic', best: 'low', ic: '📦',
    desc: '荷物を押して目的地に収める。全10面すべて解けることを確認済み', kw: 'そうこばん そこばん にもつ' },

  { id: 'nonogram', name: 'お絵かきロジック', cat: 'logic', best: 'time', ic: '🖼️',
    desc: '数字をたよりにマスを塗ると絵が現れる', kw: 'ののぐらむ おえかき ろじっく' },

  { id: 'ludo', name: 'LUDO', cat: 'board', best: null, ic: '🎲',
    desc: 'サイコロで駒を進めてゴールを目指す。CPU3人と対戦', kw: 'るーど すごろく さいころ' },

  { id: 'mahjong', name: '麻雀ソリティア', cat: 'board', best: 'time', ic: '🀄',
    desc: '同じ牌を2枚ずつ取り除く。必ず最後まで消せる配牌', kw: 'まーじゃん しゃんはい つみき' },

  { id: 'stackdrop', name: 'つみあげパズル', cat: 'action', best: 'high', ic: '🧱',
    desc: '落ちてくるブロックを積んで横一列を消す', kw: 'つみあげ おちもの ぶろっく' },

  { id: 'klondike', name: 'ソリティア', cat: 'board', best: 'time', ic: '🂡',
    desc: '色違いに並べて4つの組札を完成させる定番トランプゲーム', kw: 'そりてぃあ くろんだいく とらんぷ' },

  { id: 'spider', name: 'スパイダー', cat: 'board', best: 'time', ic: '🕷️',
    desc: '同じスートのKからAを8組そろえて取り除く', kw: 'すぱいだー そりてぃあ とらんぷ' },

  { id: 'gomoku', name: '五目並べ', cat: 'board', best: null, ic: '⚫',
    desc: '黒石を五つ並べてCPUに勝つ定番のボードゲーム', kw: 'ごもくならべ れんじゅ ぼーど' },

  { id: 'freecell', name: 'フリーセル', cat: 'board', best: 'time', ic: '🃏',
    desc: '空きセルを使い、すべてのカードを4つの組札へ重ねる', kw: 'ふりーせる そりてぃあ とらんぷ' },

  { id: 'reversi', name: 'リバーシ', cat: 'board', best: null, ic: '⚪',
    desc: '相手の石を挟んで返し、CPUより多くの石を残す', kw: 'りばーし おせろ ぼーど' },

  { id: 'breakout', name: 'ブロック崩し', cat: 'action', best: 'high', ic: '🧱',
    desc: 'バーでボールを打ち返し、すべてのブロックを壊す', kw: 'ぶろっくくずし あくしょん ぼーる' },

  { id: 'maze', name: '迷路', cat: 'logic', best: 'time', ic: '🌀',
    desc: '自動生成された迷路を進み、ゴールまでの道を見つける', kw: 'めいろ らびりんす みち' },

  { id: 'hanoi', name: 'ハノイの塔', cat: 'logic', best: 'low', ic: '🗼',
    desc: '小さい円盤を使いながら塔を右端の杭へ移す', kw: 'はのいのとう えんばん ぱずる' },
  { id: 'wordsearch', name: 'ことばさがし', cat: 'word', best: 'time', ic: '🔤', desc: '盤面に隠れたカタカナの言葉を見つける', kw: 'ことばさがし もじ たんご かたかな' },
  { id: 'maketen', name: '10をつくる', cat: 'number', best: 'time', ic: '🔟', desc: '4つの数字と四則演算を使って10を作る', kw: 'じゅうをつくる けいさん しそくえんざん' },
  { id: 'chain', name: 'れんさパズル', cat: 'action', best: 'high', ic: '🟣', desc: '同じ色を4つつなげて消し連鎖を狙う', kw: 'れんさ おちもの ぶろっく いろ' },
  { id: 'pyramid', name: 'ピラミッド', cat: 'board', best: 'time', ic: '🔺', desc: '露出した札で13を作り、7段のピラミッドをすべて消す', kw: 'ぴらみっど そりてぃあ とらんぷ 13' },
  { id: 'simon', name: 'おとおぼえ', cat: 'memory', best: 'high', ic: '🎵', desc: '光る4色の順番を覚えて、同じ順に押し返す', kw: 'おとおぼえ さいもん きおく いろ' },
  { id: 'numbertouch', name: 'かずタッチ', cat: 'number', best: 'time', ic: '🔢', desc: '散らばった数字を1から順に押し、速さを競う', kw: 'かずたっち すうじ じゅんばん しゃっふる' },
];
