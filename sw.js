// Service Worker
// アプリ本体を更新したら VERSION を変えると、古いキャッシュが入れ替わります。
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = "runtime-v1";
const IMAGE_CACHE = "images-v1";

const SHELL = [
  "./",
  "index.html",
  "config.js",
  "manifest.json",
  "css/style.css",
  "js/app.js",
  "js/router.js",
  "js/data.js",
  "js/store.js",
  "js/util.js",
  "js/placeholders.js",
  "js/views/menu.js",
  "js/views/parts.js",
  "js/views/detail.js",
  "js/views/search.js",
  "js/views/cards.js",
  "js/views/quiz.js",
  "js/views/progress.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js",
];

// localhost では常に最新ファイルを優先（開発中に古い画面が出ないように）
const DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  const keep = [SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE];
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isCsv = (url) => url.pathname.endsWith(".csv") || /docs\.google\.com|googleusercontent\.com/.test(url.hostname);

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await net) || Response.error();
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 画像：一度表示したらオフラインでも出せるように（Googleドライブの画像も含む）
  if (req.destination === "image" && !url.pathname.includes("/icons/")) {
    e.respondWith(cacheFirst(req, IMAGE_CACHE).catch(() => Response.error()));
    return;
  }

  // メニューCSVはアプリ側で localStorage にキャッシュしているので素通し
  if (isCsv(url)) return;

  // Google Fonts・CDN
  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, RUNTIME_CACHE).catch(() => Response.error()));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // ページ遷移は index.html を返す（オフライン起動用）
  if (req.mode === "navigate" && /\/(index\.html)?$/.test(url.pathname)) {
    e.respondWith(
      (DEV ? networkFirst(new Request("index.html"), SHELL_CACHE) : staleWhileRevalidate(new Request("index.html"), SHELL_CACHE))
    );
    return;
  }

  e.respondWith(DEV ? networkFirst(req, SHELL_CACHE) : staleWhileRevalidate(req, SHELL_CACHE));
});

// アプリから画像URLの一覧を受け取り、まだ無いものを裏でキャッシュ
self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "precache-images") return;
  e.waitUntil(
    caches.open(IMAGE_CACHE).then(async (cache) => {
      for (const u of e.data.urls) {
        try {
          if (await cache.match(u)) continue;
          const sameOrigin = new URL(u).origin === self.location.origin;
          const res = await fetch(u, sameOrigin ? {} : { mode: "no-cors" });
          if (res.ok || res.type === "opaque") await cache.put(u, res);
        } catch {
          /* 取得できない画像は無視 */
        }
      }
    })
  );
});
