import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CelebrationKind = "eagle" | "albatross" | "hole_in_one";

interface CelebrationProps {
  kind: CelebrationKind | null;
  playerName: string;
  courseName: string;
  onClose: () => void;
}

const CONFIG: Record<CelebrationKind, {
  emoji: string;
  title: string;
  subtitle: string;
  bg: string;
  glow: string;
  particles: number;
  duration: number;
}> = {
  eagle: {
    emoji: "🦅",
    title: "EAGLE!",
    subtitle: "Kovan luokan suoritus",
    bg: "from-accent via-accent to-flag",
    glow: "shadow-[0_0_120px_60px_rgba(251,191,36,0.5)]",
    particles: 250,
    duration: 1500,
  },
  albatross: {
    emoji: "🪶",
    title: "ALBATROSS!",
    subtitle: "Harvinainen herkku",
    bg: "from-sky via-primary to-sky",
    glow: "shadow-[0_0_140px_70px_rgba(56,189,248,0.55)]",
    particles: 400,
    duration: 2500,
  },
  hole_in_one: {
    emoji: "⛳",
    title: "HOLARI!",
    subtitle: "Kerran elämässä – ehkä",
    bg: "from-flag via-accent to-flag",
    glow: "shadow-[0_0_180px_90px_rgba(244,63,94,0.6)]",
    particles: 600,
    duration: 4000,
  },
};

export function CelebrationModal({ kind, playerName, courseName, onClose }: CelebrationProps) {
  // Failsafe auto-dismiss: on some mobile PWAs (notably iOS standalone) the
  // backdrop-filter overlay or a confetti canvas can swallow taps, leaving the
  // user stuck on the celebration screen. We keep the manual close button but
  // also auto-advance after the celebration animation finishes.
  useEffect(() => {
    if (!kind) return;
    const cfg = CONFIG[kind];
    const timeout = window.setTimeout(onClose, cfg.duration + 2500);
    return () => window.clearTimeout(timeout);
  }, [kind, onClose]);

  useEffect(() => {
    if (!kind) return;
    const cfg = CONFIG[kind];

    // Initial burst — keep confetti below the modal (modal is z-[110])
    confetti({
      particleCount: cfg.particles,
      spread: 120,
      startVelocity: 55,
      origin: { y: 0.45 },
      colors: ["#fbbf24", "#10b981", "#ec4899", "#3b82f6", "#f43f5e"],
      zIndex: 90,
    });

    // For HIO + albatross: rolling bursts
    if (kind === "hole_in_one" || kind === "albatross") {
      const end = Date.now() + cfg.duration;
      const interval = setInterval(() => {
        if (Date.now() > end) {
          clearInterval(interval);
          return;
        }
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 70,
          origin: { x: 0, y: 0.7 },
          colors: ["#fbbf24", "#f43f5e", "#10b981"],
          zIndex: 90,
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.7 },
          colors: ["#fbbf24", "#f43f5e", "#10b981"],
          zIndex: 90,
        });
      }, 350);
      return () => clearInterval(interval);
    }
  }, [kind]);

  return (
    <>
      {kind && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-night/90 animate-in fade-in duration-200"
          onPointerDown={onClose}
          role="button"
          tabIndex={-1}
        >
          <div
            className={`relative z-[111] max-w-sm w-full rounded-[2.5rem] bg-gradient-to-br ${CONFIG[kind].bg} ${CONFIG[kind].glow} p-8 text-center text-night overflow-hidden animate-in zoom-in-50 fade-in duration-500 fill-mode-both`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Background trophy */}
            <Trophy className="absolute -right-12 -bottom-12 w-56 h-56 text-night/5 rotate-12" />

            <div
              className="text-8xl mb-4 leading-none drop-shadow-lg animate-in zoom-in-0 fade-in duration-500 fill-mode-both"
              style={{ animationDelay: "150ms" }}
            >
              {CONFIG[kind].emoji}
            </div>

            <div
              className="font-display text-5xl tracking-tight mb-1 text-night animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
              style={{ animationDelay: "350ms" }}
            >
              {CONFIG[kind].title}
            </div>

            <div
              className="text-xs uppercase tracking-[0.3em] font-bold opacity-70 mb-6 animate-in fade-in duration-500 fill-mode-both"
              style={{ animationDelay: "550ms" }}
            >
              {CONFIG[kind].subtitle}
            </div>

            <div
              className="bg-night/15 backdrop-blur rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
              style={{ animationDelay: "700ms" }}
            >
              <div className="font-display text-2xl leading-tight">{playerName}</div>
              <div className="text-sm opacity-80 mt-1">{courseName}</div>
            </div>

            <Button
              type="button"
              onClick={onClose}
              className="w-full h-12 rounded-xl font-display bg-night text-primary-foreground hover:bg-night/90"
            >
              Legendaa! →
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
