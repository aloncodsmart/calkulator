// Generated at build time – do not edit.
const CACHE = 'smart-math-1792578002785-f914e563888c';
const ASSETS = ["./","./apple-touch-icon.png","./assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","./assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","./assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","./assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","./assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","./assets/KaTeX_Main-Bold-Cx986IdX.woff2","./assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","./assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","./assets/KaTeX_Main-Regular-B22Nviop.woff2","./assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","./assets/KaTeX_Math-Italic-t53AETM-.woff2","./assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","./assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","./assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","./assets/KaTeX_Script-Regular-D3wIWfF6.woff2","./assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","./assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","./assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","./assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2","./assets/error-BTdmRKoB.js","./assets/esm-CXfplTRZ.js","./assets/esm-DjU4vt9I.js","./assets/esm-DrO23oXW.js","./assets/index-DgLs9byv.js","./assets/index-gExLNgSJ.css","./assets/node.browser-HQ5SKBOf.js","./assets/node.browser-QiJ1QG15.js","./assets/rubik-arabic-wght-normal-CGnJ-sf6.woff2","./assets/rubik-cyrillic-ext-wght-normal-BjodpZir.woff2","./assets/rubik-cyrillic-wght-normal-DveCct9I.woff2","./assets/rubik-hebrew-wght-normal-BIkpbuMU.woff2","./assets/rubik-latin-ext-wght-normal-OacczzuJ.woff2","./assets/rubik-latin-wght-normal-CnQIisVs.woff2","./assets/sdk-CnxoTBcX.js","./assets/web-CZSlm-Y5.js","./assets/web-D4tEaTjE.js","./assets/web-DHdu1E4n.js","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icon.svg","./index.html","./manifest.webmanifest"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

const builtAt = (name) => Number(name.split('-')[2]) || 0;

// Deletes only copies of versions built before this one. A newer version may be installing
// at the same moment, and its files must not be touched.
const dropOldVersions = () =>
  caches
    .keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('smart-math-') && builtAt(k) < builtAt(CACHE)).map((k) => caches.delete(k))));

self.addEventListener('activate', (event) => {
  // The previous version's files stay for now: a page that is still running it may lazy-load
  // its own chunks (the Claude SDK, fonts), which are already gone from the server.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only the app's own files; calls to the Claude API go straight to the network.
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match('./index.html'))
        .then((hit) => hit || fetch(req)),
    );
    // A new page load replaces the old page, so older versions are no longer needed.
    event.waitUntil(dropOldVersions());
    return;
  }
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(req, { ignoreSearch: true }))
      // a page still running the previous version finds its own files in that version's copy
      .then((hit) => hit || caches.match(req, { ignoreSearch: true }))
      .then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
  );
});
