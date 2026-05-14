import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trophy, Flag, Sparkles } from "lucide-react";
import { toUserMessage } from "@/lib/errors";
import logoBirdie from "@/assets/logo-birdie.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Birdie — Pidä kirjaa golfkaudestasi kaverien kanssa" },
      {
        name: "description",
        content: "Kirjaa birdiet, eaglet ja holarit. Kuka johtaa tulostaulua? Tehty golfporukoille.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!loading && user && typeof window !== "undefined") {
      window.location.replace("/app");
    }
  }, [loading, user]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
        data: { locale: "fi", language: "fi" },
      },
    });
    setSending(false);
    if (error) {
      toast.error(toUserMessage(error, "Linkin lähetys epäonnistui"));
    } else {
      setSent(true);
      toast.success("Tarkista sähköpostisi — taikalinkki on lähetetty");
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.redirected) return;
    if (result.error) {
      setGoogleLoading(false);
      toast.error(toUserMessage(result.error, "Google-kirjautuminen epäonnistui"));
      return;
    }
    window.location.replace("/app");
  };

  return (
    <div className="min-h-screen bg-gradient-hero text-primary-foreground overflow-hidden relative">
      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent/40 blur-3xl" />
      <div className="absolute -bottom-32 -left-10 w-96 h-96 rounded-full bg-flag/30 blur-3xl" />

      <div className="relative max-w-md mx-auto px-6 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          <div className="w-14 h-14 rounded-2xl bg-primary-foreground flex items-center justify-center shadow-bold overflow-hidden">
            <img
              src={logoBirdie}
              alt="Birdie logo"
              width={48}
              height={48}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="w-12 h-12 object-contain"
            />
          </div>
          <span className="font-display text-3xl tracking-tight">birdie</span>
        </div>

        <h1 className="font-display text-5xl sm:text-6xl leading-[0.95] mb-6 text-balance">
          Kuka on kauden
          <br />
          <span className="text-accent">pirkkokisan</span>
          <br />
          kingi?
        </h1>

        <p
          className="text-lg text-primary-foreground/85 mb-10 text-balance animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
          style={{ animationDelay: "200ms" }}
        >
          Merkkaa birdiet. Kilpaile tiimisi kanssa. Kohoa golf-legendaksi.
        </p>

        <div
          className="bg-card text-card-foreground rounded-3xl p-6 shadow-card animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
          style={{ animationDelay: "300ms" }}
        >
          {sent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display text-2xl mb-2">Tarkista sähköpostisi</h2>
              <p className="text-muted-foreground text-sm">
                Lähetimme taikalinkin osoitteeseen <span className="font-semibold text-foreground">{email}</span>.
                Klikkaa sitä kirjautuaksesi sisään.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="mt-4"
              >
                Käytä eri sähköpostia
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="font-display text-sm uppercase tracking-wider text-muted-foreground block mb-2">
                  Kirjaudu sisään sähköpostilla
                </label>
                <Input
                  type="email"
                  required
                  placeholder="sina@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <Button
                type="submit"
                disabled={sending}
                className="w-full h-12 text-base font-display tracking-wide bg-night hover:bg-night/90 text-primary-foreground rounded-xl"
              >
                {sending ? "Lähetetään taikalinkkiä..." : "Lähetä taikalinkki →"}
              </Button>
              <p className="text-sm text-foreground font-semibold text-center">
                Uusi käyttäjä? Luot oman tiimisi sisäänkirjautumisen jälkeen.
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Salasanaa ei tarvita — lähetämme sähköpostiisi kirjautumislinkin.
              </p>
            </form>
          )}
        </div>

        <div
          className="mt-12 grid grid-cols-3 gap-3 text-center animate-in fade-in duration-700 fill-mode-both"
          style={{ animationDelay: "500ms" }}
        >
          {[
            { icon: Flag, label: "Kirjaa kierrokset" },
            { icon: Trophy, label: "Kruunaa mestari" },
            { icon: Sparkles, label: "Legendat" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-primary-foreground/10 backdrop-blur rounded-2xl p-3">
              <Icon className="w-5 h-5 mx-auto mb-1 text-accent" strokeWidth={2.5} />
              <div className="text-xs font-medium">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
