import { useState, type ReactNode } from "react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  Bot,
  Building2,
  CreditCard,
  FileSearch,
  Flag,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
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
import { cn } from "@/lib/utils";

const ADMIN_NAV: { title: string; items: { label: string; to: string; icon: typeof Globe }[] }[] = [
  {
    title: "Operations",
    items: [
      { label: "Overview", to: "/admin", icon: LayoutDashboard },
      { label: "System health", to: "/admin/system-health", icon: Activity },
      { label: "Integrations", to: "/admin/integrations", icon: KeyRound },
      { label: "Chains", to: "/admin/chains", icon: Globe },
    ],
  },
  {
    title: "Detection",
    items: [
      { label: "Scans", to: "/admin/scans", icon: FileSearch },
      { label: "Findings", to: "/admin/findings", icon: ShieldAlert },
      { label: "Reports", to: "/admin/reports", icon: Flag },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "Users", to: "/admin/users", icon: Users },
      { label: "Workspaces", to: "/admin/workspaces", icon: Building2 },
      { label: "Access", to: "/admin/access", icon: KeyRound },
      { label: "Agents", to: "/admin/agents", icon: Bot },
      { label: "Policies", to: "/admin/policies", icon: ScrollText },
      { label: "Spend incidents", to: "/admin/spend-incidents", icon: ShieldAlert },
      { label: "Security incidents", to: "/admin/security-incidents", icon: ShieldAlert },
      { label: "Billing", to: "/admin/billing", icon: CreditCard },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Audit", to: "/admin/audit", icon: ScrollText },
      { label: "Proofs", to: "/admin/proofs", icon: ShieldCheck },
      { label: "AI & RAG", to: "/admin/ai-rag", icon: Bot },
      { label: "Content", to: "/admin/content", icon: FileSearch },
      { label: "Feature flags", to: "/admin/feature-flags", icon: Flag },
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-5">
      {ADMIN_NAV.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                item.to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(item.to);
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
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useDemoAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card/70 px-3 py-5 backdrop-blur lg:flex">
        <div className="flex items-center gap-2 px-2">
          <Logo to="/admin" />
          <Badge variant="secondary" className="rounded-full text-[10px] uppercase">Staff</Badge>
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <AdminNav />
        </div>
        <DemoDataNote />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
                  <div className="mt-4"><Logo to="/admin" /></div>
                  <div className="mt-6"><AdminNav onNavigate={() => setOpen(false)} /></div>
                </SheetContent>
              </Sheet>
              <Badge variant="secondary" className="rounded-full">Platform staff area</Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">{(session?.name ?? "?").split(" ").map((p) => p[0]).join("").slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs font-medium sm:inline">{session?.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm">{session?.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{session?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/admin/profile">Admin profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin/settings">Platform settings</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    signOut();
                    router.navigate({ to: "/admin/login" });
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function AdminSignInRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center">
        <Logo to="/admin/login" />
        <h1 className="mt-6 font-display text-xl font-medium">Platform staff sign-in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Admin routes are for authorized PoisonGuard platform staff only. Please sign in with your staff credentials.
        </p>
        <Button asChild className="mt-6 w-full rounded-full">
          <Link to="/admin/login">Go to staff sign-in</Link>
        </Button>
      </div>
    </div>
  );
}
