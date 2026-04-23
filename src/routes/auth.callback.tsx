import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase parses the hash automatically. Wait briefly for session, then route.
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const pendingJoin = typeof window !== "undefined" ? sessionStorage.getItem("birdie:pendingJoin") : null;
        if (pendingJoin) {
          sessionStorage.removeItem("birdie:pendingJoin");
          navigate({ to: "/join/$code", params: { code: pendingJoin } });
        } else {
          navigate({ to: "/app" });
        }
      }
    });

    // Also try once in case event fired before listener
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const pendingJoin = typeof window !== "undefined" ? sessionStorage.getItem("birdie:pendingJoin") : null;
        if (pendingJoin) {
          sessionStorage.removeItem("birdie:pendingJoin");
          navigate({ to: "/join/$code", params: { code: pendingJoin } });
        } else {
          navigate({ to: "/app" });
        }
      }
    });

    return () => sub.data.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent inline-flex items-center justify-center mb-4 shadow-bold animate-pulse">
          <Flag className="w-8 h-8 text-night" strokeWidth={3} />
        </div>
        <p className="font-display text-2xl">Signing you in...</p>
      </div>
    </div>
  );
}