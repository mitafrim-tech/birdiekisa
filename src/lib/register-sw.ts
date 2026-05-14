/**
 * Production-only service worker registration.
 *
 * The service worker caches the app shell so Birdie opens with no
 * connectivity at all (think: course tee box with no signal). It is
 * intentionally NOT registered in preview/iframe contexts because service
 * workers in iframes cause stale-content and routing issues per Lovable's
 * PWA guidance.
 *
 * When a new version of the app is deployed, we surface a sonner toast so
 * the user can reload to pick up the new JS bundle. Without that prompt,
 * installed PWAs can keep running stale code for surprisingly long.
 */
import { toast } from "sonner";

/**
 * Surface a persistent toast asking the user to reload. The action button
 * triggers a hard reload, which makes the just-activated service worker
 * serve the fresh navigation and the new asset bundle.
 */
function promptForUpdate(worker: ServiceWorker) {
  // Tell the waiting worker to take over now. clients.claim() inside the
  // SW's activate handler then makes it the controller for this page, so
  // the upcoming reload is served by the new worker.
  worker.postMessage({ type: "SKIP_WAITING" });
  toast("Uusi versio saatavilla", {
    description: "Lataa sivu uudelleen päivittääksesi.",
    duration: Infinity,
    action: {
      label: "Päivitä",
      onClick: () => window.location.reload(),
    },
  });
}

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
    host.includes("id-preview--") || host.includes("lovableproject.com") || host === "localhost" || host === "127.0.0.1"
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
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update().catch(() => undefined);
        // If a new worker was already installed and waiting when we
        // registered (e.g. user reopened the PWA after a deploy), surface
        // the prompt right away. We only do this when there is an existing
        // controller — on a first install there's no "old" version to
        // upgrade from, so a toast would be confusing.
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptForUpdate(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              promptForUpdate(worker);
            }
          });
        });
      })
      .catch((err) => {
        // Silent failure — the app still works without a SW.
        console.warn("[birdie] service worker registration failed", err);
      });
  });
}
