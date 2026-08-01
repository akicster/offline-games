// ことばさがし — 盤面の最初と最後を選び、隠されたカタカナ語を見つける。

// 外部データがなくても遊べるよう、分野ごとの単語をこのファイル内に持つ。
const WORD_LISTS = {
  '動物': [
    'ネコ', 'イヌ', 'キリン', 'ライオン', 'ゾウ', 'トラ', 'パンダ', 'コアラ', 'サル', 'ウサギ',
    'リス', 'クマ', 'ウマ', 'シカ', 'カバ', 'サイ', 'ラクダ', 'ヒツジ', 'ヤギ', 'ウシ',
    'ブタ', 'ネズミ', 'キツネ', 'タヌキ', 'オオカミ', 'ゴリラ', 'チーター', 'ヒョウ', 'シマウマ', 'カンガルー',
    'ハムスター', 'モグラ', 'ラッコ', 'アザラシ', 'イルカ', 'クジラ', 'ペンギン', 'フクロウ', 'ワシ', 'スズメ',
  ],
  'たべもの': [
    'ラーメン', 'カレー', 'スシ', 'ウドン', 'ソバ', 'パスタ', 'ピザ', 'パン', 'ゴハン', 'オニギリ',
    'オムライス', 'ハンバーグ', 'ギョウザ', 'テンプラ', 'スキヤキ', 'タコヤキ', 'ヤキソバ', 'サンドイッチ', 'トンカツ', 'コロッケ',
    'グラタン', 'ドリア', 'シチュー', 'サラダ', 'スープ', 'ミソシル', 'ナットウ', 'トウフ', 'タマゴ', 'チーズ',
    'ヨーグルト', 'プリン', 'ケーキ', 'クッキー', 'チョコレート', 'アイス', 'リンゴ', 'ミカン', 'バナナ', 'ブドウ',
    'イチゴ', 'メロン', 'スイカ', 'モモ', 'パイナップル',
  ],
  'のりもの': [
    'デンシャ', 'ヒコウキ', 'ジドウシャ', 'バス', 'タクシー', 'トラック', 'バイク', 'ジテンシャ', 'シンカンセン', 'モノレール',
    'チカテツ', 'ロープウェイ', 'ケーブルカー', 'ヘリコプター', 'ロケット', 'フネ', 'ヨット', 'フェリー', 'ボート', 'センカン',
    'センスイカン', 'ショウボウシャ', 'キュウキュウシャ', 'パトカー', 'ブルドーザー', 'ショベルカー', 'クレーンシャ', 'トラクター', 'リニア', 'キキュウ',
    'グライダー', 'リムジン', 'ワゴン', 'ミニバン', 'スクーター', 'セスナ', 'カヌー', 'イカダ', 'ロードローラー', 'カモツセン',
  ],
  'スポーツ': [
    'サッカー', 'ヤキュウ', 'テニス', 'バスケット', 'バレーボール', 'ラグビー', 'ゴルフ', 'スイエイ', 'タッキュウ', 'バドミントン',
    'ジュウドウ', 'ケンドウ', 'カラテ', 'スモウ', 'ボクシング', 'レスリング', 'タイソウ', 'リクジョウ', 'マラソン', 'スキー',
    'スケート', 'スノーボード', 'サーフィン', 'ボウリング', 'アーチェリー', 'フェンシング', 'ハンドボール', 'ホッケー', 'ラクロス', 'ソフトボール',
    'ドッジボール', 'クリケット', 'トライアスロン', 'ダイビング', 'セーリング', 'ジョギング', 'ナワトビ', 'ツナヒキ', 'カーリング', 'テコンドー',
  ],
};

const FILLER = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォャュョッー'];

// ヨコ・タテ・ナナメの正逆、合計8方向。
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],             [0, 1],
  [1, -1],  [1, 0],   [1, 1],
];

const WORD_COUNTS = { 8: 6, 10: 8, 12: 10 };

function wordLength(word) {
  return [...word].length;
}

export default {
  mount(root, api) {
    let size = 8;
    let grid = [];
    let placements = [];
    let wordOrder = [];
    let cellButtons = [];
    let firstCell = null;
    let startedAt = 0;
    let done = false;

    const board = api.el('div', {
      role: 'grid',
      'aria-label': 'ことばさがしの盤面',
      style: 'width:min(92vw,400px);aspect-ratio:1;display:grid;touch-action:manipulation;user-select:none',
    });
    const wordHeading = api.el('div', {
      style: 'width:min(92vw,400px);font-size:12px;font-weight:700;color:var(--sub);text-align:center',
    }, '見つけることば');
    const wordList = api.el('div', {
      style: 'width:min(92vw,400px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px',
    });

    api.add(board);
    api.add(wordHeading);
    api.add(wordList);
    const status = api.note('最初の文字を押してください');

    // 各分野から順に選び、毎回なるべく分野が偏らないようにする。
    function chooseWords(count) {
      const buckets = Object.entries(WORD_LISTS).map(([category, words]) => ({
        category,
        words: api.shuffle(words.filter((word) => wordLength(word) <= size)),
      }));
      const chosen = [];
      const used = new Set();

      while (chosen.length < count) {
        for (const bucket of api.shuffle(buckets)) {
          let word = null;
          while (bucket.words.length && !word) {
            const candidate = bucket.words.pop();
            if (!used.has(candidate)) word = candidate;
          }
          if (!word) continue;
          used.add(word);
          chosen.push({ word, category: bucket.category });
          if (chosen.length === count) break;
        }
      }
      return chosen;
    }

    function availableOptions(entry, workGrid) {
      const chars = [...entry.word];
      const options = [];

      for (const [dr, dc] of DIRECTIONS) {
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            const endRow = row + dr * (chars.length - 1);
            const endCol = col + dc * (chars.length - 1);
            if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

            const cells = [];
            let overlap = 0;
            let fits = true;
            for (let i = 0; i < chars.length; i++) {
              const index = (row + dr * i) * size + col + dc * i;
              if (workGrid[index] && workGrid[index] !== chars[i]) {
                fits = false;
                break;
              }
              if (workGrid[index] === chars[i]) overlap++;
              cells.push(index);
            }
            if (fits) options.push({ cells, overlap });
          }
        }
      }

      // 重なりを優先すると盤面全体に言葉を収めやすくなる。同点内は毎回混ぜる。
      return api.shuffle(options).sort((a, b) => b.overlap - a.overlap);
    }

    function placeWords(entries) {
      const workGrid = new Array(size * size).fill(null);
      const ordered = entries.slice().sort((a, b) => wordLength(b.word) - wordLength(a.word));
      const result = [];
      let visits = 0;

      function search(index) {
        if (index === ordered.length) return true;
        if (++visits > 5000) return false;

        const entry = ordered[index];
        const chars = [...entry.word];
        const options = availableOptions(entry, workGrid).slice(0, 180);
        for (const option of options) {
          const changed = [];
          option.cells.forEach((cell, i) => {
            if (!workGrid[cell]) {
              workGrid[cell] = chars[i];
              changed.push(cell);
            }
          });

          result.push({ ...entry, cells: option.cells, found: false });
          if (search(index + 1)) return true;
          result.pop();
          for (const cell of changed) workGrid[cell] = null;
        }
        return false;
      }

      return search(0) ? { grid: workGrid, placements: result } : null;
    }

    // 通常の探索が乱数の偏りで失敗しても、各行へ確実に置ける予備配置を用意する。
    function fallbackPlacement(entries) {
      const workGrid = new Array(size * size).fill(null);
      const result = entries.map((entry, row) => {
        const chars = [...entry.word];
        const reverse = row % 2 === 1;
        const cells = chars.map((char, i) => {
          const col = reverse ? size - 1 - i : i;
          const index = row * size + col;
          workGrid[index] = char;
          return index;
        });
        return { ...entry, cells, found: false };
      });
      return { grid: workGrid, placements: result };
    }

    function createPuzzle() {
      const count = WORD_COUNTS[size];
      for (let attempt = 0; attempt < 12; attempt++) {
        const placed = placeWords(chooseWords(count));
        if (placed) return placed;
      }
      return fallbackPlacement(chooseWords(count));
    }

    function rebuildBoard() {
      board.textContent = '';
      board.style.gridTemplateColumns = `repeat(${size},minmax(0,1fr))`;
      board.style.gap = size === 12 ? '2px' : '3px';
      cellButtons = grid.map((char, index) => {
        const row = Math.floor(index / size);
        const col = index % size;
        const button = api.el('button', {
          role: 'gridcell',
          'aria-label': `${row + 1}行${col + 1}列 ${char}`,
          style: 'min-width:0;min-height:0;padding:0;display:grid;place-items:center;border:1px solid var(--line);'
            + 'border-radius:5px;background:var(--panel);color:var(--ink);font:inherit;font-weight:700;line-height:1;'
            + 'cursor:pointer;user-select:none;touch-action:manipulation',
          onclick: () => selectCell(index),
        }, char);
        button.style.fontSize = size === 8 ? 'clamp(18px,5.3vw,24px)'
          : size === 10 ? 'clamp(16px,4.2vw,20px)' : 'clamp(14px,3.5vw,18px)';
        board.append(button);
        return button;
      });
      paintBoard();
    }

    function foundCells() {
      const cells = new Set();
      for (const placement of placements) {
        if (placement.found) for (const cell of placement.cells) cells.add(cell);
      }
      return cells;
    }

    function paintBoard() {
      const marked = foundCells();
      cellButtons.forEach((button, index) => {
        if (marked.has(index)) {
          button.style.background = 'var(--good)';
          button.style.color = 'var(--accent-ink)';
          button.style.borderColor = 'var(--good)';
        } else if (index === firstCell) {
          button.style.background = 'var(--accent)';
          button.style.color = 'var(--accent-ink)';
          button.style.borderColor = 'var(--accent)';
        } else {
          button.style.background = 'var(--panel)';
          button.style.color = 'var(--ink)';
          button.style.borderColor = 'var(--line)';
        }
        button.style.boxShadow = index === firstCell ? 'inset 0 0 0 3px var(--warn)' : 'none';
        button.setAttribute('aria-pressed', String(marked.has(index) || index === firstCell));
      });
    }

    function renderWordList() {
      wordList.textContent = '';
      for (const placement of wordOrder) {
        wordList.append(api.el('div', {
          title: placement.category,
          style: 'min-width:0;padding:4px 6px;border:1px solid var(--line);border-radius:7px;background:var(--panel);'
            + `color:${placement.found ? 'var(--sub)' : 'var(--ink)'};font-size:13px;font-weight:600;text-align:center;`
            + `text-decoration:${placement.found ? 'line-through' : 'none'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`,
        }, placement.word));
      }
    }

    function updateHud() {
      const found = placements.filter((placement) => placement.found).length;
      api.hud({ '発見': `${found}/${placements.length}`, '盤面': `${size}×${size}` });
    }

    function sameEndpoints(placement, start, end) {
      const first = placement.cells[0];
      const last = placement.cells[placement.cells.length - 1];
      return (first === start && last === end) || (first === end && last === start);
    }

    function isStraight(start, end) {
      const startRow = Math.floor(start / size);
      const startCol = start % size;
      const endRow = Math.floor(end / size);
      const endCol = end % size;
      const rowDiff = Math.abs(endRow - startRow);
      const colDiff = Math.abs(endCol - startCol);
      return rowDiff === 0 || colDiff === 0 || rowDiff === colDiff;
    }

    function selectCell(index) {
      if (done) return;
      if (firstCell === null) {
        firstCell = index;
        status.textContent = '最後の文字を押してください';
        api.sound('tap');
        paintBoard();
        return;
      }

      const start = firstCell;
      firstCell = null;
      if (start === index) {
        status.textContent = '選択を取り消しました。最初の文字を押してください';
        api.sound('tap');
        paintBoard();
        return;
      }
      if (!isStraight(start, index)) {
        status.textContent = 'タテ・ヨコ・ナナメの直線で選んでください';
        api.sound('bad');
        paintBoard();
        return;
      }

      const match = placements.find((placement) => sameEndpoints(placement, start, index));
      if (!match) {
        status.textContent = 'その並びは隠された言葉ではありません';
        api.sound('bad');
        paintBoard();
        return;
      }
      if (match.found) {
        status.textContent = 'その言葉は見つけています';
        api.sound('tap');
        paintBoard();
        return;
      }

      match.found = true;
      status.textContent = `${match.word}を見つけました！`;
      api.sound('good');
      paintBoard();
      renderWordList();
      updateHud();

      if (placements.every((placement) => placement.found)) {
        done = true;
        const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
        status.textContent = 'すべての言葉を見つけました！';
        api.win(elapsed, `${size}×${size}をクリア`);
      }
    }

    function renderControls() {
      api.buttons([
        ...[8, 10, 12].map((nextSize) => ({
          label: `${nextSize}×${nextSize}`,
          primary: nextSize === size,
          onClick: () => newGame(nextSize),
        })),
        { label: '別の問題', onClick: () => newGame(size) },
      ]);
    }

    function newGame(nextSize) {
      size = nextSize;
      const puzzle = createPuzzle();
      grid = puzzle.grid.map((char) => char || api.pick(FILLER));
      placements = puzzle.placements;
      wordOrder = api.shuffle(placements);
      firstCell = null;
      done = false;
      startedAt = performance.now();
      status.textContent = '最初の文字を押してから、最後の文字を押してください';
      rebuildBoard();
      renderWordList();
      updateHud();
      renderControls();
    }

    newGame(8);

    // 外部イベントやタイマーは使っていない。終了後の入力だけ明示的に無効化する。
    return () => { done = true; };
  },
};
