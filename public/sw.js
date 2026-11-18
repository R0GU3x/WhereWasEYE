const BUILD_VERSION = new URL(self.location.href).searchParams.get("v") || "local"
const CACHE_NAME = `wherewaseye-static-${BUILD_VERSION}`
const OFFLINE_URL = "/offline.html"
const PRECACHE_URLS = [OFFLINE_URL, "/wwe-128x128.png", "/wwe-192x192.png", "/wwe-512x512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("wherewaseye-") && key !== CACHE_NAME).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]))
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    }).catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))))
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    })))
  }
})
