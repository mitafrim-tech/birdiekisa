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
  const [isStandalone, setIsStandalone] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setIsStandalone(
        mq.matches ||
          // iOS Safari
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window.navigator as any).standalone === true,
      );
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      toast.error("Anna 6-numeroinen koodi");
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    setVerifying(false);
    if (error) {
      toast.error(toUserMessage(error, "Koodi on virheellinen tai vanhentunut"));
      return;
    }
    toast.success("Kirjauduttu sisään");
    if (typeof window !== "undefined") window.location.replace("/app");
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
                Lähetimme sähköpostin osoitteeseen <span className="font-semibold text-foreground">{email}</span>.
                Voit klikata linkkiä <span className="font-semibold">tai</span> syöttää sähköpostissa olevan
                6-numeroisen koodin alle.
              </p>

              <form onSubmit={handleVerifyCode} className="mt-5 space-y-3 text-left">
                <label className="font-display text-xs uppercase tracking-wider text-muted-foreground block">
                  6-numeroinen koodi
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-14 text-center text-2xl font-display tracking-[0.5em]"
                />
                <Button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="w-full h-12 rounded-xl font-display"
                >
                  {verifying ? "Kirjaudutaan..." : "Kirjaudu koodilla"}
                </Button>
              </form>

              {isStandalone && (
                <div className="mt-4 rounded-xl bg-muted/60 p-3 text-left text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Vinkki asennetun sovelluksen käyttäjille</p>
                  <p>
                    Suosittelemme syöttämään 6-numeroisen koodin yllä olevaan kenttään — näin pysyt kirjautuneena
                    sovellukseen. Sähköpostin linkin avaaminen voi avata selaimen ja sovellus pyytää kirjautumaan
                    uudelleen jokaisella avauksella.
                  </p>
                </div>
              )}

              <Button
                variant="ghost"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setCode("");
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
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">tai</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={googleLoading}
                onClick={handleGoogle}
                className="w-full h-12 text-base rounded-xl gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961l3.007 2.332C4.672 5.166 6.656 3.58 9 3.58z"/>
                </svg>
                {googleLoading ? "Avataan Googlea..." : "Jatka Googlella"}
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
