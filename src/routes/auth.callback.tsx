import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/lib/team-context";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { refresh, setActiveTeamId } = useTeams();
  const [failed, setFailed] = useState(false);

  // If auth has settled (loading=false) but no user arrived, wait a short
  // grace period for supabase-js to parse the URL hash and emit the
  // SIGNED_IN event before declaring failure. This matters for the
  // cross-browser-context case (link opened in a different browser than
  // the one that requested it) and for expired links.
  useEffect(() => {
    if (loading || user) {
      setFailed(false);
      return;
    }
    const t = setTimeout(() => setFailed(true), 3000);
    return () => clearTimeout(t);
  }, [loading, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) return; // handled by the failure screen below
    let cancelled = false;
    (async () => {
      const pendingJoin =
        typeof window !== "undefined"
          ? (localStorage.getItem("birdie:pendingJoin") ?? sessionStorage.getItem("birdie:pendingJoin"))
          : null;
      if (pendingJoin) {
        // Auto-join immediately so the user lands inside the team
        // and never sees the "create your own team" screen.
        const { data, error } = await supabase.rpc("join_team_by_code", {
          _code: pendingJoin,
        });
        if (cancelled) return;
        if (typeof window !== "undefined") {
          localStorage.removeItem("birdie:pendingJoin");
          sessionStorage.removeItem("birdie:pendingJoin");
        }
        if (error) {
          toast.error(toUserMessage(error, "Liittyminen epäonnistui"));
        } else {
          await refresh();
          if (typeof data === "string") setActiveTeamId(data);
          toast.success("Liityit tiimiin 🎉");
        }
      }
      if (!cancelled) navigate({ to: "/app" });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate, refresh, setActiveTeamId]);

  if (failed && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero text-primary-foreground px-6">
        <div className="bg-card text-card-foreground rounded-3xl p-6 shadow-card max-w-md w-full text-center">
          <h1 className="font-display text-2xl mb-3">Sisäänkirjautuminen ei onnistunut</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Tämä voi tapahtua, jos avasit linkin eri selaimessa kuin missä pyysit sen,
            tai jos linkki on vanhentunut. Pyydä uusi linkki ja avaa se samassa
            selaimessa, jossa olet nyt.
          </p>
          <Button
            onClick={() => navigate({ to: "/" })}
            className="w-full h-12 text-base font-display tracking-wide bg-night hover:bg-night/90 text-primary-foreground rounded-xl"
          >
            Pyydä uusi linkki
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Vinkki: Jos avaat linkin WhatsAppista tai sähköpostista, pidä painettuna
            linkkiä ja valitse &quot;Avaa Chromessa&quot;.
          </p>
        </div>
      </div>
    );
  }

  return <LoadingScreen label="Kirjataan sisään..." />;
}
