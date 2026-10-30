/**
 * Demo-only frontend auth for the PoisonGuard frontend build.
 *
 * This is NOT real security: it is a localStorage demo session used to gate
 * the /guard and /admin experiences in this frontend-only phase. Real
 * authentication, sessions, CSRF and server-side authorization come with the
 * backend phase.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type DemoRole = "guard" | "admin";

export interface DemoSession {
  role: DemoRole;
  email: string;
  name: string;
  workspace: string;
}

const STORAGE_KEY = "pg-demo-session";

interface DemoAuthValue {
  session: DemoSession | null;
  ready: boolean;
  signIn: (role: DemoRole, email: string, name: string) => void;
  signOut: () => void;
}

const DemoAuthContext = createContext<DemoAuthValue>({
  session: null,
  ready: false,
  signIn: () => {},
  signOut: () => {},
});

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as DemoSession);
    } catch {
      /* ignore corrupt demo state */
    }
    setReady(true);
  }, []);

  const signIn = useCallback((role: DemoRole, email: string, name: string) => {
    const next: DemoSession = {
      role,
      email,
      name,
      workspace: role === "guard" ? "Nordguard Labs" : "Platform staff",
    };
    setSession(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return <DemoAuthContext.Provider value={{ session, ready, signIn, signOut }}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth() {
  return useContext(DemoAuthContext);
}

/** Convenience hook for layout components: redirects to the right login page. */
export function useRequireDemoAuth(role: DemoRole) {
  const { session, ready, signOut } = useDemoAuth();
  useEffect(() => {
    if (!ready) return;
    if (!session || session.role !== role) {
      toast.error(role === "admin" ? "Platform staff sign-in required (demo)" : "Guard sign-in required (demo)");
    }
  }, [ready, session, role]);
  return { session, ready, signOut };
}
