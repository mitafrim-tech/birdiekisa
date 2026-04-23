import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/log")({
  component: LogRound,
});

const HOLE_OPTIONS = [9, 18];

function LogRound() {
  const { user } = useAuth();
  const { activeTeam } = useTeams();
  const navigate = useNavigate();

  const [course, setCourse] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [holes, setHoles] = useState<number>(18);
  const [customHoles, setCustomHoles] = useState<string>("");
  const [birdies, setBirdies] = useState(0);
  const [eagles, setEagles] = useState(0);
  const [albatrosses, setAlbatrosses] = useState(0);
  const [holeInOnes, setHoleInOnes] = useState(0);
  const [step, setStep] = useState<"round" | "details">("round");
  // Per-shot details: arrays sized to count
  type ShotDetail = { course_name: string; hole_number: string; event_name: string };
  const blank: ShotDetail = { course_name: "", hole_number: "", event_name: "" };
  const [eagleDetails, setEagleDetails] = useState<ShotDetail[]>([]);
  const [albatrossDetails, setAlbatrossDetails] = useState<ShotDetail[]>([]);
  const [hioDetails, setHioDetails] = useState<ShotDetail[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const finalHoles = holes === -1 ? Number(customHoles) || 0 : holes;

  const goToDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course.trim()) {
      toast.error("Add a course name");
      return;
    }
    if (finalHoles <= 0) {
      toast.error("Number of holes must be at least 1");
      return;
    }
    if (eagles + albatrosses + holeInOnes === 0) {
      // Skip details step
      submit();
      return;
    }
    // Initialize detail rows with course_name pre-filled
    setEagleDetails(Array.from({ length: eagles }, () => ({ ...blank, course_name: course })));
    setAlbatrossDetails(Array.from({ length: albatrosses }, () => ({ ...blank, course_name: course })));
    setHioDetails(Array.from({ length: holeInOnes }, () => ({ ...blank, course_name: course })));
    setStep("details");
  };

  const submit = async () => {
    if (!user || !activeTeam) return;
    setSubmitting(true);
    try {
      const { data: round, error } = await supabase
        .from("rounds")
        .insert({
          team_id: activeTeam.id,
          user_id: user.id,
          course_name: course.trim(),
          played_on: date,
          holes_played: finalHoles,
          birdies,
          eagles,
          albatrosses,
          hole_in_ones: holeInOnes,
        })
        .select("id")
        .single();
      if (error || !round) throw error ?? new Error("Could not save round");

      // Insert notable shots
      const shots: Array<{
        round_id: string;
        team_id: string;
        user_id: string;
        shot_type: "eagle" | "albatross" | "hole_in_one";
        course_name: string;
        hole_number: number | null;
        event_name: string | null;
        played_on: string;
      }> = [];
      const pushShots = (list: ShotDetail[], type: "eagle" | "albatross" | "hole_in_one") => {
        list.forEach((s) => {
          shots.push({
            round_id: round.id,
            team_id: activeTeam.id,
            user_id: user.id,
            shot_type: type,
            course_name: s.course_name.trim() || course.trim(),
            hole_number: s.hole_number ? Number(s.hole_number) : null,
            event_name: s.event_name.trim() || null,
            played_on: date,
          });
        });
      };
      pushShots(eagleDetails, "eagle");
      pushShots(albatrossDetails, "albatross");
      pushShots(hioDetails, "hole_in_one");
      if (shots.length > 0) {
        const { error: shotsErr } = await supabase.from("notable_shots").insert(shots);
        if (shotsErr) console.error(shotsErr);
      }

      if (holeInOnes > 0) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 },
          colors: ["#fbbf24", "#10b981", "#ec4899", "#3b82f6"],
        });
      }
      toast.success("Round logged!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save round");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "details") {
    return (
      <div className="pb-8">
        <h1 className="font-display text-3xl mb-2">Tell us more</h1>
        <p className="text-muted-foreground mb-6">For the Hall of Fame.</p>
        <ShotDetailsList
          title="Hole-in-ones"
          emoji="⛳"
          details={hioDetails}
          onChange={setHioDetails}
        />
        <ShotDetailsList
          title="Albatrosses"
          emoji="🪶"
          details={albatrossDetails}
          onChange={setAlbatrossDetails}
        />
        <ShotDetailsList
          title="Eagles"
          emoji="🦅"
          details={eagleDetails}
          onChange={setEagleDetails}
        />
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStep("round")}>
            Back
          </Button>
          <Button onClick={submit} disabled={submitting} className="flex-1 h-12 rounded-xl font-display">
            {submitting ? "Saving..." : "Save round"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={goToDetails} className="space-y-5 pb-8">
      <h1 className="font-display text-3xl mb-2">Log a round</h1>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Course</Label>
        <Input
          required
          placeholder="Helsinki Golf"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className="h-12 text-base mt-1"
        />
      </div>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
        <Input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 text-base mt-1"
        />
      </div>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Holes played</Label>
        <div className="flex gap-2 mt-1">
          {HOLE_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHoles(h)}
              className={`flex-1 h-12 rounded-xl font-display text-lg transition-all ${
                holes === h ? "bg-primary text-primary-foreground shadow-bold" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {h}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setHoles(-1)}
            className={`flex-1 h-12 rounded-xl font-display transition-all ${
              holes === -1 ? "bg-primary text-primary-foreground shadow-bold" : "bg-secondary text-secondary-foreground"
            }`}
          >
            Custom
          </button>
        </div>
        {holes === -1 && (
          <Input
            type="number"
            min={1}
            max={72}
            placeholder="Number of holes"
            value={customHoles}
            onChange={(e) => setCustomHoles(e.target.value)}
            className="mt-2 h-12"
          />
        )}
      </div>

      {/* Birdie - the hero */}
      <div className="rounded-3xl bg-gradient-hero text-primary-foreground p-6 shadow-card">
        <div className="text-xs uppercase tracking-widest opacity-90 font-semibold">Headline stat</div>
        <div className="font-display text-2xl mt-1 mb-4">Birdies</div>
        <Counter value={birdies} onChange={setBirdies} big />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SmallCounter label="Eagles" emoji="🦅" value={eagles} onChange={setEagles} />
        <SmallCounter label="Albatross" emoji="🪶" value={albatrosses} onChange={setAlbatrosses} />
        <SmallCounter label="Hole-in-1" emoji="⛳" value={holeInOnes} onChange={setHoleInOnes} />
      </div>

      <Button type="submit" className="w-full h-14 rounded-xl font-display text-lg">
        {eagles + albatrosses + holeInOnes > 0 ? "Continue →" : "Save round"}
      </Button>
    </form>
  );
}

function Counter({ value, onChange, big }: { value: number; onChange: (v: number) => void; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-12 h-12 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center transition-colors"
      >
        <Minus className="w-6 h-6" strokeWidth={3} />
      </button>
      <div className={`font-display ${big ? "text-6xl" : "text-3xl"} tabular-nums`}>{value}</div>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-12 h-12 rounded-xl bg-accent text-night hover:scale-105 flex items-center justify-center transition-transform shadow-bold"
      >
        <Plus className="w-6 h-6" strokeWidth={3} />
      </button>
    </div>
  );
}

function SmallCounter({
  label,
  emoji,
  value,
  onChange,
}: {
  label: string;
  emoji: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-card rounded-2xl p-3 shadow-card text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1 tabular-nums">{value}</div>
      <div className="flex gap-1 mt-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex-1 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center"
        >
          <Minus className="w-4 h-4" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function ShotDetailsList({
  title,
  emoji,
  details,
  onChange,
}: {
  title: string;
  emoji: string;
  details: { course_name: string; hole_number: string; event_name: string }[];
  onChange: (d: { course_name: string; hole_number: string; event_name: string }[]) => void;
}) {
  if (details.length === 0) return null;
  const update = (i: number, patch: Partial<{ course_name: string; hole_number: string; event_name: string }>) => {
    onChange(details.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  return (
    <div className="mb-4">
      <div className="font-display text-lg mb-2 flex items-center gap-2">
        <span className="text-2xl">{emoji}</span> {title}
      </div>
      <div className="space-y-3">
        {details.map((d, i) => (
          <div key={i} className="bg-card rounded-2xl p-4 shadow-card space-y-2">
            <Input
              placeholder="Course"
              value={d.course_name}
              onChange={(e) => update(i, { course_name: e.target.value })}
              className="h-11"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={72}
                placeholder="Hole #"
                value={d.hole_number}
                onChange={(e) => update(i, { hole_number: e.target.value })}
                className="h-11 w-24"
              />
              <Input
                placeholder="Event (optional)"
                value={d.event_name}
                onChange={(e) => update(i, { event_name: e.target.value })}
                className="h-11 flex-1"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}