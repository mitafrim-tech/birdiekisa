import { useState } from "react";
import { Download, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

/**
 * Header install affordance.
 * - Hidden when the app is already installed (standalone mode) or in preview/iframe contexts.
 * - On Android/Chromium, triggers the native install prompt.
 * - On iOS, opens a dialog with manual "Add to Home Screen" instructions.
 */
export function InstallButton() {
  const { canInstall, ios, android, hasNativePrompt, promptInstall } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  if (!canInstall) return null;

  const handleClick = async () => {
    if (ios || (android && !hasNativePrompt)) {
      setIosOpen(true);
      return;
    }
    if (hasNativePrompt) {
      await promptInstall();
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        aria-label="Asenna sovellus"
        className="h-9 px-3 gap-1.5 rounded-full text-xs font-display uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/10 hover:text-primary shadow-soft"
      >
        <Download className="w-4 h-4" strokeWidth={2.5} />
        <span>Asenna</span>
      </Button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
              <Smartphone className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
            <DialogTitle className="font-display text-2xl leading-tight">
              Lisää Birdie aloitusnäytölle
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              Sovellus aukeaa yhdellä napautuksella ja toimii kuin natiivisovellus.
            </DialogDescription>
          </DialogHeader>
          {android && !hasNativePrompt ? <AndroidInstructions /> : <IosInstructions />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function IosInstructions() {
  return (
    <ol className="space-y-3 text-sm">
      <li className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center shrink-0 text-xs">
          1
        </span>
        <span>
          Paina selaimen <Share className="inline w-4 h-4 align-text-bottom mx-0.5" />{" "}
          <span className="font-semibold">Jaa</span>-painiketta alapalkista.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center shrink-0 text-xs">
          2
        </span>
        <span>
          Valitse <span className="font-semibold">"Lisää Koti-valikkoon"</span>{" "}
          <Plus className="inline w-4 h-4 align-text-bottom mx-0.5" />.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center shrink-0 text-xs">
          3
        </span>
        <span>
          Vahvista painamalla <span className="font-semibold">"Lisää"</span>.
        </span>
      </li>
    </ol>
  );
}

function AndroidInstructions() {
  return (
    <ol className="space-y-3 text-sm">
      <li className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center shrink-0 text-xs">
          1
        </span>
        <span>Avaa selaimen valikko oikeasta yläkulmasta.</span>
      </li>
      <li className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center shrink-0 text-xs">
          2
        </span>
        <span>
          Valitse <span className="font-semibold">"Asenna sovellus"</span> tai{" "}
          <span className="font-semibold">"Lisää aloitusnäytölle"</span>.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center shrink-0 text-xs">
          3
        </span>
        <span>Vahvista asennus.</span>
      </li>
    </ol>
  );
}
