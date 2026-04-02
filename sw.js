// SoundFree Service Worker
// Cachea el shell de la app para que abra instantáneo sin internet
const CACHE = 'soundfree-v1';
const SHELL = [
  '/index.html',
  '/manifest.json',
];

// Instalar: cachear el shell
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: shell desde cache, el resto desde red
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // No interceptar llamadas a APIs externas (YouTube, Firebase, Netlify Functions)
  const external = [
    'youtube.com', 'youtu.be', 'ytimg.com',
    'googleapis.com', 'firebaseio.com',
    'lrclib.net', 'lyrics.ovh', 'peerjs.com',
    'fonts.googleapis.com', 'fonts.gstatic.com',
    'netlify.app', '.netlify'
  ];
  if (external.some(d => url.hostname.includes(d))) {
    return; // dejar pasar sin interceptar
  }

  // Para Netlify Functions tampoco interceptar
  if (url.pathname.startsWith('/.netlify/')) return;

  // Para el resto: cache-first con fallback a red
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cachear solo respuestas válidas del mismo origen
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Sin red y sin cache: devolver index.html para SPA
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
