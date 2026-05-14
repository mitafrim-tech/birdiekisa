import { useEffect, useState, useCallback } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "birdie:installedAt";
const LAST_BIP_KEY = "birdie:lastBeforeInstallPromptAt";
// Set when the user (on iOS, where we can't auto-detect) tells us the app is
// already installed. Treated as terminal: hides install affordances forever
// on this device/browser.
const MANUAL_INSTALLED_KEY = "birdie:manuallyMarkedInstalled";

function readInstalledFlag() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(
      window.localStorage.getItem(INSTALLED_KEY) ||
        window.localStorage.getItem(MANUAL_INSTALLED_KEY),
    );
  } catch {
    return false;
  }
}

export function markInstalledManually() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MANUAL_INSTALLED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  notifyListeners();
}

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
  const [installed, setInstalled] = useState<boolean>(() => readInstalledFlag());
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
    // If we ever observe standalone mode, persist the installed flag so that
    // future browser-tab visits also hide the install affordances.
    if (isStandalone()) {
      try {
        if (!window.localStorage.getItem(INSTALLED_KEY)) {
          window.localStorage.setItem(INSTALLED_KEY, String(Date.now()));
        }
      } catch {
        // ignore
      }
      setInstalled(true);
    } else {
      setInstalled(readInstalledFlag());
    }

    const syncFromSharedState = () => {
      setDeferred(sharedDeferred);
      setFreshPromptTick(sharedFreshPromptTick);
      setInstalled(readInstalledFlag());
    };
    listeners.add(syncFromSharedState);

    const onBIP = (e: Event) => {
      e.preventDefault();
      sharedDeferred = e as BIPEvent;
      // A fresh beforeinstallprompt is proof the app is NOT currently
      // installed on this browser. Clear any stale installed flags so the
      // CTA reappears (e.g. after the user uninstalled, or after we wrongly
      // persisted the flag during prior testing).
      try {
        window.localStorage.removeItem(INSTALLED_KEY);
        window.localStorage.removeItem(MANUAL_INSTALLED_KEY);
      } catch {
        // ignore
      }
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
      setInstalled(true);
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

  // Android without a native prompt almost always means "already installed"
  // (or not installable). Either way, showing a CTA leads to a dead-end
  // dialog, so we suppress it.
  const canInstall =
    !standalone &&
    !installed &&
    !isPreviewContext() &&
    (Boolean(deferred) || ios);

  return {
    canInstall,
    standalone,
    installed,
    ios,
    android,
    hasNativePrompt: Boolean(deferred),
    freshPromptTick,
    promptInstall,
  };
}
