import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/pg/kit";

export const Route = createFileRoute("/guard/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password.length < 10) {
      setErr("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm">
        <Logo to="/" />
        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight">Set new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a secure password for your PoisonGuard account.
        </p>

        {done ? (
          <div className="mt-6 rounded-2xl bg-emerald-500/10 p-5 text-center text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mx-auto size-6" />
            <h3 className="mt-2 text-sm font-medium">Password Updated</h3>
            <p className="mt-1 text-xs text-muted-foreground">Your password has been changed successfully.</p>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/guard/login">Proceed to Login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 rounded-full"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 rounded-full"
                required
              />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <Button type="submit" className="w-full rounded-full py-6">
              Update Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

