// Service Worker für Baman Games PWA
const CACHE_NAME = 'baman-games-v1';

// Bei Installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Bei Aktivierung
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Netzwerk-Anfragen durchlassen (Online-Spiel braucht immer Internet)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
