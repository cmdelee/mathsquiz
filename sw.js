// Minimal offline cache for the Quiz App hub (maths practice, entry test
// practice, the read-only progress page, and the parents/admin page), so a
// session already installed on a device still opens without a live
// internet connection. Question generation and history are local anyway;
// this just caches the app shell (not the Google Fonts request, which
// falls through to network).
var CACHE_NAME = "quiz-app-v3";
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./maths-quiz.html",
  "./entry-test.html",
  "./stats.html",
  "./admin.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  // Only handle same-origin requests; let cross-origin (Google Fonts) go straight to network.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});
