/**
 * Production-only service worker registration.
 *
 * The service worker caches the app shell so Birdie opens with no
 * connectivity at all (think: course tee box with no signal). It is
 * intentionally NOT registered in preview/iframe contexts because service
 * workers in iframes cause stale-content and routing issues per Lovable's
 * PWA guidance.
 */

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

let registered = false;

export function registerServiceWorker() {
  if (registered) return;
  registered = true;
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // In preview/iframe: aggressively unregister any leftover SW so stale
  // caches don't poison the editor experience.
  if (isPreviewHost() || isInIframe()) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => undefined);
    return;
  }

  // Defer to keep startup snappy.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Silent failure — the app still works without a SW.
      console.warn("[birdie] service worker registration failed", err);
    });
  });
}