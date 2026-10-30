import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/pg/kit";
import { HelpWidget } from "@/components/pg/help-widget";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Scanner", to: "/" },
  { label: "Recipient Checker", to: "/check-recipient" },
  { label: "Revoke", to: "/revoke" },
  { label: "Methodology", to: "/methodology" },
  { label: "Pricing", to: "/pricing" },
  { label: "Documentation", to: "/docs" },
];

const FOOTER_COLS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Scanner", to: "/" },
      { label: "Check recipient", to: "/check-recipient" },
      { label: "Revoke approvals", to: "/revoke" },
      { label: "Connect wallet", to: "/wallet-connect" },
      { label: "Pricing plans", to: "/pricing" },
      { label: "Guard workspace", to: "/guard/overview" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Methodology", to: "/methodology" },
      { label: "Accuracy benchmarks", to: "/accuracy" },
      { label: "Recovery guidance", to: "/recovery" },
      { label: "Anti-phishing", to: "/anti-phishing" },
      { label: "Documentation & API", to: "/docs" },
      { label: "Frequently asked questions", to: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About & Contact", to: "/about" },
      { label: "Report a finding", to: "/report" },
      { label: "Privacy policy", to: "/privacy" },
      { label: "Terms of service", to: "/terms" },
    ],
  },
];

export function PublicLayout({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-background">
      <div className="aurora" />
      <header className="relative z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "text-sm text-muted-foreground transition-colors hover:text-foreground",
                  location.pathname === item.to && "text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden rounded-full sm:inline-flex">
              <Link to="/guard/login">Log in</Link>
            </Button>
            <Button asChild className="hidden rounded-full sm:inline-flex">
              <Link to="/guard/register">Sign up</Link>
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full lg:hidden">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="mt-6 flex flex-col gap-1">
                  {NAV.map((item) => (
                    <Link key={item.to} to={item.to} className="rounded-full px-3 py-2 text-sm hover:bg-secondary" onClick={() => setOpen(false)}>
                      {item.label}
                    </Link>
                  ))}
                  <div className="my-2 h-px bg-border" />
                  <Link to="/guard/login" className="rounded-full px-3 py-2 text-sm hover:bg-secondary" onClick={() => setOpen(false)}>Log in</Link>
                  <Link to="/guard/register" className="rounded-full px-3 py-2 text-sm hover:bg-secondary" onClick={() => setOpen(false)}>Sign up</Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className={cn("relative z-10", bare ? "" : "mx-auto max-w-6xl px-4 pb-24 sm:px-6")}>{children}</main>
      <HelpWidget />

      <footer className="relative z-10 border-t bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-10 pb-28 sm:px-6 sm:pb-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <Logo />
              <p className="mt-3 max-w-xs text-xs text-muted-foreground">
                Analyze, explain, authorize, and verify — never blindly execute.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title} className="col-span-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.title}</h3>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.to + l.label}>
                      <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 border-t pt-6 text-xs text-muted-foreground">
            <p>
              PoisonGuard provides risk analysis, not financial or legal advice. Completed blockchain transfers may be
              irreversible. No metric on this site proves an address or transaction is safe.
            </p>
            <p className="mt-2">© 2026 PoisonGuard. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
