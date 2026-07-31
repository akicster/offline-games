// 今日の一問 — 1日1問だけ。全員が同じ問題を解く。
//
// なぜこの形にしたか:
//   宣伝を外に置くのではなく、拡散のしくみを商品の中に入れるため。
//   ・1日1問しかないので、遊び終わる。だから明日また来る理由が残る
//   ・全員が同じ問題なので、他人と比べられる。会話になる
//   ・成績を絵文字で共有できるので、共有そのものが導線になる
//   ・連続日数が積み上がるので、やめるコストが生まれる
//
//   全員が同じ問題を解く以上、破綻した問題を1日でも出せば信用を失う。
//   したがってこの機能は「唯一解を機械保証できる」ことが前提条件になっている。

import { dayNumber, dayKey, daySeed, todayKind, updateStreak, getStreak, shareText, share } from '../lib/daily.js';

const SITE = 'https://akicster.github.io/offline-games/#g=daily';

export default {
  mount(root, api) {
    const n = dayNumber();
    const kind = todayKind(n);
    const seed = daySeed(n);
    const key = dayKey();

    let cleanup = null;
    let cancelled = false;

    // すでに今日の分を解き終えていれば、結果と共有だけを見せる
    const rec = api.load('result:' + n, null);
    if (rec) { showResult(rec); return () => { cancelled = true; }; }

    startPuzzle();

    // -----------------------------------------------------------------
    function header() {
      const st = getStreak(api);
      return api.el('div', {
        style: 'display:flex;flex-direction:column;align-items:center;gap:3px;padding:2px 0',
      },
        api.el('div', { style: 'font-size:15px;font-weight:800' }, `今日の一問 #${n}`),
        api.el('div', { style: 'font-size:12px;color:var(--sub)' },
          `${key}　${kind.ic} ${kind.name}` + (st.count > 1 ? `　🔥${st.count}日連続` : '')),
      );
    }

    async function startPuzzle() {
      root.append(header());
      const wait = api.el('div', { class: 'note', style: 'padding:30px 0' }, '今日の問題を用意しています…');
      root.append(wait);

      let mod;
      try { mod = await import(`./${kind.type}.js`); }
      catch { wait.textContent = '今日の問題を読み込めませんでした'; return; }
      if (cancelled) return;
      wait.remove();

      const startedAt = Date.now();

      // 元のゲームをそのまま動かす。違いは「種が固定」「終了時に記録して共有を出す」だけ
      const sub = Object.create(api);
      sub.daily = { n, seed, kind };
      sub.win = (score, text) => {
        const ms = typeof score === 'number' ? score : Date.now() - startedAt;
        const st = updateStreak(api, n);
        const r = { n, ms, extra: text || '', kind: kind.name, streak: st.count, date: key };
        api.save('result:' + n, r);
        finish(r);
      };
      sub.lose = () => {
        // 今日の一問では「失敗」で終わらせず、そのまま続けさせる
        api.sound('bad');
      };

      cleanup = mod.default.mount(root, sub);
    }

    function finish(r) {
      if (cleanup) { try { cleanup(); } catch { /* 無視 */ } cleanup = null; }
      root.textContent = '';
      api.sound('win');
      showResult(r);
    }

    function showResult(r) {
      root.textContent = '';
      root.append(header());

      const sec = Math.round(r.ms / 1000);
      const mm = Math.floor(sec / 60), ss = sec % 60;
      const st = getStreak(api);

      const card = api.el('div', {
        style: 'width:min(92vw,380px);background:var(--panel);border:1px solid var(--line);border-radius:14px;'
          + 'padding:20px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:var(--shadow)',
      },
        api.el('div', { style: 'font-size:14px;color:var(--sub)' }, '今日の分は解き終わりました'),
        api.el('div', { style: 'font-size:36px;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums' },
          `${mm}:${String(ss).padStart(2, '0')}`),
        r.extra ? api.el('div', { style: 'font-size:13px;color:var(--sub)' }, r.extra) : null,
        api.el('div', { style: 'font-size:13px;color:var(--ink)' },
          `🔥 ${st.count}日連続　（最長 ${st.best}日）`),
      );
      root.append(card);

      const msg = api.el('div', { class: 'note', style: 'min-height:20px' }, '');
      const text = shareText({ n, kindName: r.kind, ms: r.ms, extra: r.extra, streak: st.count, url: SITE });

      api.buttons([
        {
          label: '結果を共有', primary: true, onClick: async () => {
            const res = await share(text);
            msg.textContent = res === 'copied' ? 'コピーしました。貼り付けて投稿できます'
              : res === 'shared' ? '共有しました' : '共有できませんでした';
          },
        },
        { label: '他のゲームで遊ぶ', onClick: () => { history.pushState(null, '', location.pathname); location.hash = ''; } },
      ]);
      root.append(msg);

      root.append(api.el('div', {
        style: 'font-size:11.5px;color:var(--sub);line-height:1.8;text-align:center;max-width:340px',
      }, '明日また新しい問題が出ます。問題は毎日、解がちょうど1通りであることを確認したものだけを出しています。'));

      // 共有される文面を見せておく（何が投稿されるか分からないと共有されにくい）
      root.append(api.el('pre', {
        style: 'font-size:11.5px;color:var(--sub);background:color-mix(in srgb,var(--ink) 6%,transparent);'
          + 'padding:10px 12px;border-radius:9px;white-space:pre-wrap;max-width:340px;margin:0;font-family:inherit',
      }, text));
    }

    return () => { cancelled = true; if (cleanup) { try { cleanup(); } catch { /* 無視 */ } } };
  },
};
