import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const { teams, loading: teamsLoading, refresh, setActiveTeamId } = useTeams();
  const location = useLocation();
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [joinChecked, setJoinChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setNeedsOnboarding(!data?.nickname);
      setProfileChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Safety net: if a pending invite code is sitting in storage when the
  // user lands inside /app (e.g. after onboarding), consume it now so
  // they never see the "create a team" fallback.
  useEffect(() => {
    if (!user || teamsLoading) return;
    if (typeof window === "undefined") {
      setJoinChecked(true);
      return;
    }
    const pendingJoin =
      localStorage.getItem("birdie:pendingJoin") ??
      sessionStorage.getItem("birdie:pendingJoin");
    if (!pendingJoin) {
      setJoinChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("join_team_by_code", {
        _code: pendingJoin,
      });
      if (cancelled) return;
      localStorage.removeItem("birdie:pendingJoin");
      sessionStorage.removeItem("birdie:pendingJoin");
      if (!error) {
        await refresh();
        if (typeof data === "string") setActiveTeamId(data);
      }
      setJoinChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, teamsLoading, refresh, setActiveTeamId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Flag className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" />;

  if (!profileChecked || !joinChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Flag className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" />;
  }

  if (!teamsLoading && teams.length === 0 && location.pathname !== "/app/teams") {
    return <Navigate to="/app/teams" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}