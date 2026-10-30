import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { DataTable, type Column } from "@/components/pg/data-table";
import { PageHeader, StatusBadge, DemoDataNote } from "@/components/pg/kit";
import { ADMIN_BILLING_EVENTS } from "@/lib/fixtures";

export const Route = createFileRoute("/admin/billing")({
  component: AdminBillingPage,
});

interface BillingEventRow {
  id: string;
  workspace: string;
  type: string;
  amount: string;
  status: string;
  at: string;
  note: string;
}

const cols: Column<BillingEventRow>[] = [
  { key: "id", header: "Invoice / Charge", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
  { key: "workspace", header: "Customer Workspace", cell: (r) => <span className="font-medium">{r.workspace}</span> },
  { key: "type", header: "Event Type", cell: (r) => <span className="text-xs">{r.type}</span> },
  { key: "amount", header: "Amount", cell: (r) => <span className="font-medium">{r.amount}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "at", header: "Date", cell: (r) => <span className="text-xs text-muted-foreground">{r.at}</span> },
];

function AdminBillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription Management"
        description="Dodo Payments webhooks, customer invoices, revenue tracking, and payment reconciliation."
      />

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <DataTable columns={cols} rows={ADMIN_BILLING_EVENTS} rowKey={(r) => r.id} />
      </div>

      <DemoDataNote />
    </div>
  );
}

