// 手帐工作台 Service Worker：应用壳缓存（离线可开），API 永远直连网络
const CACHE = 'journal-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 跨域（GitHub API 等）永远直连，绝不拦截缓存
  if (url.pathname.includes('/api/')) return; // 云同步 API 不缓存
  if (e.request.method !== 'GET') return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 页面导航：网络优先，失败回退缓存（保证离线可打开，同时能拿到新版本）
    if (e.request.mode === 'navigate') {
      try {
        const fresh = await fetch(e.request);
        if (fresh.ok) await cache.put('./', fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await cache.match('./');
        if (cached) return cached;
        throw err;
      }
    }
    // 静态资源：缓存优先
    const cached = await cache.match(e.request);
    if (cached) return cached;
    const resp = await fetch(e.request);
    if (resp.ok) cache.put(e.request, resp.clone());
    return resp;
  })());
});
