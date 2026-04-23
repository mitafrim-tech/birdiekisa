import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // No session arrived — token may have expired. Send back to landing.
      navigate({ to: "/" });
      return;
    }
    const pendingJoin =
      typeof window !== "undefined" ? sessionStorage.getItem("birdie:pendingJoin") : null;
    if (pendingJoin) {
      sessionStorage.removeItem("birdie:pendingJoin");
      navigate({ to: "/join/$code", params: { code: pendingJoin } });
    } else {
      navigate({ to: "/app" });
    }
  }, [user, loading, navigate]);

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