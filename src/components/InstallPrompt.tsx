import { useEffect, useState } from "react";
import { Share, Plus, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "birdie:installPromptDismissedAt";
const SNOOZE_DAYS = 14;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari exposes navigator.standalone
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

function shouldShow() {
  if (typeof window === "undefined") return false;
  if (isStandalone()) return false;
  if (isInIframe()) return false;
  // Hide on Lovable preview hosts
  const host = window.location.hostname;
  if (host.includes("lovable.app") || host.includes("lovableproject.com") || host.includes("localhost")) {
    return false;
  }
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt) {
    const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
    if (days < SNOOZE_DAYS) return false;
  }
  return true;
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!shouldShow()) return;
    setIos(isIOS());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS has no event — show after short delay
    if (isIOS()) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      dismiss();
    }
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 px-4 pointer-events-none">
      <div className="max-w-md mx-auto bg-card text-card-foreground rounded-2xl shadow-card border border-border p-4 pointer-events-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-primary" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base leading-tight mb-1">
              Lisää Birdie aloitusnäytölle
            </div>
            {ios ? (
              <p className="text-xs text-muted-foreground leading-snug">
                Paina <Share className="inline w-3.5 h-3.5 align-text-bottom" /> Jaa-painiketta ja valitse{" "}
                <span className="font-semibold text-foreground">"Lisää Koti-valikkoon"</span>{" "}
                <Plus className="inline w-3.5 h-3.5 align-text-bottom" />.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-snug">
                Asenna sovellus, niin se aukeaa yhdellä napautuksella ja toimii kuin natiivisovellus.
              </p>
            )}
            {!ios && deferred && (
              <Button
                onClick={install}
                size="sm"
                className="mt-3 h-9 rounded-lg font-display tracking-wide"
              >
                Asenna sovellus
              </Button>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Sulje"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}