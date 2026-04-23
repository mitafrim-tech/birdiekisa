import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Award, Crown, Plus } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/hall-of-fame")({
  component: HallOfFame,
});

interface ChampRow {
  id: string;
  user_id: string;
  season_start: string;
  season_end: string;
  birdie_count: number;
  season_label: string | null;
  category: string | null;
  course_name: string | null;
  hole_number: number | null;
  event_date: string | null;
  competition: string | null;
  is_manual: boolean | null;
  profiles: { nickname: string | null; avatar_url: string | null } | null;
}

interface ShotRow {
  id: string;
  shot_type: "eagle" | "albatross" | "hole_in_one";
  course_name: string;
  hole_number: number | null;
  event_name: string | null;
  played_on: string;
  user_id: string;
  profiles: { nickname: string | null; avatar_url: string | null } | null;
}

const SHOT_LABELS: Record<ShotRow["shot_type"], { label: string; emoji: string; color: string }> = {
  hole_in_one: { label: "Holari", emoji: "⛳", color: "bg-flag text-primary-foreground" },
  albatross: { label: "Albatross", emoji: "🪶", color: "bg-sky text-night" },
  eagle: { label: "Eagle", emoji: "🦅", color: "bg-accent text-night" },
};

function HallOfFame() {
  const { user } = useAuth();
  const { activeTeam } = useTeams();
  const [champs, setChamps] = useState<ChampRow[]>([]);
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = !!(user && activeTeam && user.id === activeTeam.admin_id);

  useEffect(() => {
    if (!activeTeam) return;
    setLoading(true);
    (async () => {
      const { data: champData } = await supabase
        .from("champions")
        .select("id, user_id, season_start, season_end, birdie_count, season_label, category, course_name, hole_number, event_date, competition, is_manual, profiles:profiles!champions_user_id_fkey(nickname, avatar_url)")
        .eq("team_id", activeTeam.id)
        .order("season_end", { ascending: false });

      const { data: shotData } = await supabase
        .from("notable_shots")
        .select("id, shot_type, course_name, hole_number, event_name, played_on, user_id, profiles:profiles!notable_shots_user_id_fkey(nickname, avatar_url)")
        .eq("team_id", activeTeam.id)
        .order("played_on", { ascending: false });

      setChamps((champData as any) ?? []);
      setShots((shotData as any) ?? []);
      setLoading(false);
    })();
  }, [activeTeam]);

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl bg-gradient-sunset p-6 text-night shadow-card relative overflow-hidden">
        <Award className="absolute -right-4 -top-4 w-32 h-32 text-night/10" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
          <div className="text-xs uppercase tracking-widest font-semibold opacity-80">Kunnian galleria</div>
          <h1 className="font-display text-3xl mt-1">Legendat</h1>
          </div>
          {isAdmin && (
            <Link
              to="/app/legends-admin"
              className="shrink-0 inline-flex items-center gap-1 bg-night text-primary-foreground rounded-xl px-3 py-2 text-xs font-display shadow-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Lisää
            </Link>
          )}
        </div>
      </div>

      {/* Champions */}
      <section>
        <h2 className="font-display text-xl mb-3 flex items-center gap-2">
          <Crown className="w-5 h-5 text-accent" /> Edelliset mestarit
        </h2>
        {loading ? (
          <div className="h-20 bg-muted rounded-2xl animate-pulse" />
        ) : champs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Yhtään kautta ei ole vielä arkistoitu. Ylläpitäjä voi kruunata mestarin tiimin asetuksista.</p>
        ) : (
          <div className="space-y-2">
            {champs.map((c) => (
              <div key={c.id} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-3">
                {c.profiles?.avatar_url ? (
                  <img src={c.profiles.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-primary/20" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg truncate">{c.profiles?.nickname ?? "Pelaaja"}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.season_label ?? `${format(new Date(c.season_start), "MMM yyyy")} – ${format(new Date(c.season_end), "MMM yyyy")}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl text-primary">{c.birdie_count}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">birdiet</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notable shots */}
      <section>
        <h2 className="font-display text-xl mb-3">Mainittavat lyönnit</h2>
        {loading ? (
          <div className="h-20 bg-muted rounded-2xl animate-pulse" />
        ) : shots.length === 0 ? (
          <EmptyState icon={Award} title="Ei vielä legendaarisia lyöntejä" description="Eaglet, albatrossit ja holarit ilmestyvät tänne." />
        ) : (
          <div className="space-y-2">
            {shots.map((s) => {
              const meta = SHOT_LABELS[s.shot_type];
              return (
                <div key={s.id} className="bg-card rounded-2xl p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-bold ${meta.color}`}>
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-base">
                        {s.profiles?.nickname ?? "Pelaaja"} <span className="text-muted-foreground font-sans font-normal">— {meta.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.course_name}
                        {s.hole_number ? ` • Reikä ${s.hole_number}` : ""}
                        {" • "}
                        {format(new Date(s.played_on), "MMM d, yyyy")}
                      </div>
                      {s.event_name && (
                        <div className="text-xs italic text-muted-foreground mt-0.5">{s.event_name}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}