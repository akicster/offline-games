// 「今日の一問」の共通部分
//
// 考え方:
//   1日1問だけ、全員が同じ問題を解く。だから他人と比べられ、会話になり、共有される。
//   拡散装置を商品の外（宣伝）ではなく、商品の中に置く。
//
// 全員が同じ問題を解く以上、破綻した問題を1日でも出したら信用を失う。
// したがって、この機能は「唯一解を機械保証できる」ことが前提条件になっている。

/** その日の通し番号。基準日からの日数を使うので、端末の時計だけで決まる（通信不要） */
const EPOCH = Date.UTC(2026, 0, 1);   // 2026-01-01 を第1日とする

export function dayNumber(d = new Date()) {
  // 日本時間の日付で切り替える（世界標準時だと日本の朝9時に切り替わってしまう）
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const utcMidnight = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  return Math.floor((utcMidnight - EPOCH) / 86400000) + 1;
}

/** 日付文字列（YYYY-MM-DD、日本時間） */
export function dayKey(d = new Date()) {
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
}

/** その日の種。全端末で同じ値になる必要があるので、日番号だけから決める */
export function daySeed(n) {
  // 日番号をそのまま使うと近い日で似た問題になりやすいので、よく混ぜる
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 15; x = (x * 2246822519) >>> 0;
  x ^= x >>> 13; x = (x * 3266489917) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

/** 日替わりで出題する種目。曜日で回す（毎日違う種目のほうが飽きにくい） */
export const ROTATION = [
  { type: 'numplace', name: 'ナンプレ', ic: '9️⃣' },
  { type: 'deduction', name: '犯人当て', ic: '🔎' },
  { type: 'numplace', name: 'ナンプレ', ic: '9️⃣' },
  { type: 'deduction', name: '犯人当て', ic: '🔎' },
  { type: 'numplace', name: 'ナンプレ', ic: '9️⃣' },
  { type: 'deduction', name: '犯人当て', ic: '🔎' },
  { type: 'numplace', name: 'ナンプレ', ic: '9️⃣' },
];

export function todayKind(n) { return ROTATION[n % ROTATION.length]; }

// ---------------------------------------------------------------------------
// 連続日数
// ---------------------------------------------------------------------------
export function updateStreak(store, n) {
  const s = store.load('streak', { last: 0, count: 0, best: 0, done: {} });
  if (s.last === n) return s;                       // 今日はもう記録済み
  s.count = (s.last === n - 1) ? s.count + 1 : 1;   // 前日から続いていれば伸ばす
  s.last = n;
  s.best = Math.max(s.best || 0, s.count);
  s.done = s.done || {};
  s.done[n] = true;
  store.save('streak', s);
  return s;
}

export function getStreak(store) {
  return store.load('streak', { last: 0, count: 0, best: 0, done: {} });
}

// ---------------------------------------------------------------------------
// 共有文
// ---------------------------------------------------------------------------
const BAR = ['🟩', '🟩', '🟨', '🟨', '🟧', '🟥'];

/** 成績を絵文字にする。数字だけより一目で伝わり、共有されやすい */
export function shareText({ n, kindName, ms, extra, streak, url }) {
  const sec = Math.round(ms / 1000);
  const mm = Math.floor(sec / 60), ss = sec % 60;
  // 速さを6段階の色で表す（速いほど緑）
  const idx = sec < 60 ? 0 : sec < 120 ? 1 : sec < 240 ? 2 : sec < 420 ? 3 : sec < 600 ? 4 : 5;
  const bars = BAR.slice(0, idx + 1).join('');
  const lines = [
    `今日の一問 #${n}　${kindName}`,
    `${bars}　${mm}:${String(ss).padStart(2, '0')}`,
  ];
  if (extra) lines.push(extra);
  if (streak > 1) lines.push(`🔥 ${streak}日連続`);
  lines.push(url);
  return lines.join('\n');
}

/** 共有する。共有機能がなければクリップボードに入れる */
export async function share(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch { /* 利用者が閉じただけなので何もしない */ }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
