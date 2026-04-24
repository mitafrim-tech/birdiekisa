import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Flag, Trophy, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$code")({
  component: JoinTeam,
});

function JoinTeam() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const { refresh, setActiveTeamId } = useTeams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    supabase.rpc("get_team_by_join_code", { _code: code }).then(({ data, error }) => {
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setError("Virheellinen kutsulinkki");
      } else {
        const t = Array.isArray(data) ? data[0] : data;
        setTeam(t);
      }
    });
  }, [code]);

  // Save the code so callback can pick it up after sign-in
  useEffect(() => {
    if (!loading && !user && typeof window !== "undefined") {
      sessionStorage.setItem("birdie:pendingJoin", code);
    }
  }, [code, user, loading]);

  if (!loading && !user) return <Navigate to="/" />;

  const handleJoin = async () => {
    if (!team) return;
    setJoining(true);
    const { data, error } = await supabase.rpc("join_team_by_code", { _code: code });
    setJoining(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    if (typeof data === "string") setActiveTeamId(data);
    setJoined(true);
  };

  return (
    <div className="min-h-screen bg-gradient-hero text-primary-foreground flex items-center justify-center p-6">
      <div className="bg-card text-card-foreground rounded-3xl p-8 max-w-sm w-full shadow-card text-center">
        {error ? (
          <>
            <h1 className="font-display text-2xl mb-2">Hups</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate({ to: "/app" })}>Etusivulle</Button>
          </>
        ) : joined && team ? (
          <>
            <div className="text-5xl mb-2">🎉</div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Tervetuloa tiimiin</p>
            <h1 className="font-display text-3xl mb-2 mt-1">{team.name}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Olet nyt mukana. Aloita kirjaamalla ensimmäinen birdie tai katso tulostaulu.
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => navigate({ to: "/app/log" })}
                className="w-full h-12 font-display rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Kirjaa ensimmäinen tulos
              </Button>
              <Button
                onClick={() => navigate({ to: "/app" })}
                variant="outline"
                className="w-full h-12 font-display rounded-xl"
              >
                <Trophy className="w-4 h-4 mr-2" /> Katso tulostaulu
              </Button>
            </div>
          </>
        ) : team ? (
          <>
            {team.logo_url ? (
              <img src={team.logo_url} alt="" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-card" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center shadow-card">
                <Flag className="w-10 h-10 text-primary-foreground" strokeWidth={3} />
              </div>
            )}
            <p className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Sinut on kutsuttu tiimiin</p>
            <h1 className="font-display text-3xl mb-6 mt-1">{team.name}</h1>
            <Button onClick={handleJoin} disabled={joining} className="w-full h-12 font-display rounded-xl">
              {joining ? "Liitytään..." : "Liity tiimiin →"}
            </Button>
          </>
        ) : (
          <Flag className="w-8 h-8 text-primary animate-pulse mx-auto" />
        )}
      </div>
    </div>
  );
}