/* ===================== sw.js =====================
   Cache-first for the app shell, network-first for navigations,
   pass-through for Supabase / external APIs.
   ==================================================== */

const VERSION   = 'v6';
const SHELL     = 'shell-' + VERSION;
const RUNTIME   = 'runtime-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './main.css',
  './core.js',
  './ui.js',
  './app.js',
  './config.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
  /* screenshots are optional — omit from precache to save bandwidth */
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* ── Never cache Supabase / external APIs ── */
  if (url.hostname.endsWith('supabase.co') || url.origin !== self.location.origin) {
    return; // let the network handle it
  }

  /* ── Navigations: network-first, fallback to cached shell ── */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* ── Static assets: cache-first, then network ── */
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(RUNTIME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});