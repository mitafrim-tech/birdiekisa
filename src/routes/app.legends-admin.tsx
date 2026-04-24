import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Crown, Plus } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";

export const Route = createFileRoute("/app/legends-admin")({
  component: LegendsAdmin,
});

type Category = "birdie_winner" | "eagle" | "albatross" | "hole_in_one";

interface Member {
  user_id: string;
  nickname: string | null;
}

const CATEGORY_LABEL: Record<Category, string> = {
  birdie_winner: "Birdie-mestari (kausi)",
  eagle: "Eagle 🦅",
  albatross: "Albatross 🪶",
  hole_in_one: "Holari ⛳",
};

function LegendsAdmin() {
  const { user } = useAuth();
  const { activeTeam } = useTeams();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [category, setCategory] = useState<Category>("hole_in_one");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [memberId, setMemberId] = useState<string>("");
  const [course, setCourse] = useState("");
  const [hole, setHole] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [competition, setCompetition] = useState("");
  const [birdieCount, setBirdieCount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const notAllowed = !activeTeam || (user && user.id !== activeTeam.admin_id);

  useEffect(() => {
    if (notAllowed) navigate({ to: "/app" });
  }, [notAllowed, navigate]);

  useEffect(() => {
    if (!activeTeam) return;
    (async () => {
      const { data: tm } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", activeTeam.id);
      const ids = (tm ?? []).map((r) => r.user_id);
      if (ids.length === 0) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", ids);
      setMembers(
        (profs ?? []).map((p) => ({ user_id: p.id, nickname: p.nickname })),
      );
    })();
  }, [activeTeam]);

  if (!activeTeam || (user && user.id !== activeTeam.admin_id)) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      toast.error("Valitse pelaaja");
      return;
    }
    const yr = Number(year);
    if (!yr || yr < 1900 || yr > 2100) {
      toast.error("Anna kelvollinen vuosi");
      return;
    }

    setSubmitting(true);
    try {
      // Build a season window for the year to satisfy required season_start/end
      const seasonStart = `${yr}-01-01`;
      const seasonEnd = `${yr}-12-31`;
      const evDate = eventDate || (category === "birdie_winner" ? null : seasonEnd);

      const payload = {
        team_id: activeTeam.id,
        user_id: memberId,
        category,
        season_start: seasonStart,
        season_end: seasonEnd,
        season_label: category === "birdie_winner" ? `Kausi ${yr}` : null,
        birdie_count: category === "birdie_winner" ? Number(birdieCount) || 0 : 0,
        course_name: category === "birdie_winner" ? null : course.trim() || null,
        hole_number: category === "birdie_winner" ? null : (hole ? Number(hole) : null),
        event_date: evDate,
        competition: competition.trim() || null,
        is_manual: true,
        created_by: user!.id,
      };

      const { error } = await supabase.from("champions").insert(payload);
      if (error) throw error;
      toast.success("Legenda lisätty Legendoihin!");
      navigate({ to: "/app/hall-of-fame" });
    } catch (err) {
      toast.error(toUserMessage(err, "Tallennus epäonnistui"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <Link to="/app/hall-of-fame" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Takaisin Legendoihin
      </Link>

      <div className="rounded-3xl bg-gradient-sunset p-5 text-night shadow-card flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-night/15 flex items-center justify-center">
          <Crown className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold opacity-80">Ylläpitäjä</div>
          <h1 className="font-display text-2xl leading-tight">Lisää legenda</h1>
        </div>
      </div>

      <form onSubmit={submit} className="bg-card rounded-3xl p-5 shadow-card space-y-4">
        {/* Category */}
        <div>
          <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
            Kategoria
          </Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`h-12 rounded-xl text-sm font-display transition-all ${
                  category === c
                    ? "bg-primary text-primary-foreground shadow-bold"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Vuosi</Label>
            <Input
              type="number"
              min={1900}
              max={2100}
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-12 mt-1"
            />
          </div>
          <div>
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Pelaaja</Label>
            <select
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full h-12 mt-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Valitse...</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nickname ?? "Pelaaja"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {category === "birdie_winner" ? (
          <div>
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
              Birdie-määrä
            </Label>
            <Input
              type="number"
              min={0}
              required
              value={birdieCount}
              onChange={(e) => setBirdieCount(e.target.value)}
              placeholder="esim. 24"
              className="h-12 mt-1"
            />
          </div>
        ) : (
          <>
            <div>
              <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Kenttä</Label>
              <Input
                required
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="esim. Pickala"
                className="h-12 mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Reikä #</Label>
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={hole}
                  onChange={(e) => setHole(e.target.value)}
                  className="h-12 mt-1"
                />
              </div>
              <div>
                <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Pvm</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="h-12 mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                Kilpailu (valinnainen)
              </Label>
              <Input
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                placeholder="esim. Tiimin kesäkisa 2023"
                className="h-12 mt-1"
              />
            </div>
          </>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl font-display"
        >
          <Plus className="w-4 h-4 mr-2" />
          {submitting ? "Tallennetaan..." : "Lisää Legendoihin"}
        </Button>
      </form>
    </div>
  );
}
