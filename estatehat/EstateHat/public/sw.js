const APP_CACHE = "estatehat-app-v4";
const RUNTIME_CACHE = "estatehat-runtime-v4";
const APP_SHELL = ["/", "/start.html", "/home.html", "/signin.html", "/manifest.webmanifest", "/icons/estatehat-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && (request.mode === "navigate" || url.pathname.startsWith("/assets/"))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(() => cached || caches.match("/start.html") || caches.match("/"));

        return cached || fetchPromise;
      })
    );
  }
});
