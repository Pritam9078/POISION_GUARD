import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/pg/data-table";
import type { Column } from "@/components/pg/data-table";
import { PageHeader, SectionHeading, StatCard, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { INVOICES, SUBSCRIPTION } from "@/lib/fixtures";

export const Route = createFileRoute("/guard/billing")({
  component: Billing,
});

interface Invoice { id: string; period: string; amount: string; status: string; paidAt: string; note?: string }
const invoiceCols: Column<Invoice>[] = [
  { key: "id", header: "Invoice", cell: (r) => <span className="font-medium">{r.id}</span> },
  { key: "period", header: "Period", cell: (r) => r.period },
  { key: "amount", header: "Amount", cell: (r) => r.amount },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "paidAt", header: "Paid", cell: (r) => r.paidAt + (r.note ? ` · ${r.note}` : "") },
];

function Billing() {
  return (
    <div>
      <PageHeader
        title="Billing"
        description="Plan, usage and payment history. Payment state is verified through provider events in the real product — never a frontend redirect alone."
        actions={<Button className="rounded-full" disabled>Upgrade plan — payments pending</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Plan" value={SUBSCRIPTION.plan} sub={`${SUBSCRIPTION.status} · renews ${SUBSCRIPTION.renewsAt}`} />
        <StatCard label="Monthly price" value={`$${SUBSCRIPTION.priceMonthly}`} />
        <StatCard label="Seats" value={`${SUBSCRIPTION.seatsUsed}/${SUBSCRIPTION.seats}`} sub="Used / included" />
        <StatCard label="Payment events" value="Verified" tone="ok" sub="Provider-event sourced (demo)" />
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-5">
        <SectionHeading title="Usage this cycle" description="Quotas reset on renewal." />
        <div className="space-y-3">
          {SUBSCRIPTION.usage.map((u) => {
            const pct = Math.min(100, Math.round((u.used / u.quota) * 100));
            return (
              <div key={u.metric}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{u.metric}</span>
                  <span className="text-muted-foreground">{u.used.toLocaleString()} / {u.quota.toLocaleString()}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 85 ? "var(--risk-medium)" : "var(--grad-peri)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeading title="Invoices" />
        <DataTable columns={invoiceCols} rows={INVOICES as Invoice[]} rowKey={(r) => r.id} pageSize={5} />
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="rounded-full">Note</Badge>
          Upgrade, cancellation and proration workflows require the payment backend — buttons are intentionally disabled until then.
        </div>
      </div>

      <DemoDataNote className="mt-6" />
    </div>
  );
}
