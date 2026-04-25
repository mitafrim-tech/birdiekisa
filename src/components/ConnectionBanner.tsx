import { useEffect, useState } from "react";
import { CloudOff, CloudCheck, Loader2 } from "lucide-react";
import { useConnectivity } from "@/lib/connectivity";

/**
 * Quiet by default. Shows:
 *  - a red bar while the device is offline,
 *  - a brief green confirmation when the connection comes back.
 * Hidden entirely when everything is healthy.
 */
export function ConnectionBanner() {
  const { online, reconnecting } = useConnectivity();
  const [showRecovered, setShowRecovered] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowRecovered(false);
      return;
    }
    if (wasOffline && online && !reconnecting) {
      setShowRecovered(true);
      const t = setTimeout(() => {
        setShowRecovered(false);
        setWasOffline(false);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [online, reconnecting, wasOffline]);

  if (online && !reconnecting && !showRecovered) return null;

  let label: string;
  let tone: "offline" | "reconnecting" | "recovered";
  if (!online) {
    label = "Ei verkkoyhteyttä — tulos tallentuu kun yhteys palaa.";
    tone = "offline";
  } else if (reconnecting) {
    label = "Yhdistetään uudelleen…";
    tone = "reconnecting";
  } else {
    label = "Yhteys palautettu";
    tone = "recovered";
  }

  const bg =
    tone === "offline"
      ? "bg-destructive text-destructive-foreground"
      : tone === "reconnecting"
        ? "bg-muted text-foreground"
        : "bg-primary text-primary-foreground";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-0 right-0 top-0 z-[60] ${bg} animate-in fade-in slide-in-from-top-2 duration-200`}
    >
      <div className="max-w-md mx-auto px-4 h-9 flex items-center justify-center gap-2 text-xs font-semibold">
        {tone === "offline" && <CloudOff className="w-4 h-4" strokeWidth={2.5} />}
        {tone === "reconnecting" && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />}
        {tone === "recovered" && <CloudCheck className="w-4 h-4" strokeWidth={2.5} />}
        <span>{label}</span>
      </div>
    </div>
  );
}