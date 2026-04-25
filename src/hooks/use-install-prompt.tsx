import { useEffect, useState, useCallback } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "birdie:installedAt";
const LAST_BIP_KEY = "birdie:lastBeforeInstallPromptAt";

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mql || iosStandalone);
}

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

/**
 * Centralised install-prompt state.
 * - Tracks the BeforeInstallPromptEvent for Android/Chromium browsers.
 * - Detects iOS Safari (no native prompt — manual instructions only).
 * - Hides everything once the app is running in standalone mode.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [standalone, setStandalone] = useState<boolean>(() => isStandalone());
  const [ios, setIos] = useState(false);
  // Increments whenever the browser fires a fresh `beforeinstallprompt`,
  // signalling that the device is once again installable (e.g. after an
  // uninstall). Consumers can watch this to clear their own snooze state.
  const [freshPromptTick, setFreshPromptTick] = useState(0);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      // Detect "fresh" signals: if more than 1 minute has passed since the
      // last BIP we treat it as a new installability window (covers reload
      // after uninstall). Always tick on first event in a session.
      try {
        const last = Number(window.localStorage.getItem(LAST_BIP_KEY) ?? 0);
        const now = Date.now();
        if (!last || now - last > 60_000) {
          setFreshPromptTick((t) => t + 1);
        }
        window.localStorage.setItem(LAST_BIP_KEY, String(now));
      } catch {
        setFreshPromptTick((t) => t + 1);
      }
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
      try {
        window.localStorage.setItem(INSTALLED_KEY, String(Date.now()));
      } catch {
        // ignore storage failures
      }
    };
    const mql = window.matchMedia?.("(display-mode: standalone)");
    const onModeChange = () => setStandalone(isStandalone());

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    mql?.addEventListener?.("change", onModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      mql?.removeEventListener?.("change", onModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return null;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  // Hide on Lovable preview / iframes — install isn't useful there.
  const isPreviewContext = (() => {
    if (typeof window === "undefined") return true;
    if (isInIframe()) return true;
    const host = window.location.hostname;
    return (
      host.includes("lovable.app") ||
      host.includes("lovableproject.com") ||
      host === "localhost"
    );
  })();

  const canInstall = !standalone && !isPreviewContext && (Boolean(deferred) || ios);

  return {
    canInstall,
    standalone,
    ios,
    hasNativePrompt: Boolean(deferred),
    freshPromptTick,
    promptInstall,
  };
}