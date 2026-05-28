/* AI Invoice PWA Service Worker */
const CACHE_VERSION = "ai-invoice-v1.0.7-ai-look";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",

  /* Existing project files. Missing files are ignored during install. */
  "./css/style.css",
  "./js/utils.js",
  "./js/invoice-generator.js",
  "./js/pdf-export.js",
  "./js/main.js",
  "./js/pwa.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("ai-invoice-") && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (request.method === "GET" && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || caches.match("./offline.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (request.method === "GET" && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match("./offline.html");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const accept = request.headers.get("accept") || "";

  if (request.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    request.url.includes("cdn.jsdelivr.net") ||
    request.url.includes("cdnjs.cloudflare.com") ||
    request.url.includes("fonts.googleapis.com") ||
    request.url.includes("fonts.gstatic.com")
  ) {
    event.respondWith(cacheFirst(request));
  }
});
