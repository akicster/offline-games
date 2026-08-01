// 10をつくる — 4つの数字をすべて使い、四則演算で10を作る。

const OPS = ['＋', '−', '×', '÷'];

// 約分した分数で計算し、小数の丸め誤差を出さない。
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function fraction(n, d = 1) {
  if (d < 0) { n = -n; d = -d; }
  if (n === 0) return { n: 0, d: 1 };
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function calculate(a, b, op) {
  let value;
  if (op === '＋') value = fraction(a.n * b.d + b.n * a.d, a.d * b.d);
  else if (op === '−') value = fraction(a.n * b.d - b.n * a.d, a.d * b.d);
  else if (op === '×') value = fraction(a.n * b.n, a.d * b.d);
  else {
    if (b.n === 0) return null;
    value = fraction(a.n * b.d, a.d * b.n);
  }
  return { ...value, expr: `(${a.expr} ${op} ${b.expr})` };
}

function valueText(value) {
  return value.d === 1 ? String(value.n) : `${value.n}/${value.d}`;
}

// 2項ずつまとめる全探索は、数字の並べ方・演算子・括弧の全パターンを含む。
function findSolution(numbers) {
  const dead = new Set();

  function search(items) {
    if (items.length === 1) return items[0].n === 10 * items[0].d ? items[0].expr : null;

    // 同じ分数の組から先に解なしと分かった状態は再探索しない。
    const state = items.map((v) => `${v.n}/${v.d}`).sort().join('|');
    if (dead.has(state)) return null;

    for (let i = 0; i < items.length - 1; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const rest = items.filter((_, k) => k !== i && k !== j);
        const results = [
          calculate(a, b, '＋'),
          calculate(a, b, '×'),
          calculate(a, b, '−'),
          calculate(b, a, '−'),
          calculate(a, b, '÷'),
          calculate(b, a, '÷'),
        ];
        const tried = new Set();
        for (const result of results) {
          if (!result) continue;
          const key = `${result.n}/${result.d}`;
          if (tried.has(key)) continue;
          tried.add(key);
          const answer = search([...rest, result]);
          if (answer) return answer;
        }
      }
    }
    dead.add(state);
    return null;
  }

  return search(numbers.map((n) => ({ n, d: 1, expr: String(n) })));
}

export default {
  mount(root, api) {
    const panel = api.el('section', {
      style: 'width:min(92vw,400px);display:flex;flex-direction:column;gap:10px;'
        + 'padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:var(--shadow)',
    });
    const source = api.el('div', {
      style: 'text-align:center;color:var(--sub);font-size:12px;font-variant-numeric:tabular-nums',
    });
    const valuesBox = api.el('div', {
      style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px',
    });
    const preview = api.el('div', {
      style: 'min-height:40px;display:grid;place-items:center;text-align:center;padding:6px 8px;'
        + 'border-radius:10px;border:1px dashed var(--line);color:var(--sub);font-size:13px;line-height:1.45',
    });
    const operators = api.el('div', {
      style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:7px',
    });
    const message = api.el('div', {
      style: 'min-height:20px;text-align:center;color:var(--sub);font-size:12px;line-height:1.5',
      role: 'status',
    });
    const answer = api.el('div', {
      style: 'display:none;padding:9px 10px;border-radius:9px;background:var(--bg);color:var(--ink);'
        + 'font-size:12px;line-height:1.55;text-align:center;overflow-wrap:anywhere',
    });

    panel.append(source, valuesBox, preview, operators, message, answer);
    api.add(panel);
    api.note('左側にする数、右側にする数、演算子を選びます。合成した順番が括弧になります');

    let values = [];
    let history = [];
    let selected = [];
    let chosenOp = null;
    let solution = '';
    let info = '';
    let done = false;
    let startedAt = 0;
    let finalElapsed = null;
    let timer = null;

    const controls = api.buttons([
      { label: '1手戻す', onClick: undo },
      { label: '答えを見る', onClick: showAnswer },
      { label: '別の問題', onClick: newPuzzle, primary: true },
    ]);
    const undoButton = controls.children[0];

    const opButtons = OPS.map((op) => {
      const button = api.el('button', {
        type: 'button',
        style: 'min-height:46px;border:1px solid var(--line);border-radius:10px;background:var(--panel);'
          + 'color:var(--ink);font:inherit;font-size:22px;font-weight:700;cursor:pointer',
        onclick: () => chooseOperator(op),
        'aria-label': `${op}を選ぶ`,
      }, op);
      operators.append(button);
      return button;
    });

    function elapsed() {
      return finalElapsed === null ? Math.max(0, performance.now() - startedAt) : finalElapsed;
    }

    function drawHud() {
      const best = api.best();
      api.hud({
        '時間': `${(elapsed() / 1000).toFixed(1)}秒`,
        '最短': best === null ? '—' : `${(best / 1000).toFixed(1)}秒`,
      });
    }

    function startTimer() {
      if (timer !== null) clearInterval(timer);
      finalElapsed = null;
      startedAt = performance.now();
      drawHud();
      timer = setInterval(drawHud, 100);
    }

    function stopTimer() {
      finalElapsed = Math.round(performance.now() - startedAt);
      if (timer !== null) clearInterval(timer);
      timer = null;
      drawHud();
      return finalElapsed;
    }

    function render() {
      valuesBox.textContent = '';
      values.forEach((value, index) => {
        const order = selected.indexOf(index);
        const active = order !== -1;
        const button = api.el('button', {
          type: 'button',
          title: value.expr,
          'aria-pressed': active ? 'true' : 'false',
          'aria-label': `${valueText(value)}を${active ? `${order + 1}番目から外す` : '選ぶ'}`,
          style: 'position:relative;min-width:0;min-height:72px;padding:9px 7px;border-radius:11px;cursor:pointer;'
            + `border:2px solid ${active ? 'var(--accent)' : 'var(--line)'};`
            + `background:${active ? 'var(--accent)' : 'var(--bg)'};`
            + `color:${active ? 'var(--accent-ink)' : 'var(--ink)'};font:inherit`,
          onclick: () => selectValue(index),
        },
        api.el('span', {
          style: 'display:block;font-size:clamp(21px,7vw,30px);font-weight:800;line-height:1.05;'
            + 'font-variant-numeric:tabular-nums',
        }, valueText(value)),
        api.el('span', {
          style: `display:block;margin-top:6px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`
            + `color:${active ? 'var(--accent-ink)' : 'var(--sub)'}`,
        }, active ? `${order + 1}番目${order === 0 ? '（左）' : '（右）'}` : value.expr));
        valuesBox.append(button);
      });

      opButtons.forEach((button, index) => {
        const active = OPS[index] === chosenOp;
        button.style.background = active ? 'var(--accent)' : 'var(--panel)';
        button.style.color = active ? 'var(--accent-ink)' : 'var(--ink)';
        button.style.borderColor = active ? 'var(--accent)' : 'var(--line)';
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      if (selected.length === 0) {
        preview.textContent = chosenOp ? `${chosenOp}：左側の数を選んでください` : '左側の数から選んでください';
      } else if (selected.length === 1) {
        preview.textContent = `${valueText(values[selected[0]])} ${chosenOp || '□'} … 右側の数を選んでください`;
      } else {
        preview.textContent = `${valueText(values[selected[0]])} □ ${valueText(values[selected[1]])} — 演算子を選んでください`;
      }
      message.textContent = info;
      undoButton.disabled = history.length === 0 || done;
      undoButton.style.opacity = undoButton.disabled ? '.45' : '1';
    }

    function selectValue(index) {
      if (done) return;
      info = '';
      const pos = selected.indexOf(index);
      if (pos !== -1) selected.splice(pos, 1);
      else if (selected.length < 2) selected.push(index);
      else selected = [index];

      api.sound('tap');
      if (selected.length === 2 && chosenOp) mergeSelected();
      else render();
    }

    function chooseOperator(op) {
      if (done) return;
      chosenOp = op;
      info = '';
      api.sound('tap');
      if (selected.length === 2) mergeSelected();
      else render();
    }

    function mergeSelected() {
      const left = values[selected[0]], right = values[selected[1]];
      const result = calculate(left, right, chosenOp);
      if (!result) {
        info = '0では割れません。別の演算を選んでください';
        chosenOp = null;
        api.sound('bad');
        render();
        return;
      }

      history.push(values.map((v) => ({ ...v })));
      const insertAt = Math.min(...selected);
      const picked = new Set(selected);
      const next = values.filter((_, index) => !picked.has(index));
      next.splice(insertAt, 0, result);
      values = next;
      selected = [];
      chosenOp = null;

      if (values.length === 1 && values[0].n === 10 * values[0].d) {
        done = true;
        info = `${values[0].expr} = 10`;
        render();
        api.win(stopTimer(), '4つの数字をすべて使いました');
      } else if (values.length === 1) {
        info = `${valueText(values[0])}です。10ではないので「1手戻す」でやり直せます`;
        api.sound('bad');
        render();
      } else {
        info = `${result.expr} = ${valueText(result)}`;
        api.sound('move');
        render();
      }
    }

    function undo() {
      if (done || history.length === 0) return;
      values = history.pop();
      selected = [];
      chosenOp = null;
      info = '1手戻しました';
      render();
    }

    function showAnswer() {
      answer.textContent = `答えの例：${solution} = 10`;
      answer.style.display = 'block';
    }

    function newPuzzle() {
      let numbers = null;
      solution = '';
      // 毎回、候補を全探索に通し、解が確認できた問題だけを採用する。
      for (let attempt = 0; attempt < 200 && !solution; attempt++) {
        numbers = Array.from({ length: 4 }, () => 1 + api.rand(9));
        solution = findSolution(numbers) || '';
      }
      // 乱数候補が続けて外れても、確認済みの問題へ確実に着地する。
      if (!solution) {
        numbers = [1, 2, 3, 4];
        solution = findSolution(numbers);
      }

      const shuffled = api.shuffle(numbers);
      values = shuffled.map((n) => ({ n, d: 1, expr: String(n) }));
      history = [];
      selected = [];
      chosenOp = null;
      info = '';
      done = false;
      source.textContent = `出題：${shuffled.join('・')}（すべて1回ずつ使う）`;
      answer.style.display = 'none';
      answer.textContent = '';
      startTimer();
      render();
    }

    newPuzzle();
    return () => {
      if (timer !== null) clearInterval(timer);
    };
  },
};
