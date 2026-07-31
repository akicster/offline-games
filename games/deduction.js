// 犯人当て — 手掛かりを突き合わせて、容疑者の中からただ一人を特定する。
//
// 出題はすべて機械検証してから出している。
//   1. 唯一解    … 導ける犯人がちょうど1人
//   2. フェアプレイ … 解に必要な情報がすべて提示されている（後出しなし）
//   3. 無矛盾    … どの手掛かりも真犯人と矛盾しない
//   4. 非自明    … どれか1つでも欠けると犯人が絞れない（無駄な手掛かりがない）
//
// 物語は味付けであって主価値ではない。価値は「破綻していない論理」の側にある。

import { generate, solve, toText, ATTRS } from '../lib/deduction.js';

const LEVELS = [
  { n: 5, k: 3, name: 'やさしい' },
  { n: 6, k: 4, name: 'ふつう' },
  { n: 7, k: 5, name: 'むずかしい' },
  { n: 8, k: 6, name: '難問' },
];

export default {
  mount(root, api) {
    let li = api.load('level', 1);
    let c = null;              // 現在の事件
    let marks = {};            // 容疑者ごとのメモ ('' | 'x' | 'o')
    let startAt = 0, done = false, wrong = 0;

    const wrap = api.el('div', { style: 'width:min(94vw,460px);display:flex;flex-direction:column;gap:10px' });
    api.add(wrap);

    const selStyle = 'padding:7px 10px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-size:13px';
    const lvSel = api.el('select', { style: selStyle, onchange: (e) => { li = Number(e.target.value); api.save('level', li); newCase(); } });
    LEVELS.forEach((l, i) => lvSel.append(api.el('option', { value: i, ...(li === i ? { selected: '' } : {}) }, l.name)));
    api.add(lvSel);

    api.buttons([
      { label: 'メモを消す', onClick: () => { marks = {}; render(); } },
      { label: '答えを見る', onClick: reveal },
      { label: '新しい事件', onClick: newCase, primary: true },
    ]);
    api.note('手掛かりをすべて突き合わせると、犯人は必ず一人に決まります。どの手掛かりも欠かせません');

    // ---- 描画 -------------------------------------------------------
    function render() {
      wrap.textContent = '';

      wrap.append(api.el('div', {
        style: 'font-size:13.5px;line-height:1.85;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:11px 13px',
      }, c.intro));

      // 手掛かりが触れている属性は必ず出す。出さないと人間には解けない
      const usedKeys = [...new Set(c.clues.filter((x) => x.kind === 'attr').map((x) => x.key))];
      const usedAttrs = usedKeys.map((k) => ATTRS.find((a) => a.key === k)).filter(Boolean);

      // 容疑者一覧（タップで ○ / × を切り替えてメモできる）
      const list = api.el('div', { style: 'display:flex;flex-direction:column;gap:5px' });
      for (const s of c.suspects) {
        const m = marks[s.id] || '';
        const tags = usedAttrs.map((a) => api.el('span', {
          style: 'font-size:11px;padding:2px 7px;border-radius:6px;background:color-mix(in srgb,var(--ink) 10%,transparent);color:var(--sub);white-space:nowrap',
        }, a.tag(s.attrs[a.key])));
        const row = api.el('button', {
          style: 'display:flex;align-items:center;gap:10px;text-align:left;padding:9px 11px;border-radius:10px;font:inherit;cursor:pointer;'
            + `border:1px solid ${m === 'o' ? 'var(--accent)' : 'var(--line)'};`
            + `background:${m === 'o' ? 'color-mix(in srgb,var(--accent) 16%,var(--panel))' : 'var(--panel)'};`
            + `color:var(--ink);opacity:${m === 'x' ? 0.45 : 1}`,
          onclick: () => {
            if (done) return;
            marks[s.id] = m === '' ? 'x' : m === 'x' ? 'o' : '';
            api.sound('tap');
            render();
          },
        },
          api.el('span', { style: `width:22px;font-size:16px;font-weight:800;color:${m === 'o' ? 'var(--accent)' : 'var(--sub)'}` }, m === 'o' ? '○' : m === 'x' ? '×' : '　'),
          api.el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:3px;min-width:0' },
            api.el('div', { style: 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap' },
              api.el('span', { style: 'font-size:14.5px;font-weight:700' }, s.name),
              api.el('span', { style: 'font-size:12px;color:var(--sub)' }, s.role)),
            tags.length ? api.el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' }, ...tags) : null),
          api.el('span', {
            style: 'font-size:12px;padding:5px 11px;border-radius:8px;border:1px solid var(--line);color:var(--sub)',
            onclick: (e) => { e.stopPropagation(); accuse(s); },
          }, 'この人だ'),
        );
        list.append(row);
      }
      wrap.append(list);

      // 手掛かり
      const cl = api.el('div', { style: 'background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:11px 13px;display:flex;flex-direction:column;gap:7px' });
      cl.append(api.el('div', { style: 'font-size:12px;color:var(--sub);font-weight:700' }, `判明していること（${c.clues.length}件）`));
      c.clues.forEach((x, i) => {
        cl.append(api.el('div', { style: 'font-size:13px;line-height:1.75;color:var(--ink)' }, `${i + 1}. ${x.text}`));
      });
      wrap.append(cl);

      api.hud({ '容疑者': c.suspects.length, '手掛かり': c.clues.length, 'はずれ': wrong });
    }

    // ---- 判定 -------------------------------------------------------
    function accuse(s) {
      if (done) return;
      if (s.id === c.culprit.id) {
        done = true;
        api.sound('good');
        api.save('saved', null);
        api.win(Date.now() - startAt, `はずれ ${wrong}回`);
      } else {
        wrong++;
        marks[s.id] = 'x';
        api.sound('bad');
        render();
        save();
      }
    }

    function reveal() {
      if (done) return;
      done = true;
      marks = {}; marks[c.culprit.id] = 'o';
      render();
      api.sound('lose');
      api.save('saved', null);
      api.lose(undefined, `犯人は ${c.culprit.name}（${c.culprit.role}）でした`);
    }

    // ---- 保存と再開 --------------------------------------------------
    function save() {
      if (done) return;
      api.save('saved', { seed: c.seed, li, marks, wrong, elapsed: Date.now() - startAt });
    }

    function build(seed) {
      const L = LEVELS[li];
      const g = generate({ seed, suspects: L.n, clueCount: L.k });
      if (!g) return null;
      // 独立検証: 生成器とは別に、もう一度手掛かりから犯人を解き直す
      const cand = solve(g.suspects, g.clues);
      if (cand.length !== 1 || cand[0] !== g.culprit.id) return null;
      // 導入文だけ toText から取り出す（容疑者と手掛かりは画面側で組む）
      g.intro = toText(g).split('\n').slice(0, 2).join(' ');
      return g;
    }

    function newCase() {
      done = false; wrong = 0; marks = {};
      let g = null, seed = (Math.floor(Math.random() * 2 ** 31)) >>> 0;
      for (let t = 0; t < 30 && !g; t++) g = build((seed + t * 104729) >>> 0);
      if (!g) { wrap.textContent = ''; wrap.append(api.el('div', { class: 'note' }, '事件を作れませんでした')); return; }
      c = g; startAt = Date.now();
      lvSel.value = String(li);
      render(); save();
    }

    // ---- 起動 --------------------------------------------------------
    const saved = api.load('saved', null);
    if (saved && typeof saved.seed === 'number' && LEVELS[saved.li]) {
      li = saved.li;
      const g = build(saved.seed);
      if (g) {
        c = g; marks = saved.marks || {}; wrong = saved.wrong || 0;
        startAt = Date.now() - (saved.elapsed || 0);
        lvSel.value = String(li);
        render();
      } else { newCase(); }
    } else {
      newCase();
    }

    return () => save();
  },
};
