
const CACHE_NAME = "my-website-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: Cache essential files without deleting existing cached copies
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.all(
        APP_FILES.map(async (file) => {
          const url = new URL(file, self.registration.scope);

          try {
            const response = await fetch(url, {
              cache: "reload"
            });

            // Only replace cache when the server returns a valid file
            if (response.ok) {
              await cache.put(url.href, response);
            }
          } catch (error) {
            console.log("Could not update cached file:", file);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

// Activate: Keep the current cache and remove other versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

// Fetch: Network first for pages, cache first for other files
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Page navigation
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const response = await fetch(request);

          if (response.ok) {
            await cache.put(request, response.clone());
            return response;
          }

          // Server returned 404 or another unsuccessful response
          const cachedPage = await cache.match(request);

          if (cachedPage) return cachedPage;

          const cachedHome = await cache.match(
            new URL("./index.html", self.registration.scope).href
          );

          if (cachedHome) return cachedHome;

          return response;

        } catch (error) {
          // Network unavailable: use cached page
          const cachedPage = await cache.match(request);

          if (cachedPage) return cachedPage;

          const cachedHome = await cache.match(
            new URL("./index.html", self.registration.scope).href
          );

          if (cachedHome) return cachedHome;

          return new Response("Offline - Page not available", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          });
        }
      })()
    );

    return;
  }

  // Images, CSS, JS and other same-origin files
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (response.ok) {
          await cache.put(request, response.clone());
        }

        return response;

      } catch (error) {
        return new Response("Offline - File not available", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })()
  );
});
