/* Network first; each installed FitDay app owns its own offline cache. */
const SCOPE = self.registration.scope;
const PREFIX = "fitday-cache-" + encodeURIComponent(new URL(SCOPE).pathname) + "-";
const CACHE = PREFIX + "v25";
const ASSETS = [
  "./", "./index.html", "./css/style.css?v=25",
  "./js/data-foods.js?v=25", "./js/data-exercises.js?v=25",
  "./js/data-courses.js?v=25", "./js/data-videos.js?v=25",
  "./js/qrcode.min.js?v=25", "./js/ex-anim.js?v=25",
  "./js/engine.js?v=25", "./js/achievements.js?v=25",
  "./js/views.js?v=25", "./js/app.js?v=25",
  "./manifest.webmanifest", "./icons/icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(SCOPE)) return;
  const response = fetch(event.request, { cache: "no-cache" });
  event.waitUntil(response.then(res => {
    if (res.ok) {
      const copy = res.clone();
      return caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
  }).catch(() => {}));
  event.respondWith(response.catch(async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    if (hit) return hit;
    if (event.request.mode === "navigate") {
      const page = await cache.match(new URL("index.html", SCOPE).href);
      if (page) return page;
    }
    return Response.error();
  }));
});
