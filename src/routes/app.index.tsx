import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/lib/team-context";
import { useAuth } from "@/lib/auth";
import { Trophy, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { InviteCard } from "@/components/InviteCard";
import { format } from "date-fns";

export const Route = createFileRoute("/app/")({
  component: Leaderboard,
});

interface LeaderRow {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  birdies: number;
  eagles: number;
  albatrosses: number;
  hole_in_ones: number;
}

function Leaderboard() {
  const { activeTeam } = useTeams();
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    if (!activeTeam) return;
    // Fetch members
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", activeTeam.id);

    const memberIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = memberIds.length
      ? await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", memberIds)
      : { data: [] as { id: string; nickname: string | null; avatar_url: string | null }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Fetch rounds within season window
    let q = supabase
      .from("rounds")
      .select("user_id, birdies, eagles, albatrosses, hole_in_ones")
      .eq("team_id", activeTeam.id);
    if (activeTeam.season_start) q = q.gte("played_on", activeTeam.season_start);
    if (activeTeam.season_end) q = q.lte("played_on", activeTeam.season_end);
    const { data: rounds } = await q;

    const totals = new Map<string, { birdies: number; eagles: number; albatrosses: number; hole_in_ones: number }>();
    (rounds ?? []).forEach((r) => {
      const cur = totals.get(r.user_id) ?? { birdies: 0, eagles: 0, albatrosses: 0, hole_in_ones: 0 };
      cur.birdies += r.birdies;
      cur.eagles += r.eagles;
      cur.albatrosses += r.albatrosses;
      cur.hole_in_ones += r.hole_in_ones;
      totals.set(r.user_id, cur);
    });

    const built: LeaderRow[] = (members ?? []).map((m) => {
      const t = totals.get(m.user_id) ?? { birdies: 0, eagles: 0, albatrosses: 0, hole_in_ones: 0 };
      const p = profileMap.get(m.user_id);
      return {
        user_id: m.user_id,
        nickname: p?.nickname ?? "Pelaaja",
        avatar_url: p?.avatar_url ?? null,
        ...t,
      };
    });
    built.sort((a, b) => b.birdies - a.birdies);
    setRows(built);
    setLoading(false);
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    setLoading(true);
    loadLeaderboard();
  }, [activeTeam, loadLeaderboard]);

  // Realtime: refresh when teammates join/leave, log new rounds, edit their
  // profile (nickname/avatar), or record notable shots.
  useEffect(() => {
    if (!activeTeam) return;
    const channel = supabase
      .channel(`leaderboard:${activeTeam.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members", filter: `team_id=eq.${activeTeam.id}` },
        () => loadLeaderboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `team_id=eq.${activeTeam.id}` },
        () => loadLeaderboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notable_shots", filter: `team_id=eq.${activeTeam.id}` },
        () => loadLeaderboard(),
      )
      // Profiles aren't team-scoped, so no filter — RLS still limits the
      // payloads we receive to teammates we're allowed to see.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => loadLeaderboard(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTeam, loadLeaderboard]);

  if (!activeTeam) return null;

  const seasonLabel =
    activeTeam.season_start && activeTeam.season_end
      ? `${format(new Date(activeTeam.season_start), "MMM d")} – ${format(new Date(activeTeam.season_end), "MMM d, yyyy")}`
      : "Kautta ei ole asetettu";

  const isAdmin = !!(user && user.id === activeTeam.admin_id);
  // Member count comes from the leaderboard rows (every team member is mapped
  // 1:1 even before they log a round). When the admin is essentially alone we
  // surface a prominent invite card so they're never stuck on an empty board.
  const showInviteNudge = isAdmin && !loading && rows.length <= 1;

  return (
    <div className="space-y-6 pb-4">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-card relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent/40 blur-2xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest opacity-80 font-semibold">Kauden tilanne</div>
          <h1 className="font-display text-3xl mt-1">{activeTeam.name}</h1>
          <div className="text-sm opacity-90 mt-1">{seasonLabel}</div>
        </div>
      </div>

      {showInviteNudge && (
        <InviteCard
          teamId={activeTeam.id}
          teamName={activeTeam.name}
          variant="soft"
          description="Lähetä linkki kavereille — heti kun he liittyvät, he ilmestyvät tulostauluun."
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Ei vielä pelaajia"
          description={
            isAdmin
              ? "Kutsu kaverit mukaan – kisa alkaa heti kun he liittyvät."
              : "Tällä tiimillä ei ole vielä pelaajia. Pyydä ylläpitäjää kutsumaan kaverit."
          }
          action={
            isAdmin ? (
              <Link to="/app/team-settings">
                <Button className="rounded-xl">Kutsu pelaajat</Button>
              </Link>
            ) : (
              <Link to="/app/log">
                <Button className="rounded-xl">Kirjaa kierros</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => {
              // Standard competition ranking: tied players share the same rank.
              // 10, 10, 8 -> 1, 1, 3
              let rank = 1;
              for (let i = 0; i < idx; i++) {
                if (rows[i].birdies > row.birdies) rank = i + 2;
              }
              return (
                <div
                  key={row.user_id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <LeaderCard row={row} rank={rank} leaderBirdies={rows[0]?.birdies ?? 0} />
                </div>
              );
            })}
        </div>
      )}

    </div>
  );
}

function LeaderCard({ row, rank, leaderBirdies }: { row: LeaderRow; rank: number; leaderBirdies: number }) {
  const isLeader = rank === 1;
  // Progress bar relative to the leader's birdie count.
  // If the leader has 0 birdies, show 0% for everyone (avoids div/0).
  const pct = leaderBirdies > 0 ? Math.max(2, Math.round((row.birdies / leaderBirdies) * 100)) : 0;
  return (
    <Link to="/app/player/$id" params={{ id: row.user_id }} className="block">
      <div
        className={`rounded-2xl pl-3 pr-4 py-3 flex items-center gap-3 shadow-card transition-transform active:scale-[0.98] ${
          isLeader ? "bg-gradient-sunset text-night" : "bg-card"
        }`}
      >
        {/* Slim vertical numeral — flush in the card, no badge */}
        <div
          className={`font-display tabular-nums leading-none w-8 text-center text-3xl shrink-0 ${
            isLeader
              ? "text-night"
              : rank === 2
              ? "text-foreground/80"
              : rank === 3
              ? "text-foreground/70"
              : "text-muted-foreground/60"
          }`}
          aria-label={`Sija ${rank}`}
        >
          {rank}
        </div>

        {row.avatar_url ? (
          <img
            src={row.avatar_url}
            alt={row.nickname}
            className="w-12 h-12 rounded-2xl object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <Flag className="w-6 h-6 text-primary" strokeWidth={2.5} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-display text-lg leading-tight truncate">{row.nickname}</div>
            {/* Birdie counter — fixed-width container fits 3-digit numbers */}
            <div className="flex items-baseline gap-1 shrink-0 min-w-[68px] justify-end">
              <span className="font-display text-2xl leading-none tabular-nums">{row.birdies}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                birdiet
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div
            className={`mt-2 h-1.5 rounded-full overflow-hidden ${
              isLeader ? "bg-night/20" : "bg-muted"
            }`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                isLeader
                  ? "bg-night"
                  : rank === 2
                  ? "bg-sky"
                  : rank === 3
                  ? "bg-flag"
                  : "bg-primary/70"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {(row.eagles > 0 || row.albatrosses > 0 || row.hole_in_ones > 0) && (
            <div className="text-xs opacity-75 mt-1.5 flex gap-3">
              {row.eagles > 0 && <span>🦅 {row.eagles}</span>}
              {row.albatrosses > 0 && <span>🪶 {row.albatrosses}</span>}
              {row.hole_in_ones > 0 && <span>⛳ {row.hole_in_ones}</span>}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}