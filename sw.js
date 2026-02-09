// Service Worker for TasteScore PWA - Anti share-modal.js + Auto-update
const CACHE_NAME = 'tastescore-v5'; // Incrementar con cada actualización
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Lista negra de archivos
const BLOCKED_FILES = ['share-modal.js', 'share-modal'];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker v4');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[SW] Cache install failed:', err);
      })
  );
  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Activate event - clean old caches AND remove share-modal.js
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker v4');
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Clear any cached share-modal.js from ALL caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            return caches.open(cacheName).then(cache => {
              return cache.keys().then(requests => {
                return Promise.all(
                  requests.map(request => {
                    if (BLOCKED_FILES.some(blocked => request.url.includes(blocked))) {
                      console.log('[SW] 🚫 Removing blocked file from cache:', request.url);
                      return cache.delete(request);
                    }
                  })
                );
              });
            });
          })
        );
      })
    ])
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Block share-modal.js explicitly - return 404
  if (BLOCKED_FILES.some(blocked => url.includes(blocked))) {
    console.log('[SW] 🚫 BLOCKED request to:', url);
    event.respondWith(
      new Response('// File blocked by service worker', {
        status: 404,
        statusText: 'Blocked by SW',
        headers: { 'Content-Type': 'application/javascript' }
      })
    );
    return;
  }

  // Skip non-GET requests (like POST to Supabase)
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Supabase API calls
  if (url.includes('supabase.co')) {
    return;
  }
  
  // Skip external CDN calls
  if (url.includes('cdn.jsdelivr.net') || 
      url.includes('unpkg.com') || 
      url.includes('cdnjs.cloudflare.com')) {
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

// Message handler para limpiar cache manualmente
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

// Notify clients when a new version is available
self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim().then(() => {
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: CACHE_NAME
          });
        });
      });
    })
  );
});

