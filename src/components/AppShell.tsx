import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Trophy, Plus, Award, User as UserIcon, Users, Flag, ChevronDown, LogOut, Settings, ScrollText } from "lucide-react";
import { useTeams } from "@/lib/team-context";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type TabDef = {
  to: "/app" | "/app/hall-of-fame" | "/app/rules" | "/app/profile";
  label: string;
  icon: typeof Trophy;
  exact?: boolean;
};

const TABS: TabDef[] = [
  { to: "/app", label: "Tulostaulu", icon: Trophy, exact: true },
  { to: "/app/hall-of-fame", label: "Legendat", icon: Award },
  { to: "/app/rules", label: "Säännöt", icon: ScrollText },
  { to: "/app/profile", label: "Minä", icon: UserIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { activeTeam, teams, setActiveTeamId } = useTeams();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 group">
              {activeTeam?.logo_url ? (
                <img
                  src={activeTeam.logo_url}
                  alt={activeTeam.name}
                  className="w-9 h-9 rounded-xl object-cover shadow-card"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-card">
                  <Flag className="w-5 h-5 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
              <div className="text-left">
                <div className="font-display text-base leading-tight">
                  {activeTeam?.name ?? "Ei tiimiä"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  Vaihda <ChevronDown className="w-3 h-3" />
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Tiimisi</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {teams.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => setActiveTeamId(t.id)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    t.id === activeTeam?.id && "bg-accent/40 font-semibold",
                  )}
                >
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="w-6 h-6 rounded-md object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-primary/20" />
                  )}
                  <span className="truncate">{t.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/app/teams" })}>
                <Users className="w-4 h-4 mr-2" /> Hallinnoi tiimejä
              </DropdownMenuItem>
              {activeTeam && user?.id === activeTeam.admin_id && (
                <DropdownMenuItem onClick={() => navigate({ to: "/app/team-settings" })}>
                  <Settings className="w-4 h-4 mr-2" /> Tiimin asetukset
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="w-4 h-4 mr-2" /> Kirjaudu ulos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="relative max-w-md mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
          {/* Floating center FAB for "Kirjaa kierros" */}
          <Link
            to="/app/log"
            aria-label="Kirjaa kierros"
            className="absolute left-1/2 -translate-x-1/2 -top-7 z-10 w-16 h-16 rounded-full bg-flag text-primary-foreground shadow-bold flex items-center justify-center transition-transform active:scale-95 ring-4 ring-background"
          >
            <Plus className="w-8 h-8" strokeWidth={3} />
          </Link>
          <div className="grid grid-cols-[1fr_1fr_5rem_1fr_1fr] items-stretch">
            {TABS.map(({ to, label, icon: Icon, exact }, idx) => {
              const active = exact
                ? location.pathname === to
                : location.pathname === to || location.pathname.startsWith(to + "/");
              // Skip middle column (reserved for FAB): tabs occupy cols 1,2,4,5
              const style = { gridColumn: idx < 2 ? idx + 1 : idx + 2 };
              return (
                <Link
                  key={to}
                  to={to}
                  style={style}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center transition-all w-10 h-10 rounded-2xl",
                      active && "bg-primary text-primary-foreground shadow-glow",
                    )}
                  >
                    <Icon className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}