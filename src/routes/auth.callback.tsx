import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/lib/team-context";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { refresh, setActiveTeamId } = useTeams();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // No session arrived — token may have expired. Send back to landing.
      navigate({ to: "/" });
      return;
    }
    let cancelled = false;
    (async () => {
      const pendingJoin =
        typeof window !== "undefined"
          ? localStorage.getItem("birdie:pendingJoin") ??
            sessionStorage.getItem("birdie:pendingJoin")
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent inline-flex items-center justify-center mb-4 shadow-bold animate-pulse">
          <Flag className="w-8 h-8 text-night" strokeWidth={3} />
        </div>
        <p className="font-display text-2xl">Kirjataan sisään...</p>
      </div>
    </div>
  );
}