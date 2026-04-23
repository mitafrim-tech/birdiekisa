import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Trophy, Plus, Award, User as UserIcon, Users, Flag, ChevronDown, LogOut, Settings } from "lucide-react";
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
  to: "/app" | "/app/log" | "/app/hall-of-fame" | "/app/profile";
  label: string;
  icon: typeof Trophy;
  exact?: boolean;
};

const TABS: TabDef[] = [
  { to: "/app", label: "Leaderboard", icon: Trophy, exact: true },
  { to: "/app/log", label: "Log", icon: Plus },
  { to: "/app/hall-of-fame", label: "Legends", icon: Award },
  { to: "/app/profile", label: "Me", icon: UserIcon },
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
                  {activeTeam?.name ?? "No team"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  Switch <ChevronDown className="w-3 h-3" />
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Your teams</DropdownMenuLabel>
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
                <Users className="w-4 h-4 mr-2" /> Manage teams
              </DropdownMenuItem>
              {activeTeam && user?.id === activeTeam.admin_id && (
                <DropdownMenuItem onClick={() => navigate({ to: "/app/team-settings" })}>
                  <Settings className="w-4 h-4 mr-2" /> Team settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign out
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
        <div className="max-w-md mx-auto grid grid-cols-4">
          {TABS.map(({ to, label, icon: Icon, exact }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 transition-all",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                    active && "bg-primary text-primary-foreground shadow-glow scale-110",
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}