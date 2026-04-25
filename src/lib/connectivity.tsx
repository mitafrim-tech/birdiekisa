import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Lightweight connectivity tracking.
 *
 * - `online` reflects an actual network probe (HEAD against a known small
 *   asset). `navigator.onLine` alone is unreliable — it often reports
 *   `false` even on healthy connections, especially inside iframes or
 *   after the device wakes from sleep. We treat `navigator.onLine` only
 *   as a hint and verify with a real request before flipping the UI to
 *   "offline".
 * - `reconnecting` is true for a couple of seconds after coming back from
 *   offline so the banner can say "Yhdistetään uudelleen…" briefly before
 *   confirming "Yhteys palautettu".
 */
interface ConnectivityValue {
  online: boolean;
  reconnecting: boolean;
}

const ConnectivityContext = createContext<ConnectivityValue>({
  online: true,
  reconnecting: false,
});

const PROBE_URL = "/favicon.ico";
const PROBE_TIMEOUT_MS = 4000;

async function probeNetwork(): Promise<boolean> {
  if (typeof fetch === "undefined") return true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    // cache-bust so we hit the network, not the SW cache
    const res = await fetch(`${PROBE_URL}?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status === 0 || res.type === "opaque";
  } catch {
    return false;
  }
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  // Default to true. We only flip to false after a probe confirms it.
  const [online, setOnline] = useState<boolean>(true);
  const [reconnecting, setReconnecting] = useState(false);

  const handleOnline = useCallback(() => {
    setOnline(true);
    setReconnecting(true);
    // Give the browser a moment to actually settle the new connection
    // before we declare everything healthy again.
    const t = setTimeout(() => setReconnecting(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleOffline = useCallback(async () => {
    // navigator.onLine flipped to false, but verify with a real probe
    // before we tell the user. This avoids false alarms on 5G/Wi-Fi
    // hops and inside iframes where the flag is unreliable.
    const reachable = await probeNetwork();
    if (reachable) {
      setOnline(true);
      setReconnecting(false);
    } else {
      setOnline(false);
      setReconnecting(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // On mount: if navigator.onLine claims offline, verify with a probe
    // before showing the banner.
    let cancelled = false;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      probeNetwork().then((reachable) => {
        if (!cancelled) setOnline(reachable);
      });
    }

    // Periodically re-verify when the flag claims offline, so a stale
    // false negative self-heals without waiting for the next browser event.
    const interval = window.setInterval(() => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        probeNetwork().then((reachable) => {
          if (!cancelled && reachable) {
            setOnline(true);
            setReconnecting(false);
          }
        });
      }
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const value = useMemo(() => ({ online, reconnecting }), [online, reconnecting]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
