import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadUserFile } from "@/lib/upload";
import { Camera, Flag, Plus } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";

export const Route = createFileRoute("/app/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const { user } = useAuth();
  const { teams, refresh, setActiveTeamId } = useTeams();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(teams.length === 0);
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      let logo_url: string | null = null;
      if (logoFile) logo_url = await uploadUserFile("team-logos", user.id, logoFile);
      const { error } = await supabase
        .from("teams")
        .insert({
          name: name.trim(),
          admin_id: user.id,
          logo_url,
          season_start: seasonStart || null,
          season_end: seasonEnd || null,
        });
      if (error) throw error;

      const nextTeams = await refresh();
      const createdTeam = [...nextTeams].reverse().find((team) => team.admin_id === user.id && team.name === name.trim());
      if (createdTeam) {
        setActiveTeamId(createdTeam.id);
      }

      toast.success(`Tiimi ${name} luotu`);
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(toUserMessage(err, "Tiimin luonti epäonnistui"));
    } finally {
      setCreating(false);
    }
  };

  const handleLogo = (f: File | null) => {
    setLogoFile(f);
    if (f) setLogoPreview(URL.createObjectURL(f));
  };

  return (
    <div className="space-y-6 pb-8">
      <h1 className="font-display text-3xl">Tiimisi</h1>

      {teams.length > 0 && (
        <div className="space-y-2">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTeamId(t.id);
                navigate({ to: "/app" });
              }}
              className="w-full bg-card rounded-2xl p-4 shadow-card flex items-center gap-3 hover:scale-[1.01] transition-transform"
            >
              {t.logo_url ? (
                <img src={t.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                  <Flag className="w-6 h-6 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
              <div className="flex-1 text-left">
                <div className="font-display text-lg">{t.name}</div>
                {t.admin_id === user?.id && (
                  <div className="text-[10px] uppercase tracking-wider text-accent-foreground bg-accent inline-block px-2 py-0.5 rounded font-semibold">
                    Ylläpitäjä
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {!showCreate && (
        <Button onClick={() => setShowCreate(true)} className="w-full h-12 rounded-xl font-display">
          <Plus className="w-5 h-5 mr-2" /> Luo tiimi
        </Button>
      )}

      {showCreate && (
        <form onSubmit={create} className="bg-card rounded-3xl p-5 shadow-card space-y-4">
          <h2 className="font-display text-xl">Uusi tiimi</h2>

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
              className="hidden"
              onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground mt-2">Lisää logo</p>
          </div>

          <div>
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Tiimin nimi</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="h-12 mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Kausi alkaa</Label>
              <Input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} className="h-12 mt-1" />
            </div>
            <div>
              <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">Kausi päättyy</Label>
              <Input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} className="h-12 mt-1" />
            </div>
          </div>

          <div className="flex gap-2">
            {teams.length > 0 && (
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl">
                Peruuta
              </Button>
            )}
            <Button type="submit" disabled={creating || !name.trim()} className="flex-1 h-12 rounded-xl font-display">
              {creating ? "Luodaan..." : "Luo →"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}