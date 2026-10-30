import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Logo, DemoDataNote } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
});

function AdminLogin() {
  const { signIn } = useDemoAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter your staff email.");
      return;
    }
    if (password.length < 12) {
      toast.error("Privileged accounts require a 12+ character password (demo policy).");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const handle = (email.split("@")[0] ?? email).replace(/^./, (c) => c.toUpperCase());
      signIn("admin", email, `${handle} (staff)`);
      toast.success("Signed in as platform staff (demo)");
      navigate({ to: "/admin" });
    }, 350);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora-strong" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8">
        <div className="flex items-center justify-between">
          <Logo to="/admin/login" />
          <Badge variant="secondary" className="rounded-full uppercase">Staff</Badge>
        </div>
        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight">Platform sign-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Authorized PoisonGuard staff only. Customer funds and approvals are never accessible from this console.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="a-email">Staff email</Label>
            <Input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@poisonguard.example" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-password">Password</Label>
            <div className="relative flex items-center">
              <Input
                id="a-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="12+ characters"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy ? "Verifying…" : "Sign in"}
          </Button>
        </form>
        <DemoDataNote className="mt-6" />
      </div>
    </div>
  );
}
