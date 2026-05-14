import logoBirdie from "@/assets/logo-birdie.webp";

interface LoadingScreenProps {
  /** Optional label shown below the spinner. Defaults to "Ladataan...". */
  label?: string;
}

/**
 * Full-page branded loading screen.
 *
 * Used while the app is figuring out auth state, fetching the current
 * profile, consuming a pending join code, etc. Shows the Birdie trophy
 * mark inside a white card on the hero gradient so the loading state
 * looks like part of the brand, not a generic spinner.
 */
export function LoadingScreen({ label = "Ladataan..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-foreground inline-flex items-center justify-center mb-4 shadow-bold animate-pulse overflow-hidden">
          <img src={logoBirdie} alt="" className="w-12 h-12 object-contain" />
        </div>
        <p className="font-display text-2xl">{label}</p>
      </div>
    </div>
  );
}
