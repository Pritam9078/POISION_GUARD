import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, DemoDataNote } from "@/components/pg/kit";
import { useDemoAuth } from "@/lib/demo-auth";

export const Route = createFileRoute("/guard/login")({
  component: GuardLogin,
});

function GuardLogin() {
  const { signIn } = useDemoAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const handle = (email.split("@")[0] ?? email).replace(/^./, (c) => c.toUpperCase());
      signIn("guard", email, handle);
      toast.success("Signed in — demo session active");
      navigate({ to: "/guard/overview" });
    }, 350);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora-strong" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight">Sign in to Guard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your workspace for wallets, agents and approvals.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/guard/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>
            </div>
            <div className="relative flex items-center">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to PoisonGuard?{" "}
          <Link to="/guard/register" className="font-medium text-foreground underline-offset-4 hover:underline">Create an account</Link>
        </p>
        <DemoDataNote className="mt-6" />
      </div>
    </div>
  );
}
