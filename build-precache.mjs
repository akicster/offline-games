// オフライン用のキャッシュ対象一覧を生成する。
// ゲームを追加したら必ずこれを実行すること: node build-precache.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
