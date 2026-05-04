import { useEffect, useState } from "react";
import { CloudUpload, X } from "lucide-react";
import {
  clearRoundQueue,
  flushRoundQueue,
  getQueuedCount,
  subscribeToRoundQueue,
} from "@/lib/round-queue";
import { useConnectivity } from "@/lib/connectivity";

/**
 * Tiny chip surfaced in the app header whenever there are queued rounds
 * waiting to be sent. Lets the user know nothing was lost and gives them an
 * explicit "try now" affordance — but the queue also flushes automatically
 * the moment the connection comes back, so most users will never click it.
 */
export function QueuedRoundsBadge() {
  const [count, setCount] = useState<number>(() => getQueuedCount());
  const [retrying, setRetrying] = useState(false);
  const { online } = useConnectivity();

  useEffect(() => {
    setCount(getQueuedCount());
    const unsub = subscribeToRoundQueue(() => setCount(getQueuedCount()));
    return unsub;
  }, []);

  if (count === 0) return null;

  const label = count === 1 ? "1 kierros odottaa" : `${count} kierrosta odottaa`;

  return (
    <div className="inline-flex items-center gap-0.5 h-8 rounded-full bg-accent/20 text-accent-foreground border border-accent/40 text-[11px] font-display uppercase tracking-wider overflow-hidden">
      <button
        type="button"
        disabled={retrying || !online}
        onClick={async () => {
          setRetrying(true);
          try {
            await flushRoundQueue();
          } finally {
            setRetrying(false);
            setCount(getQueuedCount());
          }
        }}
        aria-label={`${label}. Lähetä nyt.`}
        className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 disabled:opacity-60"
      >
        <CloudUpload className="w-3.5 h-3.5" strokeWidth={2.5} />
        <span>{label}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Hylätäänkö odottavat kierrokset? Niitä ei lähetetä palvelimelle.")) {
            clearRoundQueue();
            setCount(0);
          }
        }}
        aria-label="Hylkää odottavat kierrokset"
        className="inline-flex items-center justify-center h-8 w-7 border-l border-accent/40 hover:bg-accent/10"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
