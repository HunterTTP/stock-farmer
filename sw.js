const CACHE_NAME = "stock-farmer-v2";
const BASE_URL = self.location.href.replace(/sw\.js$/, "");
const OFFLINE_ASSETS = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "assets/css/main.css",
  "assets/js/app.js",
  "assets/js/pwa.js",
  "assets/js/firebase-auth.js",
  "images/logo/logo.png",
  "images/logo/favicon.ico"
].map((path) => new URL(path, BASE_URL).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone)).catch(() => {});
          return resp;
        })
        .catch(() => cached);
    })
  );
});
