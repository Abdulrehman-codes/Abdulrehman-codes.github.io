// Rung's service worker.
//
// Network first, always: while online every request goes to the network,
// and the page is exactly the build that is deployed. What comes back is
// copied into the cache, and the cache is read only when the network fails -
// which is what lets the installed app open with no connection, and show
// that it is offline rather than the browser's error page.
//
// An earlier build used Flutter's own worker, which served from cache first
// and picked up a deploy only on a later visit: players kept reporting bugs
// that were already fixed. Do not make this cache first.

const CACHE = 'rung-v1';

const OFFLINE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rung</title>
<style>
  html, body { background: #000; color: #F5F2EC; margin: 0; height: 100%; }
  body { display: grid; place-items: center; font: 16px system-ui, sans-serif;
         text-align: center; padding: 24px; box-sizing: border-box; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { color: #8F8B84; margin: 0 0 20px; }
  button { background: #FF7A3D; color: #17150F; border: 0; border-radius: 14px;
           font: 700 15px system-ui, sans-serif; padding: 12px 22px; }
</style></head>
<body><div>
  <h1>You are offline</h1>
  <p>Rung is played online. Connect to the internet and try again.</p>
  <button onclick="location.reload()">Try again</button>
</div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only this site's own files. The game server is another origin, and its
  // answers are live: they must never come from a cache.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        return new Response(OFFLINE, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      throw err;
    }
  })());
});
