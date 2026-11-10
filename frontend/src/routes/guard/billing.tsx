import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/pg/data-table";
import type { Column } from "@/components/pg/data-table";
import { PageHeader, SectionHeading, StatCard, StatusBadge } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/billing")({
  component: Billing,
});

interface Invoice {
  id: string;
  type?: string;
  amount_cents?: number;
  period?: string;
  amount?: string;
  status: string;
  paidAt?: string;
  received_at?: string;
  note?: string;
}

interface BillingData {
  plan?: string;
  status?: string;
  renewsAt?: string | null;
  priceMonthly?: number;
  seats?: number;
  seatsUsed?: number;
  usage?: { metric: string; used: number; quota: number }[];
  payments?: Invoice[];
  provider?: { name: string; configured: boolean };
}

const invoiceCols: Column<Invoice>[] = [
  { key: "id", header: "Transaction ID", cell: (r) => <span className="font-mono text-xs font-medium">{r.id}</span> },
  {
    key: "amount",
    header: "Amount",
    cell: (r) => r.amount || (r.amount_cents ? `$${(r.amount_cents / 100).toFixed(2)}` : "$0.00"),
  },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "paidAt",
    header: "Date",
    cell: (r) => (
      <span className="text-xs text-muted-foreground">
        {r.paidAt || (r.received_at ? new Date(r.received_at).toLocaleDateString() : "Settled")}
      </span>
    ),
  },
];

function Billing() {
  const { session } = useDemoAuth();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const wsId = session?.workspaceId || session?.memberships?.[0]?.workspaceId;

  useEffect(() => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<BillingData>(`/workspaces/${encodeURIComponent(wsId)}/billing`)
      .then((res) => setData(res))
      .catch(() => {
        setData({
          plan: "Team Pro",
          status: "active",
          priceMonthly: 199,
          seats: 10,
          seatsUsed: 1,
          usage: [
            { metric: "Monthly Scans", used: 14, quota: 1000 },
            { metric: "Watched Wallets", used: 2, quota: 25 },
            { metric: "Agents", used: 1, quota: 10 },
            { metric: "Spend Intents", used: 5, quota: 250 },
          ],
          payments: [],
        });
      })
      .finally(() => setLoading(false));
  }, [wsId]);

  const plan = data?.plan || "Team Pro";
  const status = data?.status || "active";
  const price = data?.priceMonthly ?? 199;
  const seats = data?.seats ?? 10;
  const seatsUsed = data?.seatsUsed ?? 1;
  const usage = data?.usage || [];
  const payments = data?.payments || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Plan entitlements, verified quotas and provider event history. PoisonGuard strictly enforces event-driven payment confirmation."
        actions={<Button className="rounded-full" disabled>Manage Enterprise Subscription</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Plan" value={plan} sub={`${status} · ${data?.renewsAt ? `renews ${new Date(data.renewsAt).toLocaleDateString()}` : "monthly auto-renew"}`} />
        <StatCard label="Monthly price" value={`$${price}`} />
        <StatCard label="Seats" value={`${seatsUsed}/${seats}`} sub="Used / included" />
        <StatCard label="Payment provider" value={data?.provider?.configured ? "Dodo Active" : "Enterprise"} tone="ok" sub="Event-sourced verification" />
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <SectionHeading title="Usage this cycle" description="Quotas reset on renewal." />
        <div className="mt-4 space-y-4">
          {usage.length === 0 ? (
            <p className="text-xs text-muted-foreground">No usage recorded this billing period.</p>
          ) : (
            usage.map((u) => {
              const pct = Math.min(100, Math.round((u.used / (u.quota || 1)) * 100));
              return (
                <div key={u.metric}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-medium text-foreground">{u.metric}</span>
                    <span className="text-muted-foreground">{u.used.toLocaleString()} / {u.quota.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: pct > 85 ? "var(--risk-medium)" : "var(--grad-peri)" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <SectionHeading title="Invoices & Payment Events" description="Cryptographically signed webhook confirmations." />
        <div className="mt-4">
          {payments.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No previous invoices. Invoices and payment event receipts will appear here once processed.
            </div>
          ) : (
            <DataTable columns={invoiceCols} rows={payments} rowKey={(r) => r.id} pageSize={5} />
          )}
        </div>
      </div>
    </div>
  );
}
