import { useEffect, useState } from "react";
import { CloudUpload } from "lucide-react";
import {
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

  const label =
    count === 1 ? "1 kierros odottaa" : `${count} kierrosta odottaa`;

  return (
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
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-accent/20 text-accent-foreground border border-accent/40 text-[11px] font-display uppercase tracking-wider disabled:opacity-60"
    >
      <CloudUpload className="w-3.5 h-3.5" strokeWidth={2.5} />
      <span>{label}</span>
    </button>
  );
}