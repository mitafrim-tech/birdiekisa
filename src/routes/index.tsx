import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
      { name: "description", content: "Kirjaa birdiet, eaglet ja holarit. Kuka johtaa tulostaulua? Tehty golfporukoille." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-hero text-primary-foreground overflow-hidden relative">
      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent/40 blur-3xl" />
      <div className="absolute -bottom-32 -left-10 w-96 h-96 rounded-full bg-flag/30 blur-3xl" />

      <div className="relative max-w-md mx-auto px-6 pt-16 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 mb-12"
        >
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
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-5xl sm:text-6xl leading-[0.95] mb-6 text-balance"
        >
          Kuka on kauden<br />
          <span className="text-accent">pirkkokisan</span><br />
          kingi?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg text-primary-foreground/85 mb-10 text-balance"
        >
          Merkkaa birdiet. Kilpaile tiimisi kanssa. Kohoa golf-legendaksi.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="bg-card text-card-foreground rounded-3xl p-6 shadow-card"
        >
          {sent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display text-2xl mb-2">Tarkista sähköpostisi</h2>
              <p className="text-muted-foreground text-sm">
                Lähetimme taikalinkin osoitteeseen <span className="font-semibold text-foreground">{email}</span>. Klikkaa sitä kirjautuaksesi sisään.
              </p>
              <Button
                variant="ghost"
                onClick={() => { setSent(false); setEmail(""); }}
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
              <p className="text-xs text-muted-foreground text-center">
                Salasanaa ei tarvita. Lähetämme sähköpostiisi kirjautumislinkin.
              </p>
            </form>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-12 grid grid-cols-3 gap-3 text-center"
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
        </motion.div>
      </div>
    </div>
  );
}