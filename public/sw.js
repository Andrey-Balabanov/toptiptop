/* Service worker: lets the installed app open offline.
 *
 * Network-first for the app's own files (so a deploy is picked up on the next
 * load, never a stale mix), falling back to the last cached copy when offline.
 * API calls are never cached — progress made offline is queued by api.js.
 */

const CACHE = 'toptiptop-v8';

// On a local dev server the offline cache only hides freshly edited files: a worker
// installed there earlier deletes its cache, unregisters and reloads open pages.
const LOCAL_DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);
const SHELL = [
  '/', '/css/style.css', '/manifest.webmanifest',
  '/js/main.js', '/js/api.js', '/js/auth.js', '/js/i18n.js', '/js/state.js', '/js/texts.js',
  '/js/progress.js', '/js/effects.js', '/js/sound.js', '/js/shift.js', '/js/arrows.js',
  '/js/course.js', '/js/daily.js', '/js/stats.js', '/js/onboarding.js', '/js/share.js',
  '/js/challenge.js', '/js/social.js', '/js/analytics.js',
  '/js/keyboard.js', '/js/textView.js', '/js/menuWidgets.js', '/js/achTooltip.js', '/js/levelMap.js',
  '/js/animal.js', '/js/chat.js', '/js/skins.js',
  '/js/locales/de.js', '/js/locales/fr.js', '/js/locales/es.js', '/js/locales/it.js',
  '/js/locales/pt.js', '/js/locales/pl.js',
  '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  if (LOCAL_DEV) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE)
      // One missing file must not break installation
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  if (LOCAL_DEV) {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then(clients => clients.forEach(client => client.navigate(client.url)))
    );
    return;
  }
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (LOCAL_DEV || req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('/') : undefined)))
  );
});
