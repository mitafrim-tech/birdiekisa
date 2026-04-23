import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/lib/team-context";
import { ArrowLeft, Flag } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/player/$id")({
  component: PlayerProfile,
});

interface PlayerData {
  nickname: string;
  avatar_url: string | null;
}

interface RoundEntry {
  id: string;
  course_name: string;
  played_on: string;
  holes_played: number;
  birdies: number;
  eagles: number;
  albatrosses: number;
  hole_in_ones: number;
}

function PlayerProfile() {
  const { id } = Route.useParams();
  const { activeTeam } = useTeams();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [rounds, setRounds] = useState<RoundEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTeam || !id) return;
    setLoading(true);
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", id)
        .single();
      if (prof) setPlayer(prof as PlayerData);

      let q = supabase
        .from("rounds")
        .select("id, course_name, played_on, holes_played, birdies, eagles, albatrosses, hole_in_ones")
        .eq("team_id", activeTeam.id)
        .eq("user_id", id)
        .order("played_on", { ascending: false });
      if (activeTeam.season_start) q = q.gte("played_on", activeTeam.season_start);
      if (activeTeam.season_end) q = q.lte("played_on", activeTeam.season_end);
      const { data } = await q;
      setRounds((data as RoundEntry[]) ?? []);
      setLoading(false);
    })();
  }, [id, activeTeam]);

  const totals = rounds.reduce(
    (acc, r) => ({
      birdies: acc.birdies + r.birdies,
      eagles: acc.eagles + r.eagles,
      albatrosses: acc.albatrosses + r.albatrosses,
      hole_in_ones: acc.hole_in_ones + r.hole_in_ones,
    }),
    { birdies: 0, eagles: 0, albatrosses: 0, hole_in_ones: 0 },
  );

  return (
    <div className="space-y-6 pb-8">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Takaisin
      </Link>

      <div className="rounded-3xl bg-gradient-hero text-primary-foreground p-6 shadow-card flex items-center gap-4">
        {player?.avatar_url ? (
          <img src={player.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-bold" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/20 flex items-center justify-center">
            <Flag className="w-10 h-10" strokeWidth={2.5} />
          </div>
        )}
        <div>
          <h1 className="font-display text-3xl leading-none">{player?.nickname ?? "Pelaaja"}</h1>
          <div className="text-sm opacity-90 mt-1">{rounds.length} kierrosta tällä kaudella</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Birdiet" value={totals.birdies} highlight />
        <Stat label="Eaglet" value={totals.eagles} />
        <Stat label="Albat" value={totals.albatrosses} />
        <Stat label="Holarit" value={totals.hole_in_ones} />
      </div>

      <div>
        <h2 className="font-display text-xl mb-3">Kierrokset</h2>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ei vielä kierroksia.</p>
        ) : (
          <div className="space-y-2">
            {rounds.map((r) => (
              <div key={r.id} className="bg-card rounded-2xl p-4 shadow-card flex justify-between items-center">
                <div className="min-w-0">
                  <div className="font-display text-base truncate">{r.course_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(r.played_on), "MMM d, yyyy")} • {r.holes_played} reikää
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl text-primary">{r.birdies}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">birdiet</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 text-center shadow-card ${highlight ? "bg-accent text-night" : "bg-card"}`}>
      <div className="font-display text-2xl tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
    </div>
  );
}