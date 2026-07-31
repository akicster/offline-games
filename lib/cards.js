// トランプの共通ライブラリ（クロンダイク／スパイダー／フリーセル等で共用）
//
// 画像は一切使わず、文字と CSS だけでカードを描く。
// これによりオフラインで完全に動き、どの画面サイズでも滲まない。

export const SUITS = [
  { id: 's', sym: '♠', red: false, name: 'スペード' },
  { id: 'h', sym: '♥', red: true, name: 'ハート' },
  { id: 'd', sym: '♦', red: true, name: 'ダイヤ' },
  { id: 'c', sym: '♣', red: false, name: 'クラブ' },
];

export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** デッキを作る。suits を絞ればスパイダーの1種類デッキ等も作れる */
export function makeDeck({ decks = 1, suits = ['s', 'h', 'd', 'c'] } = {}) {
  const out = [];
  let n = 0;
  for (let d = 0; d < decks; d++) {
    for (const s of suits) {
      for (let r = 1; r <= 13; r++) out.push({ uid: n++, suit: s, rank: r, up: false });
    }
  }
  return out;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const isRed = (card) => SUITS.find((s) => s.id === card.suit).red;
export const suitSym = (card) => SUITS.find((s) => s.id === card.suit).sym;

// ---------------------------------------------------------------------------
// スタイル（1回だけ差し込む）
// ---------------------------------------------------------------------------
let styled = false;
export function injectCardStyles() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = `
.cd{position:absolute;border-radius:calc(var(--cw) * .085);background:#fdfdfb;
  box-shadow:0 1px 2px rgba(0,0,0,.35);border:1px solid rgba(0,0,0,.22);
  width:var(--cw);height:var(--ch);user-select:none;overflow:hidden;
  transition:left .12s ease,top .12s ease;font-family:system-ui,sans-serif;cursor:pointer}
.cd.red{color:#d1302b}
.cd.blk{color:#1a1a1a}
.cd .r{position:absolute;left:5.5%;top:2%;font-weight:800;line-height:1;
  font-size:calc(var(--cw) * .40);letter-spacing:-.04em}
.cd .s{position:absolute;left:6%;top:calc(2% + var(--cw) * .40);font-size:calc(var(--cw) * .30);line-height:1}
.cd .big{position:absolute;right:6%;bottom:2%;font-size:calc(var(--cw) * .58);line-height:1;opacity:.9}
.cd.down{background:repeating-linear-gradient(45deg,#3b4a8f 0 6px,#33417d 6px 12px);
  border-color:rgba(255,255,255,.28)}
.cd.down .r,.cd.down .s,.cd.down .big{display:none}
.cd.sel{outline:3px solid var(--accent);outline-offset:-1px;box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 40%,transparent)}
.cd.hint{outline:3px dashed var(--good);outline-offset:-1px}
.pile{position:absolute;border-radius:calc(var(--cw) * .085);width:var(--cw);height:var(--ch);
  border:1.5px dashed color-mix(in srgb,var(--ink) 28%,transparent);box-sizing:border-box}
.pile.tgt{border-color:var(--good);background:color-mix(in srgb,var(--good) 14%,transparent)}
.pile .ph{position:absolute;inset:0;display:grid;place-items:center;font-size:calc(var(--cw) * .42);
  color:color-mix(in srgb,var(--ink) 30%,transparent)}
.table{position:relative;width:100%;touch-action:manipulation}
`;
  document.head.append(st);
}

/** カード1枚のDOMを作る */
export function cardEl(card) {
  const d = document.createElement('div');
  d.className = 'cd ' + (card.up ? (isRed(card) ? 'red' : 'blk') : 'down');
  if (card.up) {
    const r = document.createElement('div'); r.className = 'r'; r.textContent = RANK_LABEL[card.rank];
    const s = document.createElement('div'); s.className = 's'; s.textContent = suitSym(card);
    const b = document.createElement('div'); b.className = 'big'; b.textContent = suitSym(card);
    d.append(r, s, b);
  }
  return d;
}

/** 置き場（空のパイル）のDOMを作る */
export function pileEl(placeholder) {
  const d = document.createElement('div');
  d.className = 'pile';
  if (placeholder) {
    const p = document.createElement('div'); p.className = 'ph'; p.textContent = placeholder;
    d.append(p);
  }
  return d;
}
