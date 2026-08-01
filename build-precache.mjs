// オフライン用のキャッシュ対象一覧を生成する。
// ゲームを追加したら必ずこれを実行すること: node build-precache.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['serve.mjs', 'build-precache.mjs', 'precache.js', 'sw.js']);

// 宣伝用の画像などはアプリ本体ではないのでキャッシュ対象から外す
const SKIP_DIRS = new Set(['node_modules', 'promo', 'docs']);

function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (!SKIP.has(rel)) out.push(rel);
  }
  return out;
}

const files = walk(ROOT).filter((f) => /\.(html|js|css|webmanifest|svg|png|json)$/.test(f)).sort();

// ---------------------------------------------------------------------------
// 整合性チェック
//
// 一覧に載っているのに実装ファイルが無いと、本番で「読み込めませんでした」になる。
// 一度これを公開してしまったので、人の注意ではなくビルドで止める。
// ---------------------------------------------------------------------------
{
  // 正規表現で読み取ると取りこぼすので、実際に読み込んで確かめる
  const { GAMES, CATS } = await import(pathToFileURL(path.join(ROOT, 'games', 'manifest.js')).href);
  const gameIds = GAMES.map((g) => g.id);
  const catIds = new Set(CATS.map((c) => c.id));

  const problems = [];
  for (const g of GAMES) {
    if (!g.name || !g.desc) problems.push(`${g.id} に name か desc が無い`);
    if (!catIds.has(g.cat)) problems.push(`${g.id} のカテゴリ '${g.cat}' は CATS に無い`);
    if (![null, 'high', 'low', 'time'].includes(g.best ?? null)) problems.push(`${g.id} の best が不正: ${g.best}`);
  }
  const dup = gameIds.filter((id, i) => gameIds.indexOf(id) !== i);
  if (dup.length) problems.push(`id が重複: ${[...new Set(dup)].join(', ')}`);

  for (const id of gameIds) {
    const f = path.join(ROOT, 'games', `${id}.js`);
    if (!fs.existsSync(f)) { problems.push(`一覧に ${id} があるが games/${id}.js が無い`); continue; }
    const body = fs.readFileSync(f, 'utf8');
    if (!/export\s+default/.test(body)) problems.push(`games/${id}.js に export default が無い`);
    else if (!/mount\s*\(/.test(body)) problems.push(`games/${id}.js に mount が無い`);
  }
  // 逆向き: 実装があるのに一覧に無いものは、載せ忘れの可能性が高いので知らせる
  for (const f of fs.readdirSync(path.join(ROOT, 'games'))) {
    if (!f.endsWith('.js') || f === 'manifest.js') continue;
    const id = f.replace(/\.js$/, '');
    if (!gameIds.includes(id)) console.warn(`注意: games/${f} は一覧に載っていません`);
  }

  if (problems.length) {
    console.error('整合性エラー（このまま公開すると本番が壊れます）:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  console.log(`整合性チェック: ${gameIds.length}本すべてに実装があります`);
}

// 中身が1バイトでも変われば必ず版が変わるよう、全ファイルの内容ハッシュを版番号にする。
// （合計サイズだと、増減が相殺したときに版が据え置きになり、古いキャッシュが残る）
const h = crypto.createHash('sha256');
for (const f of files) { h.update(f); h.update(fs.readFileSync(path.join(ROOT, f))); }
const stamp = h.digest('hex').slice(0, 12);

const body = `// 自動生成。直接編集しないこと（node build-precache.mjs で再生成）
self.PRECACHE_VERSION = 'v${stamp}';
self.PRECACHE_FILES = ${JSON.stringify(['./', ...files], null, 2)};
`;
fs.writeFileSync(path.join(ROOT, 'precache.js'), body, 'utf8');

// sw.js 自身にも版番号を埋め込む。
// ブラウザは sw.js のバイト列が変わったときにだけ更新を検知するため、これを忘れると
// 新しいゲームを追加しても利用者に永久に届かない。
const swPath = path.join(ROOT, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
const patched = sw.replace(/^const BUILD = '.*';$/m, `const BUILD = 'v${stamp}';`);
if (patched === sw && !sw.includes(`const BUILD = 'v${stamp}';`)) {
  console.error('警告: sw.js に "const BUILD = \'...\';" の行が見つかりません。更新検知が壊れます。');
  process.exitCode = 1;
} else {
  fs.writeFileSync(swPath, patched, 'utf8');
}

console.log(`precache.js と sw.js を更新: ${files.length}ファイル / 版 v${stamp}`);
