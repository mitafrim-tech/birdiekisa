import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export interface TeamSummary {
  id: string;
  name: string;
  logo_url: string | null;
  admin_id: string;
  season_start: string | null;
  season_end: string | null;
}

interface TeamContextValue {
  teams: TeamSummary[];
  activeTeam: TeamSummary | null;
  setActiveTeamId: (id: string) => void;
  refresh: () => Promise<TeamSummary[]>;
  loading: boolean;
}

const STORAGE_KEY = "birdie:active-team";

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<TeamSummary[]> => {
    if (!user) {
      setTeams([]);
      setActiveId(null);
      setLoading(false);
      return [];
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, logo_url, admin_id, season_start, season_end")
      .order("created_at", { ascending: true });

    if (!error && data) {
      const nextTeams = data as TeamSummary[];
      setTeams(nextTeams);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const exists = nextTeams.find((t) => t.id === stored);
      setActiveId(exists ? stored : nextTeams[0]?.id ?? null);
      setLoading(false);
      return nextTeams;
    }
    setLoading(false);
    return [];
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveTeamId = useCallback((id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeTeam = teams.find((t) => t.id === activeId) ?? null;

  return (
    <TeamContext.Provider value={{ teams, activeTeam, setActiveTeamId, refresh, loading }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeams must be used within TeamProvider");
  return ctx;
}