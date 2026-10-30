import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { networkName, type Severity } from "@/lib/fixtures";

/* ------------------------------------------------------------------ brand */

export function PoisonGuardMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="8 3 48 58" className={className} role="img" aria-label="PoisonGuard mark">
      <defs>
        <linearGradient id="pg-mark-gm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#CFE0FB" />
          <stop offset="0.5" stopColor="#8DA6F4" />
          <stop offset="1" stopColor="#A99AF6" />
        </linearGradient>
      </defs>
      <path
        d="M30.2 5.2a4 4 0 0 1 3.6 0L50.6 12a4 4 0 0 1 2.4 3.7V30C53 43.5 44 53 32 59.5 20 53 11 43.5 11 30V15.7a4 4 0 0 1 2.4-3.7Z"
        fill="#0F1115"
      />
      <circle cx="32" cy="31.5" r="11.5" fill="none" stroke="#FFFFFF" strokeWidth="3" />
      <circle cx="32" cy="31.5" r="5.5" fill="url(#pg-mark-gm)" />
    </svg>
  );
}

export function Logo({ to = "/", light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 group">
      <PoisonGuardMark className="size-7 transition-transform group-hover:scale-105" />
      <span className={cn("font-display text-lg font-medium tracking-tight", light ? "text-white" : "text-foreground")}>
        PoisonGuard
      </span>
    </Link>
  );
}

export function DemoDataNote(_props?: { className?: string }) {
  return null;
}

/* ----------------------------------------------------------------- badges */

const severityStyles: Record<Severity, string> = {
  critical: "bg-[color-mix(in_oklab,var(--risk-critical)_12%,transparent)] text-[var(--risk-critical)] border-[color-mix(in_oklab,var(--risk-critical)_25%,transparent)]",
  high: "bg-[color-mix(in_oklab,var(--risk-high)_12%,transparent)] text-[var(--risk-high)] border-[color-mix(in_oklab,var(--risk-high)_25%,transparent)]",
  medium: "bg-[color-mix(in_oklab,var(--risk-medium)_12%,transparent)] text-[var(--risk-medium)] border-[color-mix(in_oklab,var(--risk-medium)_25%,transparent)]",
  low: "bg-[color-mix(in_oklab,var(--risk-low)_12%,transparent)] text-[var(--risk-low)] border-[color-mix(in_oklab,var(--risk-low)_25%,transparent)]",
  info: "bg-muted text-muted-foreground border-border",
};

export function SeverityBadge({ severity, label }: { severity: Severity; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", severityStyles[severity])}>
      <span className="size-1.5 rounded-full bg-current" />
      {label ?? severity}
    </span>
  );
}

const statusTone: Record<string, "ok" | "warn" | "bad" | "muted" | "info"> = {
  completed: "ok", active: "ok", confirmed: "ok", approved: "ok", operational: "ok", verified: "ok", published: "ok", indexed: "ok", paid: "ok", allow: "ok", pass: "ok",
  processing: "info", submitted: "info", pending: "info", pending_approval: "info", under_review: "info", pending_review: "info", evaluated: "info", ready_for_signing: "info", investigating: "warn", degraded: "warn", partial: "warn", warn: "warn", draft: "muted",
  failed: "bad", denied: "bad", expired: "bad", cancelled: "bad", reverted: "bad", failed_provider: "bad", mismatch: "bad", reconciliation_mismatch: "bad", offline: "bad", revoked: "bad", disabled: "bad", archived: "muted",
};

function toneClass(tone: string) {
  switch (tone) {
    case "ok": return "bg-[color-mix(in_oklab,var(--risk-ok)_12%,transparent)] text-[var(--risk-ok)] border-[color-mix(in_oklab,var(--risk-ok)_25%,transparent)]";
    case "warn": return severityStyles.medium;
    case "bad": return severityStyles.critical;
    case "info": return "bg-[color-mix(in_oklab,var(--risk-low)_10%,transparent)] text-[var(--risk-low)] border-[color-mix(in_oklab,var(--risk-low)_22%,transparent)]";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? "muted";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", toneClass(tone))}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function NetworkBadge({ network }: { network: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      {networkName(network)}
    </span>
  );
}

export function RiskScoreBadge({ score, label }: { score: number; label: string }) {
  const sev: Severity = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : score === 0 ? "info" : "low";
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-16 place-items-center rounded-2xl border bg-card">
        <span className="font-display text-xl font-medium">{score}</span>
        <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r="28" fill="none" stroke={`var(--risk-${sev === "info" ? "low" : sev})`} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 176} 176`}
          />
        </svg>
      </div>
      <div>
        <div className={cn("text-sm font-semibold capitalize", score >= 50 ? "text-[var(--risk-high)]" : "")}>{label}</div>
        <div className="text-xs text-muted-foreground">0 = no evidence · 100 = severe</div>
      </div>
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-grad-violet" style={{ width: `${value}%`, backgroundColor: "var(--grad-violet)" }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}% confidence</span>
    </div>
  );
}

/* --------------------------------------------------------------- address */

export function AddressDisplay({ address, full = false }: { address: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  const short = full ? address : `${address.slice(0, 10)}…${address.slice(-8)}`;
  return (
    <button
      type="button"
      className="group inline-flex items-center gap-1.5 mono text-xs text-foreground"
      onClick={() => {
        navigator.clipboard?.writeText(address).then(() => {
          setCopied(true);
          toast.success("Address copied");
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy full address"
    >
      <span>{short}</span>
      {copied ? <Check className="size-3 text-[var(--risk-ok)]" /> : <Copy className="size-3 opacity-40 group-hover:opacity-100" />}
    </button>
  );
}

/* -------------------------------------------------------------- structure */

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6">
      {backTo && (
        <Link to={backTo} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          ← {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "bad" | "warn" | "ok" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-medium tracking-tight", tone === "bad" && "text-[var(--risk-critical)]", tone === "warn" && "text-[var(--risk-medium)]", tone === "ok" && "text-[var(--risk-ok)]")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function SectionHeading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="font-display text-lg font-medium tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

/* ----------------------------------------------------------------- states */

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </div>
      <h3 className="mt-3 font-display text-base font-medium">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-12 text-sm text-muted-foreground">
      <span className="size-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
      {label}
    </div>
  );
}

export function ErrorState({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-12 text-center">
      <SeverityBadge severity="high" label="Error" />
      <h3 className="mt-3 font-display text-base font-medium">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {retry && <Button variant="outline" className="mt-4 rounded-full" onClick={retry}>Try again</Button>}
    </div>
  );
}

export function PermissionDenied({ role }: { role: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-12 text-center">
      <SeverityBadge severity="medium" label="Permission denied" />
      <h3 className="mt-3 font-display text-base font-medium">Your role can't perform this action</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Required role: {role}. In the real product this is enforced by the backend — this demo mirrors it in the interface.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ filter bar */

export function FilterBar({ children, search, onSearch, placeholder }: { children?: ReactNode; search?: string; onSearch?: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {onSearch && (
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder ?? "Search…"}
          className="h-9 w-full max-w-xs rounded-full bg-card"
        />
      )}
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- timeline */

export function StatusTimeline({ steps, current }: { steps: { key: string; label: string; at?: string }[]; current: number }) {
  return (
    <ol className="relative space-y-0">
      {steps.map((s, i) => {
        const done = i <= current;
        const failed = current < 0;
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className={cn("absolute left-[9px] top-5 h-full w-px", done && !failed ? "bg-[var(--risk-ok)]" : "bg-border")} />}
            <span className={cn("z-10 mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border-2 bg-card", done && !failed ? "border-[var(--risk-ok)]" : "border-border")}>
              {done && !failed && <span className="size-2 rounded-full bg-[var(--risk-ok)]" />}
              {failed && i === 0 && <span className="size-2 rounded-full bg-[var(--risk-critical)]" />}
            </span>
            <div className="min-w-0">
              <div className={cn("text-sm font-medium", !done && "text-muted-foreground")}>{s.label}</div>
              {s.at && <div className="text-xs text-muted-foreground">{s.at}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-full" onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* lazy re-exports keep page files short */
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export { Badge };
