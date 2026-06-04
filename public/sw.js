// Simple Service Worker for QR Code Attendance System PWA Installation
const CACHE_NAME = 'qr-attendance-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/icon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy for dynamic fetching, fallback to cache for offline capabilities
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS, skip other schemes (e.g. chrome-extension)
  if (!event.request.url.startsWith('http')) return;

  // Bypass database or API calls to require real network
  if (event.request.url.includes('firestore') || event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
