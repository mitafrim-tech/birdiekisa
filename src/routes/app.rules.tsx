import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollText, Pencil, Eye, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rules")({
  component: RulesPage,
});

function RulesPage() {
  const { user } = useAuth();
  const { activeTeam } = useTeams();
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = !!(user && activeTeam && user.id === activeTeam.admin_id);

  useEffect(() => {
    if (!activeTeam) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("team_rules")
        .select("content")
        .eq("team_id", activeTeam.id)
        .maybeSingle();
      const c = data?.content ?? "";
      setContent(c);
      setOriginal(c);
      setLoading(false);
    })();
  }, [activeTeam]);

  const save = async () => {
    if (!activeTeam || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("team_rules")
      .upsert(
        { team_id: activeTeam.id, content, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "team_id" },
      );
    setSaving(false);
    if (error) {
      toast.error("Tallennus epäonnistui");
    } else {
      setOriginal(content);
      setEditing(false);
      toast.success("Säännöt tallennettu");
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="rounded-3xl bg-gradient-hero text-primary-foreground p-6 shadow-card relative overflow-hidden">
        <ScrollText className="absolute -right-4 -top-4 w-32 h-32 text-primary-foreground/10" />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest font-semibold opacity-80">Tiimin säännöt</div>
          <h1 className="font-display text-3xl mt-1">Säännöt</h1>
          <p className="text-sm opacity-90 mt-2 max-w-xs">
            Mitä lasketaan kirjattavaksi birdieksi? Tiimi päättää.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-40 bg-muted rounded-2xl animate-pulse" />
      ) : editing && isAdmin ? (
        <div className="bg-card rounded-3xl p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Muokkaa (Markdown)
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setContent(original); setEditing(false); }}
            >
              Peruuta
            </Button>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"# Säännöt\n\n- Birdiet hyväksytään vain keltaisilta tiiltä pelatuista kierroksista.\n- Pelin täytyy olla 18 reikää.\n- Säännöt voi merkitä **bold**, _italic_ tai listana."}
            className="min-h-[280px] font-mono text-sm"
          />
          <Button
            onClick={save}
            disabled={saving || content === original}
            className="w-full h-12 rounded-xl font-display"
          >
            <Save className="w-4 h-4 mr-2" /> {saving ? "Tallennetaan..." : "Tallenna säännöt"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tukee Markdown-muotoilua: **paksu**, _kursiivi_, # otsikko, - luettelo.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-3xl p-6 shadow-card">
          {content.trim() ? (
            <article className="prose prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-ul:my-2">
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          ) : (
            <div className="text-center py-8">
              <Eye className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {isAdmin
                  ? "Ei vielä sääntöjä. Kirjoita ne alta, niin tiimi näkee ne tässä."
                  : "Ylläpitäjä ei ole vielä lisännyt sääntöjä."}
              </p>
            </div>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setEditing(true)}
              className="w-full h-12 rounded-xl mt-5 font-display"
            >
              <Pencil className="w-4 h-4 mr-2" /> {content.trim() ? "Muokkaa sääntöjä" : "Kirjoita säännöt"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
