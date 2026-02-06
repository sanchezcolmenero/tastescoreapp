// Service Worker for TasteScore PWA
const CACHE_NAME = 'tastescore-v2'; // Incrementado para forzar limpieza
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches AND remove share-modal.js
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Clear any cached share-modal.js
      caches.open(CACHE_NAME).then(cache => {
        return cache.delete('./share-modal.js');
      })
    ])
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Block share-modal.js explicitly
  if (event.request.url.includes('share-modal.js')) {
    event.respondWith(new Response('', { status: 404 }));
    return;
  }

  // Skip non-GET requests (like POST to Supabase)
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Supabase API calls
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Return offline page or default response if available
          return caches.match('./index.html');
        });
      })
  );
});

