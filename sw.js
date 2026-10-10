/* Service Worker（由 tools/build_pages.py 以此模板產生 sw.js，請改這個檔案而不是 sw.js）
 * 策略：
 *  - 安裝時預先快取「遊戲本體」（網頁、程式、樣式、圖示），讓沒有網路時也能開啟。
 *  - 圖片：先看快取、沒有再上網抓並存起來（看過的圖片之後就不用再下載）。
 *  - 其他檔案：先上網抓最新版（確保更新），沒網路才用快取。
 *  - 版本號由檔案內容雜湊決定；內容一變，舊快取會自動清掉。
 */
const SHELL_CACHE = 'puzzle-shell-85943459f5';
const IMG_CACHE = 'puzzle-img-1292aaadd7';
const SHELL_FILES = ["./", "index.html", "about.html", "parents.html", "privacy.html", "style.css", "pages.css", "app.js", "images.js", "ads.js", "ads-config.js", "manifest.webmanifest", "c/animal.html", "c/bug.html", "c/dino.html", "c/festival.html", "c/food.html", "c/fruit.html", "c/job.html", "c/learn.html", "c/life.html", "c/music.html", "c/nature.html", "c/ocean.html", "c/space.html", "c/sport.html", "c/story.html", "c/vehicle.html", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon.svg"];

self.addEventListener('install', (e) => {
  // cache:'reload' 跳過瀏覽器的 HTTP 快取，確保預先快取的一定是這個版本的檔案（不會把舊檔存進新版快取）
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => (k.startsWith('puzzle-shell-') && k !== SHELL_CACHE) || (k.startsWith('puzzle-img-') && k !== IMG_CACHE))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isImage = (url) => /\/images\/[^/]+\.svg$/.test(url.pathname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // 不碰第三方（例如廣告）的請求

  if (isImage(url)) {                                          // 圖片：快取優先
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(IMG_CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  e.respondWith(                                               // 其他：網路優先，離線時退回快取
    // cache:'no-cache'：每次都向伺服器確認有沒有新版（沒變動只回 304、很省流量），避免拿到舊檔
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok && !url.search) { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || (req.mode === 'navigate' ? caches.match(new URL('index.html', self.registration.scope).href) : Response.error())))
  );
});

// 頁面請求「下載全部圖片供離線使用」：分批下載並回報進度
self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'cache-images' || !Array.isArray(d.urls)) return;
  const port = e.ports && e.ports[0];
  e.waitUntil((async () => {
    const cache = await caches.open(IMG_CACHE);
    let done = 0, failed = 0;
    for (let i = 0; i < d.urls.length; i += 8) {
      await Promise.all(d.urls.slice(i, i + 8).map(async (u) => {
        try {
          if (!(await cache.match(u))) { const r = await fetch(u); if (r.ok) await cache.put(u, r); else failed++; }
        } catch (_) { failed++; }
        done++;
      }));
      if (port) port.postMessage({ done, total: d.urls.length, failed });
    }
    if (port) port.postMessage({ done, total: d.urls.length, failed, finished: true });
  })());
});
