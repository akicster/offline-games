// Service Worker — 一度開けば、以後は完全にオフラインで遊べるようにする。
//
// 方針:
//   install で全ファイルを取り込む（初回訪問の時点で全ゲームが遊べる状態にする）
//   fetch はキャッシュ優先。ネットが無くても必ず返す。
//   版が変われば古いキャッシュを捨てる。

// この行は build-precache.mjs が毎回書き換える。
// ブラウザは sw.js のバイト列が変わったときだけ「新しい Service Worker」と判断するため、
// 版番号は precache.js ではなく必ずこのファイル自身に埋め込む必要がある。
const BUILD = 'v8269cb62e40c';

importScripts('precache.js');

const CACHE = 'offline-games-' + BUILD;

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 1つでも失敗すると addAll 全体が落ちるため、個別に入れて取りこぼしを許容する
    await Promise.all(self.PRECACHE_FILES.map(async (f) => {
      try { await cache.add(new Request(f, { cache: 'reload' })); } catch { /* 取得できないものは飛ばす */ }
    }));
    // ここで skipWaiting はしない。
    // すぐ切り替えると、古いページが動いている最中に新しいファイルが返り、
    // 版が混ざった状態になる。切り替えは利用者が「更新」を押した時だけ行う。
  })());
});

// 画面側から「更新」を押されたときだけ、新しい版に切り替える
self.addEventListener('message', (ev) => {
  if (ev.data && ev.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) {
      // 裏で静かに更新しておく（オンラインのときだけ）
      ev.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        } catch { /* オフラインなら何もしない */ }
      })());
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      // ページ遷移の失敗はトップに逃がす
      if (req.mode === 'navigate') {
        const shell = await cache.match('./');
        if (shell) return shell;
      }
      return new Response('オフラインです', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  })());
});
