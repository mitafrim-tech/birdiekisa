import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Minus, Plus, Share2, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { CelebrationModal, type CelebrationKind } from "@/components/CelebrationModal";
import { CoursePicker } from "@/components/CoursePicker";
import { buildWhatsAppMessage, openWhatsAppShare } from "@/lib/share";
import { toUserMessage } from "@/lib/errors";
import { enqueueRound, flushRoundQueue, uploadQueuedRound, type QueuedRound, type ShotPayload } from "@/lib/round-queue";
import { useConnectivity } from "@/lib/connectivity";

export const Route = createFileRoute("/app/log")({
  component: LogRound,
});

const HOLE_OPTIONS = [9, 18];

type Step = "round" | "details" | "saved";
type ShotDetail = { course_name: string; hole_number: string; event_name: string };

function LogRound() {
  const { user } = useAuth();
  const { activeTeam } = useTeams();
  const navigate = useNavigate();
  const { online } = useConnectivity();

  const [course, setCourse] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [holes, setHoles] = useState<number>(18);
  const [customHoles, setCustomHoles] = useState<string>("");
  const [birdies, setBirdies] = useState(0);
  const [eagles, setEagles] = useState(0);
  const [albatrosses, setAlbatrosses] = useState(0);
  const [holeInOnes, setHoleInOnes] = useState(0);
  const [step, setStep] = useState<Step>("round");

  const blank: ShotDetail = { course_name: "", hole_number: "", event_name: "" };
  const [eagleDetails, setEagleDetails] = useState<ShotDetail[]>([]);
  const [albatrossDetails, setAlbatrossDetails] = useState<ShotDetail[]>([]);
  const [hioDetails, setHioDetails] = useState<ShotDetail[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  // Post-save state
  const [celebration, setCelebration] = useState<CelebrationKind | null>(null);
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationKind[]>([]);
  const [playerName, setPlayerName] = useState("Pelaaja");

  const finalHoles = holes === -1 ? Number(customHoles) || 0 : holes;

  // Load player nickname for celebrations / share
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.nickname) setPlayerName(data.nickname);
    })();
  }, [user]);

  const goToDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course.trim()) {
      toast.error("Valitse kenttä");
      return;
    }
    if (finalHoles <= 0) {
      toast.error("Reikien määrän täytyy olla vähintään 1");
      return;
    }
    // Warn if the round is outside the team's configured season window.
    // Rounds outside the season are still saved, but won't appear on the
    // leaderboard until the admin extends the season.
    if (activeTeam) {
      const outsideSeason =
        (activeTeam.season_start && date < activeTeam.season_start) ||
        (activeTeam.season_end && date > activeTeam.season_end);
      if (outsideSeason) {
        const start = activeTeam.season_start ?? "?";
        const end = activeTeam.season_end ?? "?";
        const ok =
          typeof window === "undefined"
            ? true
            : window.confirm(
                `Päivämäärä ${date} on kauden ulkopuolella (${start} – ${end}). ` +
                  `Kierros tallennetaan, mutta se ei näy tulostaulussa ennen kuin ylläpitäjä päivittää kauden. Jatketaanko?`,
              );
        if (!ok) return;
      }
    }
    if (eagles + albatrosses + holeInOnes === 0) {
      submit();
      return;
    }
    setEagleDetails(Array.from({ length: eagles }, () => ({ ...blank, course_name: course })));
    setAlbatrossDetails(
      Array.from({ length: albatrosses }, () => ({ ...blank, course_name: course })),
    );
    setHioDetails(Array.from({ length: holeInOnes }, () => ({ ...blank, course_name: course })));
    setStep("details");
  };

  const submit = async () => {
    if (!user || !activeTeam) return;
    setSubmitting(true);
    try {
      const shots: ShotPayload[] = [];
      const pushShots = (list: ShotDetail[], type: ShotPayload["shot_type"]) => {
        list.forEach((s) => {
          shots.push({
            shot_type: type,
            course_name: s.course_name.trim() || course.trim(),
            hole_number: s.hole_number ? Number(s.hole_number) : null,
            event_name: s.event_name.trim() || null,
          });
        });
      };
      pushShots(eagleDetails, "eagle");
      pushShots(albatrossDetails, "albatross");
      pushShots(hioDetails, "hole_in_one");

      const pendingRound: Omit<QueuedRound, "submission_id" | "queued_at" | "attempts"> = {
        user_id: user.id,
        team_id: activeTeam.id,
        course_name: course.trim(),
        played_on: date,
        holes_played: finalHoles,
        birdies,
        eagles,
        albatrosses,
        hole_in_ones: holeInOnes,
        shots,
      };

      // Build celebration queue: rarest first
      const celebrations: CelebrationKind[] = [];
      for (let i = 0; i < holeInOnes; i++) celebrations.push("hole_in_one");
      for (let i = 0; i < albatrosses; i++) celebrations.push("albatross");
      for (let i = 0; i < eagles; i++) celebrations.push("eagle");

      let offlineSave = false;
      if (online) {
        // Prefer a direct upload while connected. Only fall back to the
        // persistent queue if the request fails or times out mid-flight.
        const queuedRound: QueuedRound = {
          ...pendingRound,
          submission_id: crypto.randomUUID(),
          queued_at: Date.now(),
          attempts: 0,
        };
        const uploaded = await uploadQueuedRound(queuedRound);
        if (!uploaded) {
          enqueueRound(queuedRound);
          offlineSave = true;
        } else {
          void flushRoundQueue();
        }
      } else {
        enqueueRound(pendingRound);
        offlineSave = true;
      }
      setSavedOffline(offlineSave);

      if (celebrations.length > 0) {
        setCelebration(celebrations[0]);
        setCelebrationQueue(celebrations.slice(1));
      } else if (offlineSave) {
        toast.success("Tallennettu offline-tilassa", {
          description: "Lähetetään automaattisesti kun yhteys palaa.",
        });
      } else {
        toast.success("Kierros kirjattu!");
      }
      setStep("saved");
    } catch (err) {
      toast.error(toUserMessage(err, "Kierroksen tallennus epäonnistui"));
    } finally {
      setSubmitting(false);
    }
  };

  const closeCelebration = () => {
    if (celebrationQueue.length > 0) {
      setCelebration(celebrationQueue[0]);
      setCelebrationQueue(celebrationQueue.slice(1));
    } else {
      setCelebration(null);
    }
  };

  const handleShare = () => {
    const message = buildWhatsAppMessage({
      course_name: course.trim(),
      played_on: date,
      birdies,
      eagles,
      albatrosses,
      hole_in_ones: holeInOnes,
      player_nickname: playerName,
      team_name: activeTeam?.name ?? "Tiimi",
      app_url: typeof window !== "undefined" ? window.location.origin : "",
    });
    openWhatsAppShare(message);
  };

  // ----- Saved screen -----
  if (step === "saved") {
    const hasNotable = eagles + albatrosses + holeInOnes > 0;
    return (
      <>
        <CelebrationModal
          kind={celebration}
          playerName={playerName}
          courseName={course}
          onClose={closeCelebration}
        />
        <div className="space-y-5 pb-8">
          <div className="rounded-3xl bg-gradient-hero text-primary-foreground p-6 shadow-card text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary-foreground/20 flex items-center justify-center mb-3">
              <Check className="w-7 h-7" strokeWidth={3} />
            </div>
            <h1 className="font-display text-3xl">
              {savedOffline ? "Tallennettu offline" : "Kierros kirjattu!"}
            </h1>
            <p className="text-sm opacity-90 mt-1">
              {course} · {format(new Date(date), "d.M.yyyy")}
            </p>
            {savedOffline && (
              <p className="text-xs opacity-90 mt-2">
                Lähetetään automaattisesti kun yhteys palaa. Älä lähetä uudelleen — duplikaatteja ei
                synny.
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <SavedStat label="Birdiet" value={birdies} highlight />
            <SavedStat label="Eaglet" value={eagles} />
            <SavedStat label="Albat" value={albatrosses} />
            <SavedStat label="Holarit" value={holeInOnes} />
          </div>

          <div
            className={`rounded-3xl p-5 shadow-card ${hasNotable ? "bg-gradient-sunset text-night" : "bg-card"}`}
          >
            <div className="font-display text-lg mb-1">
              {hasNotable ? "Kerro kavereille! 🎉" : "Jaa kavereille"}
            </div>
            <p className={`text-sm mb-4 ${hasNotable ? "text-night/80" : "text-muted-foreground"}`}>
              Lähetä WhatsApp-viesti tiimille{" "}
              {hasNotable
                ? "ja anna heidän juhlia kanssasi."
                : "ja muistuta siitä, että johdat tulostaulua."}
            </p>
            <Button
              onClick={handleShare}
              className={`w-full h-12 rounded-xl font-display ${
                hasNotable
                  ? "bg-night text-primary-foreground hover:bg-night/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <Share2 className="w-4 h-4 mr-2" /> Jaa WhatsAppissa
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/app" })}
              className="flex-1 h-12 rounded-xl"
            >
              Tulostauluun
            </Button>
            <Button
              onClick={() => {
                // Reset for another round
                setStep("round");
                setBirdies(0);
                setEagles(0);
                setAlbatrosses(0);
                setHoleInOnes(0);
                setEagleDetails([]);
                setAlbatrossDetails([]);
                setHioDetails([]);
              }}
              className="flex-1 h-12 rounded-xl font-display"
            >
              Uusi kierros <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ----- Details step -----
  if (step === "details") {
    return (
      <div className="pb-8">
        <h1 className="font-display text-3xl mb-2">Kerro lisää</h1>
        <p className="text-muted-foreground mb-6">Legendoille.</p>
        <ShotDetailsList title="Holarit" emoji="⛳" details={hioDetails} onChange={setHioDetails} />
        <ShotDetailsList
          title="Albatrossit"
          emoji="🪶"
          details={albatrossDetails}
          onChange={setAlbatrossDetails}
        />
        <ShotDetailsList
          title="Eaglet"
          emoji="🦅"
          details={eagleDetails}
          onChange={setEagleDetails}
        />
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={() => setStep("round")}
          >
            Takaisin
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="flex-1 h-12 rounded-xl font-display"
          >
            {submitting ? "Tallennetaan..." : "Tallenna kierros"}
          </Button>
        </div>
      </div>
    );
  }

  // ----- Round step -----
  return (
    <form onSubmit={goToDetails} className="space-y-5 pb-8">
      <h1 className="font-display text-3xl mb-2">Kirjaa kierros</h1>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
          Kenttä
        </Label>
        <div className="mt-1">
          {activeTeam && user ? (
            <CoursePicker
              teamId={activeTeam.id}
              userId={user.id}
              value={course}
              onChange={setCourse}
            />
          ) : (
            <Input
              placeholder="Esim. Helsingin Golfklubi"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="h-12 text-base"
            />
          )}
        </div>
      </div>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
          Päivämäärä
        </Label>
        <Input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 text-base mt-1"
        />
      </div>

      <div>
        <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
          Pelatut reiät
        </Label>
        <div className="flex gap-2 mt-1">
          {HOLE_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHoles(h)}
              className={`flex-1 h-12 rounded-xl font-display text-lg transition-all ${
                holes === h
                  ? "bg-primary text-primary-foreground shadow-bold"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {h}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setHoles(-1)}
            className={`flex-1 h-12 rounded-xl font-display transition-all ${
              holes === -1
                ? "bg-primary text-primary-foreground shadow-bold"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            Muu
          </button>
        </div>
        {holes === -1 && (
          <Input
            type="number"
            min={1}
            max={72}
            placeholder="Reikien määrä"
            value={customHoles}
            onChange={(e) => setCustomHoles(e.target.value)}
            className="mt-2 h-12"
          />
        )}
      </div>

      <div className="rounded-3xl bg-gradient-hero text-primary-foreground p-6 shadow-card">
        <div className="text-xs uppercase tracking-widest opacity-90 font-semibold">Päätilasto</div>
        <div className="font-display text-2xl mt-1 mb-4">Birdiet</div>
        <Counter value={birdies} onChange={setBirdies} big />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SmallCounter label="Eaglet" emoji="🦅" value={eagles} onChange={setEagles} />
        <SmallCounter
          label="Albatrossit"
          emoji="🪶"
          value={albatrosses}
          onChange={setAlbatrosses}
        />
        <SmallCounter label="Holarit" emoji="⛳" value={holeInOnes} onChange={setHoleInOnes} />
      </div>

      <Button type="submit" className="w-full h-14 rounded-xl font-display text-lg">
        {eagles + albatrosses + holeInOnes > 0 ? "Jatka →" : "Tallenna kierros"}
      </Button>
    </form>
  );
}

function Counter({
  value,
  onChange,
  big,
}: {
  value: number;
  onChange: (v: number) => void;
  big?: boolean;
}) {
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
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
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

function SavedStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 text-center shadow-card ${highlight ? "bg-accent text-night" : "bg-card"}`}
    >
      <div className="font-display text-2xl tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
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
  const update = (
    i: number,
    patch: Partial<{ course_name: string; hole_number: string; event_name: string }>,
  ) => {
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
              placeholder="Kenttä"
              value={d.course_name}
              onChange={(e) => update(i, { course_name: e.target.value })}
              className="h-11"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={72}
                placeholder="Reikä #"
                value={d.hole_number}
                onChange={(e) => update(i, { hole_number: e.target.value })}
                className="h-11 w-24"
              />
              <Input
                placeholder="Tapahtuma (valinnainen)"
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
