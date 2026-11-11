
const CACHE_NAME = 'gestor-financeiro-v3-conciliacao';
const urlsToCache = [
  './index.html',
  './style.css',
  './manifest.json',
  './js/database.js',
  './js/services.js',
  './js/ui_common.js',
  './js/ui1.js',
  './js/ui2.js',
  './js/ui3.js',
  './js/ui4.js',
  './js/app.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
