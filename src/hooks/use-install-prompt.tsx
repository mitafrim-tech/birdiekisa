import { useEffect, useState, useCallback } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "birdie:installedAt";
const LAST_BIP_KEY = "birdie:lastBeforeInstallPromptAt";

let sharedDeferred: BIPEvent | null = null;
let sharedFreshPromptTick = 0;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function isPreviewContext() {
  if (typeof window === "undefined") return true;
  if (isInIframe()) return true;
  const host = window.location.hostname;
  return (
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
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

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Centralised install-prompt state.
 * - Tracks the BeforeInstallPromptEvent for Android/Chromium browsers.
 * - Detects iOS Safari (no native prompt — manual instructions only).
 * - Hides everything once the app is running in standalone mode.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(() => sharedDeferred);
  const [standalone, setStandalone] = useState<boolean>(() => isStandalone());
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  // Increments whenever the browser fires a fresh `beforeinstallprompt`,
  // signalling that the device is once again installable (e.g. after an
  // uninstall). Consumers can watch this to clear their own snooze state.
  const [freshPromptTick, setFreshPromptTick] = useState(sharedFreshPromptTick);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());
    setAndroid(isAndroid());
    setDeferred(sharedDeferred);
    setFreshPromptTick(sharedFreshPromptTick);

    const syncFromSharedState = () => {
      setDeferred(sharedDeferred);
      setFreshPromptTick(sharedFreshPromptTick);
    };
    listeners.add(syncFromSharedState);

    const onBIP = (e: Event) => {
      e.preventDefault();
      sharedDeferred = e as BIPEvent;
      // Detect "fresh" signals: if more than 1 minute has passed since the
      // last BIP we treat it as a new installability window (covers reload
      // after uninstall). Always tick on first event in a session.
      try {
        const last = Number(window.localStorage.getItem(LAST_BIP_KEY) ?? 0);
        const now = Date.now();
        if (!last || now - last > 60_000) {
          sharedFreshPromptTick += 1;
        }
        window.localStorage.setItem(LAST_BIP_KEY, String(now));
      } catch {
        sharedFreshPromptTick += 1;
      }
      notifyListeners();
    };
    const onInstalled = () => {
      sharedDeferred = null;
      setStandalone(true);
      try {
        window.localStorage.setItem(INSTALLED_KEY, String(Date.now()));
      } catch {
        // ignore storage failures
      }
      notifyListeners();
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
      listeners.delete(syncFromSharedState);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return null;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    sharedDeferred = null;
    notifyListeners();
    return outcome;
  }, [deferred]);

  const canInstall = !standalone && !isPreviewContext() && (Boolean(deferred) || ios || android);

  return {
    canInstall,
    standalone,
    ios,
    android,
    hasNativePrompt: Boolean(deferred),
    freshPromptTick,
    promptInstall,
  };
}
