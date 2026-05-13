/* Birdie service worker — production only.
 *
 * Keeps the app shell available offline so the app can open with no signal.
 * Strategy:
 *   - Precache nothing aggressively (avoids stale-asset traps after deploys).
 *   - Network-first for navigations, falling back to a cached HTML response
 *     so /app and friends still render when the device has no connectivity.
 *   - Stale-while-revalidate for static build assets (JS/CSS/fonts/images)
 *     so reloads on flaky connections are instant once visited.
 *   - Never touch API/auth requests — Supabase calls always go to the
 *     network so we never serve stale data accidentally.
 */

const VERSION = "birdie-sw-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const NAV_FALLBACK = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(NAV_FALLBACK)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isApiRequest(url) {
  // Never intercept Supabase / auth / webhook traffic.
  return (
    url.hostname.endsWith("supabase.co") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  );
}

function isAssetRequest(request) {
  const dest = request.destination;
  return (
    dest === "script" ||
    dest === "style" ||
    dest === "font" ||
    dest === "image"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isApiRequest(url)) return; // pass through to network

  // Page navigations: network-first with shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(NAV_FALLBACK, copy)).catch(() => undefined);
          return response;
        })
        .catch(() =>
          caches
            .match(NAV_FALLBACK, { ignoreSearch: true })
            .then((cached) =>
              cached ??
              new Response(
                "<!doctype html><meta charset=\"utf-8\"><title>Birdie</title>" +
                  "<p style=\"font-family:system-ui;padding:2rem;text-align:center\">" +
                  "Ei verkkoyhteyttä. Yritä uudelleen kun yhteys palaa.</p>",
                { headers: { "content-type": "text/html; charset=utf-8" } },
              ),
            ),
        ),
    );
    return;
  }

  // Build assets: app code must be network-first so installed PWAs do not keep
  // running a stale JS bundle after a fix has shipped. Images/fonts can still
  // use stale-while-revalidate for fast offline-friendly reloads.
  if (isAssetRequest(request) && url.origin === self.location.origin) {
    if (request.destination === "script" || request.destination === "style") {
      event.respondWith(
        caches.open(ASSET_CACHE).then(async (cache) => {
          const cached = await cache.match(request);
          return fetch(request, { cache: "no-store" })
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone()).catch(() => undefined);
              }
              return response;
            })
            .catch(() => cached ?? Response.error());
        }),
      );
      return;
    }

    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone()).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? networkPromise;
      }),
    );
  }
});