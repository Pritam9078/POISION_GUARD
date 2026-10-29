import { useState, type ReactNode } from "react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import {
  Bell,
  Bot,
  FileSearch,
  Gauge,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Logo, DemoDataNote } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { NOTIFICATIONS } from "@/lib/fixtures";
import { cn } from "@/lib/utils";

const NAV_GROUPS: { title: string; items: { label: string; to: string; icon: typeof Wallet; badge?: number }[] }[] = [
  {
    title: "Workspace",
    items: [
      { label: "Overview", to: "/guard/overview", icon: LayoutDashboard },
      { label: "AI Assistant", to: "/guard/assistant", icon: Bot },
    ],
  },
  {
    title: "Security",
    items: [
      { label: "Wallets", to: "/guard/wallets", icon: Wallet },
      { label: "Trusted recipients", to: "/guard/recipients", icon: Users },
      { label: "Scans", to: "/guard/scans", icon: FileSearch },
      { label: "Approvals", to: "/guard/approvals", icon: ShieldCheck, badge: 1 },
    ],
  },
  {
    title: "Agents & spending",
    items: [
      { label: "Agents", to: "/guard/agents", icon: Bot },
      { label: "Spend intents", to: "/guard/spend-intents", icon: Receipt },
      { label: "Policies", to: "/guard/policies", icon: ScrollText },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Team", to: "/guard/team", icon: Users },
      { label: "Knowledge base", to: "/guard/knowledge", icon: Landmark },
      { label: "Audit", to: "/guard/audit", icon: ScrollText },
      { label: "Proofs", to: "/guard/proofs", icon: ShieldCheck },
      { label: "Security events", to: "/guard/security-events", icon: Gauge },
      { label: "Notifications", to: "/guard/notifications", icon: Bell },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Billing", to: "/guard/billing", icon: Receipt },
      { label: "API & Webhooks", to: "/guard/api-keys", icon: Bot },
      { label: "Settings", to: "/guard/settings", icon: Settings },
    ],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.badge ? (
                    <Badge className="ml-auto h-5 rounded-full bg-grad-violet px-1.5 text-[10px] text-white" style={{ backgroundColor: "var(--grad-violet)" }}>
                      {item.badge}
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function GuardShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useDemoAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/70 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo to="/guard/overview" />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="border-t pt-3">
          <DemoDataNote />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full lg:hidden">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto">
                  <div className="mt-4"><Logo to="/guard/overview" /></div>
                  <div className="mt-6"><NavList onNavigate={() => setOpen(false)} /></div>
                </SheetContent>
              </Sheet>
              {/* Workspace switcher (demo) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-full bg-card font-medium">
                    {session?.workspace ?? "Workspace"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces (demo)</DropdownMenuLabel>
                  <DropdownMenuItem className="justify-between">
                    Nordguard Labs <Badge variant="secondary" className="rounded-full">current</Badge>
                  </DropdownMenuItem>
                  <DropdownMenuItem>Delta Custody <span className="ml-auto text-xs text-muted-foreground">Auditor</span></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/guard/workspaces">Manage workspaces</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon" className="relative rounded-full">
                <Link to="/guard/notifications" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--risk-high)]" />}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">{(session?.name ?? "?").split(" ").map((p) => p[0]).join("").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-xs font-medium sm:inline">{session?.name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <div className="text-sm">{session?.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{session?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/guard/settings">Account settings</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/guard/billing">Billing</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      signOut();
                      router.navigate({ to: "/guard/login" });
                    }}
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/** Shown when no demo session exists for Guard. */
export function GuardSignInRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center">
        <Logo />
        <h1 className="mt-6 font-display text-xl font-medium">Guard sign-in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Guard workspace is protected. In this frontend demo, any credentials sign you in — real authentication
          arrives with the backend phase.
        </p>
        <Button asChild className="mt-6 w-full rounded-full">
          <Link to="/guard/login">Go to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
