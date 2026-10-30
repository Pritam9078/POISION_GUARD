import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, SectionHeading, KeyValue } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/guard/settings")({
  component: Settings,
});

function Settings() {
  const { session, signOut } = useDemoAuth();
  const [prefs, setPrefs] = useState({
    poisoning: true,
    approvals: true,
    execution: true,
    digest: false,
    webhook: true,
  });

  // Change password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    toast.success("Preference updated");
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      toast.success("Password changed successfully.");
      setPwOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Workspace profile, security and notification preferences." />

      <div className="rounded-2xl border bg-card p-5">
        <SectionHeading title="Account" />
        <div className="grid gap-4 sm:grid-cols-3">
          <KeyValue label="Name">{session?.name || "User"}</KeyValue>
          <KeyValue label="Email">{session?.email || "—"}</KeyValue>
          <KeyValue label="Role">Owner</KeyValue>
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setPwOpen(true)}>
            <KeyRound className="mr-1.5 size-3.5" /> Change password
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => toast.info("Active sessions: 1 session active on this browser.")}
          >
            Manage sessions
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              signOut();
              toast.success("Signed out");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-5">
        <SectionHeading title="Notifications" description="Choose which security events notify you." />
        <div className="divide-y">
          {(
            [
              ["poisoning", "Poisoning patterns detected", "Watched wallets show lookalike or dust activity"],
              ["approvals", "Approval required", "A spend intent is waiting for an approver"],
              ["execution", "Execution updates", "Submission, confirmation and reconciliation results"],
              ["digest", "Weekly digest", "Summary email of findings and policy changes"],
              ["webhook", "Webhook delivery", "Push events to your configured endpoint"],
            ] as const
          ).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch checked={prefs[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-5">
        <SectionHeading title="Workspace & data" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/guard/workspaces">Workspace profile</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/guard/api-keys">API & webhooks</Link>
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => toast.info("Retention policy: Security findings & scan records are retained for 90 days.")}
          >
            Retention preferences
          </Button>
        </div>
      </div>

      {/* Change Password Modal */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new password of at least 8 characters.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw">Current Password</Label>
              <div className="relative flex items-center">
                <Input
                  id="current-pw"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New Password</Label>
              <div className="relative flex items-center">
                <Input
                  id="new-pw"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pwBusy}>
                {pwBusy ? "Updating…" : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
