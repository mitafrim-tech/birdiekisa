import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Award, Crown, Plus, Feather, Flag, Bird } from "lucide-react";
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
  profiles?: { nickname: string | null; avatar_url: string | null } | null;
}

interface ShotRow {
  id: string;
  shot_type: "eagle" | "albatross" | "hole_in_one";
  course_name: string;
  hole_number: number | null;
  event_name: string | null;
  played_on: string;
  user_id: string;
  profiles?: { nickname: string | null; avatar_url: string | null } | null;
}

const SHOT_LABELS: Record<
  ShotRow["shot_type"],
  { label: string; Icon: typeof Flag; color: string }
> = {
  hole_in_one: { label: "Holari", Icon: Flag, color: "bg-flag text-primary-foreground" },
  albatross: { label: "Albatross", Icon: Feather, color: "bg-sky text-night" },
  eagle: { label: "Eagle", Icon: Bird, color: "bg-accent text-night" },
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
      // Fetch champions and notable shots; profiles must be fetched separately
      // because there is no FK from these tables to public.profiles (the FK
      // points to auth.users), so PostgREST embeds return nothing.
      const [{ data: champData }, { data: shotData }] = await Promise.all([
        supabase
          .from("champions")
          .select("id, user_id, season_start, season_end, birdie_count, season_label, category, course_name, hole_number, event_date, competition, is_manual")
          .eq("team_id", activeTeam.id)
          .order("season_end", { ascending: false }),
        supabase
          .from("notable_shots")
          .select("id, shot_type, course_name, hole_number, event_name, played_on, user_id")
          .eq("team_id", activeTeam.id)
          .order("played_on", { ascending: false }),
      ]);

      const userIds = Array.from(
        new Set([
          ...((champData ?? []).map((c) => c.user_id)),
          ...((shotData ?? []).map((s) => s.user_id)),
        ]),
      );

      let profileMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", userIds);
        (profileData ?? []).forEach((p) => {
          profileMap.set(p.id, { nickname: p.nickname, avatar_url: p.avatar_url });
        });
      }

      const enrichedChamps: ChampRow[] = (champData ?? []).map((c) => ({
        ...c,
        profiles: profileMap.get(c.user_id) ?? null,
      }));
      const enrichedShots: ShotRow[] = (shotData ?? []).map((s) => ({
        ...s,
        profiles: profileMap.get(s.user_id) ?? null,
      }));

      setChamps(enrichedChamps);
      setShots(enrichedShots);
      setLoading(false);
    })();
  }, [activeTeam]);

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl bg-gradient-sunset p-6 text-night shadow-card relative overflow-hidden">
        {/* Decorative icon: clipped to left half so it never sits behind the action button */}
        <Award
          aria-hidden
          className="absolute -left-6 -bottom-6 w-28 h-28 text-night/10 pointer-events-none"
        />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest font-semibold opacity-80">
              Kunnian galleria
            </div>
            <h1 className="font-display text-3xl mt-1">Legendat</h1>
          </div>
          {isAdmin && (
            <Link
              to="/app/legends-admin"
              className="relative z-10 shrink-0 inline-flex items-center gap-1.5 bg-night/90 text-primary-foreground rounded-full px-3.5 py-2 text-xs font-display shadow-soft hover:bg-night transition-colors"
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
        ) : champs.filter(c => (c.category ?? "birdie_winner") === "birdie_winner").length === 0 ? (
          <p className="text-sm text-muted-foreground">Yhtään kautta ei ole vielä arkistoitu. Ylläpitäjä voi kruunata mestarin tiimin asetuksista.</p>
        ) : (
          <div className="space-y-2">
            {champs
              .filter((c) => (c.category ?? "birdie_winner") === "birdie_winner")
              .map((c) => (
              <div key={c.id} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-3">
                {c.profiles?.avatar_url ? (
                  <img
                    src={c.profiles.avatar_url}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                    className="w-12 h-12 rounded-xl object-cover"
                  />
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
        ) : (() => {
          const manualShots = champs
            .filter((c) => (c.category ?? "birdie_winner") !== "birdie_winner")
            .map((c) => ({
              id: `m-${c.id}`,
              shot_type: c.category as ShotRow["shot_type"],
              course_name: c.course_name ?? "",
              hole_number: c.hole_number,
              event_name: c.competition,
              played_on: c.event_date ?? c.season_end,
              user_id: c.user_id,
              profiles: c.profiles,
            } as ShotRow & { __manual?: boolean }));
          const all = [...manualShots, ...shots].sort(
            (a, b) => (a.played_on < b.played_on ? 1 : -1),
          );
          if (all.length === 0) {
            return (
              <EmptyState icon={Award} title="Ei vielä legendaarisia lyöntejä" description="Eaglet, albatrossit ja holarit ilmestyvät tänne." />
            );
          }
          return (
            <div className="space-y-2">
              {all.map((s) => {
                const meta = SHOT_LABELS[s.shot_type];
                const Icon = meta.Icon;
                return (
                  <div key={s.id} className="bg-card rounded-2xl p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center shadow-bold ${meta.color}`}
                      >
                        <Icon className="w-5 h-5" strokeWidth={2.25} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-base">
                          {s.profiles?.nickname ?? "Pelaaja"} <span className="text-muted-foreground font-sans font-normal">— {meta.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.course_name}
                          {s.hole_number ? ` • Reikä ${s.hole_number}` : ""}
                          {" • "}
                          {format(new Date(s.played_on), "d.M.yyyy")}
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
          );
        })()}
      </section>
    </div>
  );
}