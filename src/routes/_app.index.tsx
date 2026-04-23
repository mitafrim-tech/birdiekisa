import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/lib/team-context";
import { Trophy, Flag, Crown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/")({
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
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTeam) return;
    setLoading(true);
    (async () => {
      // Fetch members
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, profiles:profiles!team_members_user_id_fkey(nickname, avatar_url)")
        .eq("team_id", activeTeam.id);

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

      const built: LeaderRow[] = (members ?? []).map((m: any) => {
        const t = totals.get(m.user_id) ?? { birdies: 0, eagles: 0, albatrosses: 0, hole_in_ones: 0 };
        return {
          user_id: m.user_id,
          nickname: m.profiles?.nickname ?? "Player",
          avatar_url: m.profiles?.avatar_url ?? null,
          ...t,
        };
      });
      built.sort((a, b) => b.birdies - a.birdies);
      setRows(built);
      setLoading(false);
    })();
  }, [activeTeam]);

  if (!activeTeam) return null;

  const seasonLabel =
    activeTeam.season_start && activeTeam.season_end
      ? `${format(new Date(activeTeam.season_start), "MMM d")} – ${format(new Date(activeTeam.season_end), "MMM d, yyyy")}`
      : "Season not set";

  return (
    <div className="space-y-6 pb-4">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-card relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent/40 blur-2xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest opacity-80 font-semibold">Season standings</div>
          <h1 className="font-display text-3xl mt-1">{activeTeam.name}</h1>
          <div className="text-sm opacity-90 mt-1">{seasonLabel}</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No players yet"
          description="Invite your crew to start the competition."
          action={
            <Link to="/app/team-settings">
              <Button className="rounded-xl">Invite players</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {rows.map((row, idx) => (
              <motion.div
                key={row.user_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.04 }}
              >
                <LeaderCard row={row} rank={idx + 1} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {rows.length > 0 && (
        <Link
          to="/app/log"
          className="fixed bottom-24 right-1/2 translate-x-[12rem] sm:right-[calc(50%-12rem)] z-30"
        >
          <button className="bg-flag text-primary-foreground rounded-full w-14 h-14 shadow-bold flex items-center justify-center hover:scale-105 transition-transform">
            <Plus className="w-7 h-7" strokeWidth={3} />
          </button>
        </Link>
      )}
    </div>
  );
}

function LeaderCard({ row, rank }: { row: LeaderRow; rank: number }) {
  const isLeader = rank === 1;
  return (
    <Link
      to="/app/player/$id"
      params={{ id: row.user_id }}
      className="block"
    >
      <div
        className={`relative rounded-2xl p-4 flex items-center gap-4 shadow-card transition-transform active:scale-[0.98] ${
          isLeader ? "bg-gradient-sunset text-night" : "bg-card"
        }`}
      >
        <div
          className={`absolute -left-1 -top-2 w-8 h-8 rounded-xl flex items-center justify-center font-display text-sm shadow-bold ${
            isLeader
              ? "bg-night text-accent"
              : rank === 2
              ? "bg-sky text-night"
              : rank === 3
              ? "bg-flag text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {rank}
        </div>
        {isLeader && <Crown className="absolute top-2 right-3 w-5 h-5 text-night/70" />}
        {row.avatar_url ? (
          <img src={row.avatar_url} alt={row.nickname} className="w-14 h-14 rounded-2xl object-cover ml-3" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center ml-3">
            <Flag className="w-7 h-7 text-primary" strokeWidth={2.5} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg leading-tight truncate">{row.nickname}</div>
          <div className="text-xs opacity-75 mt-0.5 flex gap-3">
            {row.eagles > 0 && <span>🦅 {row.eagles}</span>}
            {row.albatrosses > 0 && <span>🪶 {row.albatrosses}</span>}
            {row.hole_in_ones > 0 && <span>⛳ {row.hole_in_ones}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl leading-none">{row.birdies}</div>
          <div className="text-[10px] uppercase tracking-wider opacity-75 font-semibold mt-1">birdies</div>
        </div>
      </div>
    </Link>
  );
}