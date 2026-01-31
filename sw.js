// TasteScore Service Worker v1
const CACHE_NAME = 'tastescore-pwa-v1';

// Recursos a cachear al instalar
const STATIC_ASSETS = [
  'index.html',
  'manifest.json',
  'sw.js'
];

// INSTALAR: cachear archivos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando recursos estáticos...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activa inmediatamente sin esperar a que cierre la pestaña anterior
  self.skipWaiting();
});

// ACTIVAR: limpiar cachés viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando caché viejo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Toma control inmediatamente de todas las pestañas
  self.clients.claim();
});

// INTERCEPTAR peticiones (estrategia Network First para APIs, Cache First para estáticos)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Peticiones a APIs externas → Network First (intenta red, si falla usa caché)
  if (url.hostname === 'world.openfoodfacts.org' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'unpkg.com') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Recursos propios → Cache First (usa caché, si no hay va a red)
  event.respondWith(cacheFirst(request));
});

// Estrategia Cache First
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    // Solo cachear respuestas exitosas
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Error en red:', error);
    // Si no hay caché ni red, mostrar página offline
    const cache = await caches.open(CACHE_NAME);
    const offlinePage = await cache.match('index.html');
    return offlinePage || new Response('Sin conexión', { status: 503 });
  }
}

// Estrategia Network First
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Cachear respuestas exitosas de APIs
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Sin red, usando caché para:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Sin conexión' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
