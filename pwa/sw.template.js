// RippleFlow service worker. Written by hand (no libraries). The build fills in VERSION and FILES.
// - Install: cache every file of this build, so the app opens with no network.
// - Activate: delete caches from older builds.
// - Page loads: try the network first so updates arrive at once; offline, use the cached page.
// - Other files: cached copy first (their names change with every build), else the network.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = 'rippleflow-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rippleflow-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); } return res; })
      .catch(() => caches.match('./', { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
