import { useEffect, useState } from "react";
import { Share, Plus, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { toast } from "sonner";

const DISMISS_KEY = "birdie:installPromptDismissedAt";
const INSTALL_TOAST_KEY = "birdie:installToastShown";
const SNOOZE_DAYS = 14;

export function InstallPrompt() {
  const { canInstall, ios, android, hasNativePrompt, promptInstall, standalone, freshPromptTick } =
    useInstallPrompt();
  const [snoozed, setSnoozed] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) {
      setSnoozed(false);
      return;
    }
    const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
    setSnoozed(days < SNOOZE_DAYS);
  }, [freshPromptTick]);

  // When the browser signals a brand-new install opportunity (e.g. after an
  // uninstall), clear any prior snooze so the user sees the CTA again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (freshPromptTick === 0) return;
    window.localStorage.removeItem(DISMISS_KEY);
    setSnoozed(false);
  }, [freshPromptTick]);

  // Celebrate a successful install (once per device) and ensure the card stays hidden.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!standalone) return;
    const shown = window.localStorage.getItem(INSTALL_TOAST_KEY);
    if (shown) return;
    window.localStorage.setItem(INSTALL_TOAST_KEY, String(Date.now()));
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    toast.success("Birdie asennettu! 🎉", {
      description: "Avaa sovellus aloitusnäytöltä yhdellä napautuksella.",
    });
  }, [standalone]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setSnoozed(true);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome) dismiss();
  };

  if (!canInstall || snoozed) return null;

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
                Paina <Share className="inline w-3.5 h-3.5 align-text-bottom" /> Jaa-painiketta ja
                valitse{" "}
                <span className="font-semibold text-foreground">"Lisää Koti-valikkoon"</span>{" "}
                <Plus className="inline w-3.5 h-3.5 align-text-bottom" />.
              </p>
            ) : android && !hasNativePrompt ? (
              <p className="text-xs text-muted-foreground leading-snug">
                Asenna selaimen valikosta, niin Birdie aukeaa jatkossa suoraan aloitusnäytöltä.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-snug">
                Asenna sovellus, niin se aukeaa yhdellä napautuksella ja toimii kuin
                natiivisovellus.
              </p>
            )}
            {android && !hasNativePrompt && (
              <>
                <Button
                  onClick={() => setManualOpen((open) => !open)}
                  size="sm"
                  className="mt-3 h-9 rounded-lg font-display tracking-wide"
                >
                  Näytä ohjeet
                </Button>
                {manualOpen && (
                  <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground leading-snug list-decimal list-inside">
                    <li>Avaa selaimen valikko oikeasta yläkulmasta.</li>
                    <li>Valitse "Asenna sovellus" tai "Lisää aloitusnäytölle".</li>
                    <li>Vahvista asennus.</li>
                  </ol>
                )}
              </>
            )}
            {!ios && hasNativePrompt && (
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
