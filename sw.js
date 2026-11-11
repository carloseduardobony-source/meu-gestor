const CACHE_NAME = 'gestor-financeiro-v7-definitivo';
const urlsToCache = [
  './index.html',
  './style.css',
  './manifest.json',
  './js/logos.js',
  './js/charts.js',
  './js/database.js',
  './js/services.js',
  './js/ui_common.js',
  './js/ui1.js',
  './js/ui2.js',
  './js/ui3.js',
  './js/ui4.js',
  './js/ui5.js',
  './js/app.js'
];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
