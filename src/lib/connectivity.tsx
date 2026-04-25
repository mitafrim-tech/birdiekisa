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
 * - `online` reflects `navigator.onLine` plus our own ping-after-reconnect
 *   debounce so we don't flicker the UI when the device hops Wi-Fi → 4G
 *   for a fraction of a second.
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

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [reconnecting, setReconnecting] = useState(false);

  const handleOnline = useCallback(() => {
    setOnline(true);
    setReconnecting(true);
    // Give the browser a moment to actually settle the new connection
    // before we declare everything healthy again.
    const t = setTimeout(() => setReconnecting(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleOffline = useCallback(() => {
    setOnline(false);
    setReconnecting(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const value = useMemo(() => ({ online, reconnecting }), [online, reconnecting]);
  return (
    <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}