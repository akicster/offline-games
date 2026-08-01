// ハノイの塔 — 小さい円盤を大きい円盤の上に重ねて、右端の杭へ移す。

const MIN_DISKS = 3;
const MAX_DISKS = 7;
const PEG_NAMES = ['左', '中央', '右'];

export default {
  mount(root, api) {
    let diskCount = MIN_DISKS;
    let towers = [];
    let selected = null;
    let moves = 0;
    let done = false;

    const selectStyle = 'padding:7px 10px;border-radius:9px;border:1px solid var(--line);'
      + 'background:var(--panel);color:var(--ink);font:inherit;font-size:13px';
    const sizeSelect = api.el('select', {
      style: selectStyle,
      'aria-label': '円盤の枚数',
      onchange: (e) => {
        diskCount = Number(e.target.value);
        reset();
      },
    });
    for (let n = MIN_DISKS; n <= MAX_DISKS; n++) {
      sizeSelect.append(api.el('option', { value: n }, `${n}枚`));
    }

    const settings = api.el('label', {
      style: 'width:min(92vw,400px);display:flex;align-items:center;justify-content:center;gap:9px;'
        + 'font-size:13px;color:var(--sub)',
    }, '円盤', sizeSelect);

    const board = api.el('div', {
      class: 'board',
      style: 'width:min(92vw,400px);height:230px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));'
        + 'gap:5px;padding:7px;background:var(--panel);border:1px solid var(--line);border-radius:13px',
    });
    const pegs = [];
    for (let i = 0; i < 3; i++) {
      const peg = api.el('button', {
        type: 'button',
        style: 'min-width:0;position:relative;padding:0;border:1px solid var(--line);border-radius:9px;'
          + 'background:var(--panel);color:var(--ink);cursor:pointer;touch-action:manipulation;overflow:hidden',
        onclick: () => tapPeg(i),
      });
      pegs.push(peg);
      board.append(peg);
    }

    const status = api.el('div', {
      role: 'status',
      'aria-live': 'polite',
      style: 'min-height:20px;font-size:12px;color:var(--sub);text-align:center',
    });

    api.add(settings, board, status);
    api.note('移す元の杭、移す先の杭の順にタップします。大きい円盤は小さい円盤の上に置けません');
    api.buttons([{ label: 'はじめから', onClick: reset, primary: true }]);

    function minimumMoves() {
      return (2 ** diskCount) - 1;
    }

    function setStatus(text, kind = 'normal') {
      status.textContent = text;
      status.style.color = kind === 'bad' ? 'var(--bad)'
        : kind === 'good' ? 'var(--good)' : 'var(--sub)';
    }

    function drawPeg(index) {
      const peg = pegs[index];
      const isSelected = selected === index;
      const stack = towers[index];
      const top = stack[stack.length - 1];

      peg.textContent = '';
      peg.style.borderColor = isSelected ? 'var(--accent)' : 'var(--line)';
      peg.style.background = isSelected
        ? 'color-mix(in srgb,var(--accent) 12%,var(--panel))'
        : 'var(--panel)';
      peg.setAttribute('aria-pressed', String(isSelected));
      peg.setAttribute('aria-label', `${PEG_NAMES[index]}の杭、${stack.length}枚${top ? `、一番上は円盤${top}` : ''}`);

      peg.append(
        api.el('span', {
          style: 'position:absolute;left:0;right:0;top:7px;font-size:11px;color:var(--sub);pointer-events:none',
        }, PEG_NAMES[index]),
        api.el('span', {
          style: 'position:absolute;left:50%;bottom:19px;width:5px;height:164px;transform:translateX(-50%);'
            + 'border-radius:4px 4px 0 0;background:var(--line);pointer-events:none',
        }),
        api.el('span', {
          style: 'position:absolute;left:5%;right:5%;bottom:14px;height:7px;border-radius:5px;'
            + 'background:var(--sub);pointer-events:none',
        }),
      );

      // 配列の先頭が一番下。円盤番号が大きいほど幅も大きい。
      stack.forEach((disk, level) => {
        const width = 29 + (disk / diskCount) * 66;
        const isTopSelected = isSelected && level === stack.length - 1;
        peg.append(api.el('span', {
          style: `position:absolute;left:50%;bottom:${22 + level * 24}px;width:${width}%;height:21px;`
            + 'transform:translateX(-50%);display:grid;place-items:center;border:1px solid var(--ink);'
            + 'border-radius:10px;background:var(--accent);color:var(--panel);font-size:10px;font-weight:800;'
            + `box-shadow:${isTopSelected ? '0 0 0 3px var(--good)' : 'none'};pointer-events:none`,
        }, String(disk)));
      });
    }

    function draw() {
      pegs.forEach((_, i) => drawPeg(i));
      api.hud({ '手数': moves, '最小手数': minimumMoves() });
    }

    function tapPeg(index) {
      if (done) return;

      if (selected === null) {
        if (towers[index].length === 0) {
          api.sound('bad');
          setStatus('空の杭からは移せません', 'bad');
          return;
        }
        selected = index;
        api.sound('tap');
        setStatus(`${PEG_NAMES[index]}の杭を選択中。移す先をタップしてください`);
        draw();
        return;
      }

      if (selected === index) {
        selected = null;
        setStatus('選択を取り消しました');
        draw();
        return;
      }

      const from = towers[selected];
      const to = towers[index];
      const disk = from[from.length - 1];
      const destinationTop = to[to.length - 1];

      if (destinationTop !== undefined && destinationTop < disk) {
        selected = null;
        api.sound('bad');
        setStatus('大きい円盤は小さい円盤の上に置けません', 'bad');
        draw();
        return;
      }

      from.pop();
      to.push(disk);
      moves++;
      selected = null;
      api.sound('move');
      setStatus(`${PEG_NAMES[index]}の杭へ移しました`);
      draw();

      if (towers[2].length === diskCount) {
        done = true;
        const minimum = minimumMoves();
        const comparison = moves === minimum ? '最小手数ぴったり！' : `最小手数より${moves - minimum}手多い記録です`;
        setStatus(comparison, 'good');
        api.win(moves, `${diskCount}枚を${moves}手でクリア。${comparison}`);
      }
    }

    function reset() {
      towers = [[], [], []];
      for (let disk = diskCount; disk >= 1; disk--) towers[0].push(disk);
      selected = null;
      moves = 0;
      done = false;
      setStatus(`最小手数は${minimumMoves()}手です`);
      draw();
    }

    reset();

    // タイマーはないが、画面を離れた後の操作を無効にする。
    return () => { done = true; };
  },
};
