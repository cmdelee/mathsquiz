// Minimal offline cache for the Quiz App hub (maths practice, entry test
// practice, the read-only progress page, and the parents/admin page), so a
// session already installed on a device still opens without a live
// internet connection. Question generation and history are local anyway;
// this just caches the app shell (not the Google Fonts request, which
// falls through to network).
var CACHE_NAME = "quiz-app-v8";
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./maths-quiz.html",
  "./entry-test.html",
  "./mythology.html",
  "./stats.html",
  "./admin.html",
  "./help.html",
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

  // Network-first, cache as an offline fallback only. This used to be
  // cache-first-then-revalidate: it returned whatever was already cached
  // immediately and only updated the cache in the background for *next*
  // time, which meant a page (and everything baked into it - the question
  // bank, answer-checking rules, all of it) could keep showing content
  // from an old deploy for a while even after a hard refresh. Network-first
  // means every load while online gets the current version straight away;
  // the cache only gets used when the network request actually fails.
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      })
      .catch(function () { return caches.match(event.request); })
  );
});
