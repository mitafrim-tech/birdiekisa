import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadUserFile } from "@/lib/upload";
import { Camera, Copy, Crown, Flag, Star, Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/app/team-settings")({
  component: TeamSettings,
});

function TeamSettings() {
  const { user } = useAuth();
  const { activeTeam, refresh } = useTeams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(activeTeam?.name ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(activeTeam?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [seasonStart, setSeasonStart] = useState(activeTeam?.season_start ?? "");
  const [seasonEnd, setSeasonEnd] = useState(activeTeam?.season_end ?? "");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [courses, setCourses] = useState<{ id: string; name: string; is_official: boolean }[]>([]);
  const [newCourse, setNewCourse] = useState("");
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState("");

  const notAllowed = !activeTeam || (user && user.id !== activeTeam.admin_id);
  useEffect(() => {
    if (notAllowed) navigate({ to: "/app" });
  }, [notAllowed, navigate]);

  useEffect(() => {
    if (!activeTeam) return;
    (async () => {
      const { data } = await supabase
        .from("team_courses")
        .select("id, name, is_official")
        .eq("team_id", activeTeam.id)
        .order("is_official", { ascending: false })
        .order("name");
      setCourses(data ?? []);
    })();
  }, [activeTeam]);

  if (!activeTeam) return null;
  if (user && user.id !== activeTeam.admin_id) return null;

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${activeTeam.join_code}`
    : "";

  const handleLogo = (f: File | null) => {
    setLogoFile(f);
    if (f) setLogoPreview(URL.createObjectURL(f));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      let logo_url: string | null = logoPreview?.startsWith("blob:") ? null : logoPreview;
      if (logoFile) logo_url = await uploadUserFile("team-logos", user.id, logoFile);
      const { error } = await supabase
        .from("teams")
        .update({
          name: name.trim(),
          logo_url,
          season_start: seasonStart || null,
          season_end: seasonEnd || null,
        })
        .eq("id", activeTeam.id);
      if (error) throw error;
      await refresh();
      toast.success("Tiimi päivitetty");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tallennus epäonnistui");
    } finally {
      setSaving(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Kutsulinkki kopioitu");
    } catch {
      toast.error("Kopiointi epäonnistui");
    }
  };

  const archiveSeason = async () => {
    if (!activeTeam.season_start || !activeTeam.season_end) {
      toast.error("Aseta ensin kauden alku- ja loppupäivä");
      return;
    }
    if (!confirm("Päätetäänkö kausi ja kruunataanko kärjessä oleva mestariksi? Hänet lisätään Legendoihin.")) return;
    setArchiving(true);
    try {
      // Determine leader by birdie totals within season
      const { data: rounds } = await supabase
        .from("rounds")
        .select("user_id, birdies")
        .eq("team_id", activeTeam.id)
        .gte("played_on", activeTeam.season_start)
        .lte("played_on", activeTeam.season_end);

      const totals = new Map<string, number>();
      (rounds ?? []).forEach((r) => totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.birdies));
      let leader: string | null = null;
      let max = -1;
      totals.forEach((v, k) => {
        if (v > max) {
          max = v;
          leader = k;
        }
      });
      if (!leader) {
        toast.error("Tällä kaudella ei ole kirjattuja kierroksia — ei kruunattavaa mestaria.");
        setArchiving(false);
        return;
      }
      const { error } = await supabase.from("champions").insert({
        team_id: activeTeam.id,
        user_id: leader,
        season_start: activeTeam.season_start,
        season_end: activeTeam.season_end,
        birdie_count: max,
      });
      if (error) throw error;
      toast.success("Mestari kruunattu! 🏆");
      navigate({ to: "/app/hall-of-fame" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kauden arkistointi epäonnistui");
    } finally {
      setArchiving(false);
    }
  };

  const addCourse = async (asOfficial: boolean) => {
    if (!newCourse.trim() || !user) return;
    setCoursesLoading(true);
    const { data, error } = await supabase
      .from("team_courses")
      .insert({ team_id: activeTeam.id, name: newCourse.trim(), added_by: user.id, is_official: asOfficial })
      .select("id, name, is_official")
      .single();
    setCoursesLoading(false);
    if (error) {
      toast.error("Lisäys epäonnistui (kenttä ehkä jo olemassa)");
      return;
    }
    setCourses((prev) => [...prev, data].sort((a, b) =>
      Number(b.is_official) - Number(a.is_official) || a.name.localeCompare(b.name),
    ));
    setNewCourse("");
  };

  const toggleOfficial = async (c: { id: string; is_official: boolean }) => {
    const next = !c.is_official;
    const { error } = await supabase.from("team_courses").update({ is_official: next }).eq("id", c.id);
    if (error) {
      toast.error("Päivitys epäonnistui");
      return;
    }
    setCourses((prev) =>
      prev
        .map((x) => (x.id === c.id ? { ...x, is_official: next } : x))
        .sort((a, b) => Number(b.is_official) - Number(a.is_official) || a.name.localeCompare(b.name)),
    );
  };

  const removeCourse = async (id: string) => {
    if (!confirm("Poistetaanko kenttä?")) return;
    const { error } = await supabase.from("team_courses").delete().eq("id", id);
    if (error) {
      toast.error("Poisto epäonnistui");
      return;
    }
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const startEditCourse = (c: { id: string; name: string }) => {
    setEditingCourseId(c.id);
    setEditingCourseName(c.name);
  };

  const cancelEditCourse = () => {
    setEditingCourseId(null);
    setEditingCourseName("");
  };

  const saveEditCourse = async () => {
    if (!editingCourseId) return;
    const trimmed = editingCourseName.trim();
    if (!trimmed) {
      toast.error("Nimi ei voi olla tyhjä");
      return;
    }
    const { error } = await supabase
      .from("team_courses")
      .update({ name: trimmed })
      .eq("id", editingCourseId);
    if (error) {
      toast.error("Nimen muutos epäonnistui");
      return;
    }
    setCourses((prev) =>
      prev
        .map((x) => (x.id === editingCourseId ? { ...x, name: trimmed } : x))
        .sort((a, b) => Number(b.is_official) - Number(a.is_official) || a.name.localeCompare(b.name)),
    );
    cancelEditCourse();
    toast.success("Kentän nimi päivitetty");
  };

  return (
    <div className="space-y-6 pb-8">
      <h1 className="font-display text-3xl">Tiimin asetukset</h1>

      {/* Invite */}
      <div className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-card">
        <div className="text-xs uppercase tracking-widest opacity-80 font-semibold">Jaa kutsu</div>
        <div className="font-display text-lg mt-1 mb-3">Kuka tahansa, jolla on tämä linkki, voi liittyä</div>
        <div className="flex gap-2">
          <div className="flex-1 bg-primary-foreground/15 rounded-xl px-3 py-2 text-sm truncate">
            {inviteUrl}
          </div>
          <Button onClick={copyInvite} variant="secondary" className="rounded-xl">
            <Copy className="w-4 h-4 mr-1" /> Kopioi
          </Button>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4 bg-card rounded-3xl p-5 shadow-card">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-2xl bg-primary/10 border-4 border-dashed border-primary/30 flex items-center justify-center overflow-hidden"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <Flag className="w-10 h-10 text-primary/60" />
            )}
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow-bold border-2 border-card">
              <Camera className="w-4 h-4 text-night" strokeWidth={3} />
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Tiimin nimi</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} className="h-12 mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Kausi alkaa</Label>
            <Input type="date" value={seasonStart ?? ""} onChange={(e) => setSeasonStart(e.target.value)} className="h-12 mt-1" />
          </div>
          <div>
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Kausi päättyy</Label>
            <Input type="date" value={seasonEnd ?? ""} onChange={(e) => setSeasonEnd(e.target.value)} className="h-12 mt-1" />
          </div>
        </div>
        <Button type="submit" disabled={saving} className="w-full h-12 rounded-xl font-display">
          {saving ? "Tallennetaan..." : "Tallenna muutokset"}
        </Button>
      </form>

      <div className="bg-card rounded-3xl p-5 shadow-card border-2 border-dashed border-flag/30">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-flag" />
          <h2 className="font-display text-lg">Päätä kausi ja kruunaa mestari</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Arkistoi kauden kärjessä olevan pelaajan Legendoihin. Päivitä sen jälkeen kauden päivämäärät aloittaaksesi uuden kauden.
        </p>
        <Button onClick={archiveSeason} disabled={archiving} variant="destructive" className="w-full h-12 rounded-xl font-display">
          {archiving ? "Kruunataan..." : "Kruunaa mestari 🏆"}
        </Button>
      </div>

      {/* Team courses management */}
      <div className="bg-card rounded-3xl p-5 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-5 h-5 text-flag fill-flag" />
          <h2 className="font-display text-lg">Tiimin kentät</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Viralliset kentät näkyvät ensimmäisinä, kun tiimiläinen kirjaa kierroksen. Jäsenet voivat lisätä omia, sinä voit nostaa ne virallisiksi.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={newCourse}
            onChange={(e) => setNewCourse(e.target.value)}
            placeholder="esim. Pickala Forest"
            className="h-11"
          />
          <Button
            type="button"
            onClick={() => addCourse(true)}
            disabled={coursesLoading || !newCourse.trim()}
            className="rounded-xl h-11 shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" /> Lisää
          </Button>
        </div>
        {courses.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Ei vielä kenttiä.</p>
        ) : (
          <ul className="divide-y">
            {courses.map((c) => {
              const isEditing = editingCourseId === c.id;
              return (
                <li key={c.id} className="flex items-center gap-2 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleOfficial(c)}
                    title={c.is_official ? "Poista virallisista" : "Merkitse viralliseksi"}
                    className="shrink-0"
                    disabled={isEditing}
                  >
                    <Star
                      className={`w-4 h-4 ${c.is_official ? "text-flag fill-flag" : "text-muted-foreground"}`}
                    />
                  </button>
                  {isEditing ? (
                    <>
                      <Input
                        value={editingCourseName}
                        onChange={(e) => setEditingCourseName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEditCourse(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelEditCourse(); }
                        }}
                        autoFocus
                        className="h-9 flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={saveEditCourse}
                        className="text-primary hover:opacity-70 shrink-0"
                        aria-label="Tallenna"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditCourse}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Peruuta"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm truncate">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => startEditCourse(c)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Muokkaa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCourse(c.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Poista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}