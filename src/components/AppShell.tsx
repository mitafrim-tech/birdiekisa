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
import { InstallPrompt } from "@/components/InstallPrompt";

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
        <div className="max-w-md mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5 items-stretch">
            {TABS.slice(0, 2).map(({ to, label, icon: Icon, exact }) => (
              <NavTab key={to} to={to} label={label} Icon={Icon} exact={exact} pathname={location.pathname} />
            ))}
            {/* Center primary action */}
            <Link
              to="/app/log"
              aria-label="Lisää tulos"
              className="flex flex-col items-center justify-center gap-1 py-2 group"
            >
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow transition-transform group-active:scale-95">
                <Plus className="w-6 h-6" strokeWidth={3} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Lisää
              </span>
            </Link>
            {TABS.slice(2).map(({ to, label, icon: Icon, exact }) => (
              <NavTab key={to} to={to} label={label} Icon={Icon} exact={exact} pathname={location.pathname} />
            ))}
          </div>
        </div>
      </nav>
      <InstallPrompt />
    </div>
  );
}

function NavTab({
  to,
  label,
  Icon,
  exact,
  pathname,
}: {
  to: TabDef["to"];
  label: string;
  Icon: TabDef["icon"];
  exact?: boolean;
  pathname: string;
}) {
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="w-5 h-5" strokeWidth={2.5} />
      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
    </Link>
  );
}