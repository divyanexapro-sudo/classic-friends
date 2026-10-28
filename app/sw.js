/* Classic Friends service worker — caches the app shell so it opens instantly; realtime data always goes to the network */
const CACHE = 'classicfriends-shell-v2';
const SHELL = ['./', 'index.html', 'css/fonts.css', 'css/tokens.css', 'css/base.css', 'css/components.css', 'css/screens.css', 'assets/logo.svg', 'manifest.webmanifest',
  '../shared/catalog.js', '../shared/avatar.js', '../shared/engine.js', '../shared/bots.js',
  'js/config.js', 'js/state.js', 'js/ui.js', 'js/net/mock-client.js', 'js/net/socket-client.js', 'js/voice/webrtc.js',
  'js/screens/auth.js', 'js/screens/home.js', 'js/screens/room.js', 'js/screens/social.js', 'js/screens/profile.js', 'js/screens/economy.js', 'js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/socket.io/') || url.pathname.includes('/api/')) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => { if (res.ok && url.origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })));
});
