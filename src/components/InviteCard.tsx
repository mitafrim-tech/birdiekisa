import { useEffect, useState } from "react";
import { Share2, Copy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { nativeShareInvite, buildInviteMessage, openWhatsAppShare } from "@/lib/share";
import { toast } from "sonner";

interface InviteCardProps {
  teamId: string;
  teamName: string;
  /** "hero" = bold gradient block (e.g. team settings),
   *  "soft" = lighter card (e.g. leaderboard empty state) */
  variant?: "hero" | "soft";
  /** Override the title text (defaults to a friendly Finnish prompt). */
  title?: string;
  /** Optional one-line description above the share controls. */
  description?: string;
}

/**
 * Single source of truth for the team-invite share UI.
 * Fetches the join code, builds the link, and offers native share
 * with a WhatsApp + copy fallback.
 */
export function InviteCard({
  teamId,
  teamName,
  variant = "hero",
  title,
  description,
}: InviteCardProps) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_team_join_code", { _team_id: teamId }).then(({ data }) => {
      if (!cancelled && typeof data === "string") setCode(data);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const inviteUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/join/${code}`
      : "";

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Kutsulinkki kopioitu");
    } catch {
      toast.error("Kopiointi epäonnistui");
    }
  };

  const share = async () => {
    if (!inviteUrl) return;
    const ok = await nativeShareInvite(teamName, inviteUrl);
    if (!ok) {
      // Desktop / unsupported → WhatsApp fallback
      openWhatsAppShare(buildInviteMessage(teamName, inviteUrl));
    }
  };

  const isHero = variant === "hero";
  const containerCls = isHero
    ? "rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-card"
    : "rounded-3xl bg-card p-5 shadow-card border border-primary/10";
  const labelCls = isHero
    ? "text-xs uppercase tracking-widest opacity-80 font-semibold"
    : "text-xs uppercase tracking-widest text-primary font-semibold";
  const headingCls = isHero
    ? "font-display text-lg mt-1 mb-3"
    : "font-display text-lg mt-1 mb-1 flex items-center gap-2";
  const urlBoxCls = isHero
    ? "flex-1 bg-primary-foreground/15 rounded-xl px-3 py-2 text-sm truncate"
    : "flex-1 bg-muted rounded-xl px-3 py-2 text-sm truncate";

  return (
    <div className={containerCls}>
      <div className={labelCls}>
        {isHero ? "Jaa kutsu" : "Kutsu kaverit mukaan"}
      </div>
      <div className={headingCls}>
        {!isHero && <Users className="w-5 h-5 text-primary" />}
        {title ?? (isHero
          ? "Kuka tahansa, jolla on tämä linkki, voi liittyä"
          : "Tiimi tarvitsee pelaajia")}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
      )}
      <div className="flex gap-2 mt-2">
        <div className={urlBoxCls}>{inviteUrl || "Ladataan…"}</div>
        <Button
          onClick={copy}
          variant={isHero ? "secondary" : "outline"}
          className="rounded-xl shrink-0"
          disabled={!inviteUrl}
        >
          <Copy className="w-4 h-4 mr-1" /> Kopioi
        </Button>
      </div>
      <Button
        onClick={share}
        disabled={!inviteUrl}
        className="w-full mt-3 h-12 rounded-xl font-display"
      >
        <Share2 className="w-4 h-4 mr-2" /> Jaa kutsu
      </Button>
    </div>
  );
}