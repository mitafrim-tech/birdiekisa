import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Plus, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Course {
  id: string;
  name: string;
  is_official: boolean;
}

interface Props {
  teamId: string;
  userId: string;
  value: string;
  onChange: (name: string) => void;
}

export function CoursePicker({ teamId, userId, value, onChange }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      const { data } = await supabase
        .from("team_courses")
        .select("id, name, is_official")
        .eq("team_id", teamId)
        .order("is_official", { ascending: false })
        .order("name", { ascending: true });
      setCourses((data as Course[]) ?? []);
    })();
  }, [teamId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, courses]);

  const exactMatch = useMemo(
    () => courses.some((c) => c.name.toLowerCase() === query.trim().toLowerCase()),
    [query, courses],
  );

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  const addNew = async () => {
    const name = query.trim();
    if (!name) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("team_courses")
      .insert({ team_id: teamId, name, added_by: userId, is_official: false })
      .select("id, name, is_official")
      .single();
    setAdding(false);
    if (!error && data) {
      setCourses((prev) => [...prev, data as Course].sort((a, b) => a.name.localeCompare(b.name)));
      select(data.name);
    } else {
      // Fall back: still set the value, even if insert failed (e.g. dup)
      select(name);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full h-12 rounded-md border border-input bg-background px-3 text-left text-base flex items-center justify-between",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || "Valitse kenttä..."}</span>
        <Search className="w-4 h-4 opacity-60 shrink-0 ml-2" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Search className="w-4 h-4 opacity-60 shrink-0" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hae tai lisää kenttä..."
          className="h-9 border-0 shadow-none focus-visible:ring-0 p-0 text-base"
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c.name)}
              className="w-full px-3 py-2.5 text-left hover:bg-accent/30 flex items-center gap-2 text-sm"
            >
              {c.is_official && <Star className="w-3.5 h-3.5 text-flag fill-flag shrink-0" />}
              <span className="flex-1 truncate">{c.name}</span>
              {value === c.name && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          ))
        ) : (
          <div className="px-3 py-6 text-sm text-center text-muted-foreground">
            Ei tuloksia.
          </div>
        )}
        {query.trim() && !exactMatch && (
          <Button
            type="button"
            variant="ghost"
            disabled={adding}
            onClick={addNew}
            className="w-full justify-start rounded-none h-11 border-t font-normal"
          >
            <Plus className="w-4 h-4 mr-2 text-primary" />
            Lisää uusi: <span className="font-semibold ml-1">"{query.trim()}"</span>
          </Button>
        )}
      </div>
      {value && (
        <div className="px-3 py-2 border-t bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
          <span>Valittu: <span className="font-semibold text-foreground">{value}</span></span>
          <button type="button" onClick={() => setOpen(false)} className="text-primary font-semibold">Sulje</button>
        </div>
      )}
    </div>
  );
}
