import { Flag } from "lucide-react";

interface LoadingScreenProps {
  /** Optional label shown below the spinner. Defaults to "Ladataan...". */
  label?: string;
}

/**
 * Full-page branded loading screen.
 *
 * Used while the app is figuring out auth state, fetching the current
 * profile, consuming a pending join code, etc. The earlier bare Flag
 * icon on a flat background felt orphaned on the screen; this version
 * keeps the hero gradient + accent-yellow card pattern that's already
 * used on the auth callback page, so loading always feels like it's
 * part of the brand instead of an empty state.
 */
export function LoadingScreen({ label = "Ladataan..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent inline-flex items-center justify-center mb-4 shadow-bold animate-pulse">
          <Flag className="w-8 h-8 text-night" strokeWidth={3} />
        </div>
        <p className="font-display text-2xl">{label}</p>
      </div>
    </div>
  );
}