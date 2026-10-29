// VANTS — Service worker de migración.
// La web antigua (SPA) fue eliminada: este script borra el service worker
// anterior y TODAS sus caches la primera vez que el navegador lo comprueba.
// La nueva web (index.html) no registra ningún service worker.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
