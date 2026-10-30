import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "./api";

export type DemoRole = "guard" | "admin";

export interface WorkspaceMembership {
  workspaceId: string;
  role: string;
  workspaceName?: string;
  slug?: string;
  workspace?: {
    id: string;
    name: string;
    slug?: string;
  };
}

export interface DemoSession {
  role: DemoRole;
  id?: string;
  email: string;
  name: string;
  workspace: string;
  workspaceId?: string;
  memberships?: WorkspaceMembership[];
}

const STORAGE_KEY = "pg-demo-session";
const ACTIVE_WS_KEY = "pg-workspace-id";

interface DemoAuthValue {
  session: DemoSession | null;
  ready: boolean;
  signIn: (
    role: DemoRole,
    email: string,
    name: string,
    id?: string,
    workspaceId?: string,
    workspaceName?: string,
    memberships?: WorkspaceMembership[],
  ) => void;
  switchWorkspace: (workspaceId: string, workspaceName: string) => void;
  signOut: () => void;
  refreshSession: () => Promise<void>;
}

const DemoAuthContext = createContext<DemoAuthValue>({
  session: null,
  ready: false,
  signIn: () => {},
  switchWorkspace: () => {},
  signOut: () => {},
  refreshSession: async () => {},
});

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [ready, setReady] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const res = await api<{
        user: { id: string; name: string; email: string };
        memberships: WorkspaceMembership[];
      }>("/auth/me");
      if (res?.user) {
        const mems = res.memberships || [];
        const savedWsId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_WS_KEY) : null;
        const activeMem = mems.find((m) => m.workspaceId === savedWsId) || mems[0];
        const wsName =
          activeMem?.workspaceName ||
          activeMem?.workspace?.name ||
          (res.user.name ? `${res.user.name}'s Workspace` : "My Workspace");
        const next: DemoSession = {
          role: "guard",
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          workspaceId: activeMem?.workspaceId || activeMem?.workspace?.id,
          workspace: wsName,
          memberships: mems,
        };
        setSession(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (next.workspaceId) window.localStorage.setItem(ACTIVE_WS_KEY, next.workspaceId);
      }
    } catch {
      // Offline or unauthenticated with cookie
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoSession;
        // Clean out legacy "Nordguard Labs" default for guard users
        if (parsed.role === "guard" && parsed.workspace === "Nordguard Labs") {
          parsed.workspace = parsed.name ? `${parsed.name}'s Workspace` : "My Workspace";
        }
        setSession(parsed);
      }
    } catch {
      /* ignore corrupt state */
    }
    setReady(true);
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(
    (
      role: DemoRole,
      email: string,
      name: string,
      id?: string,
      workspaceId?: string,
      workspaceName?: string,
      memberships?: WorkspaceMembership[],
    ) => {
      const defaultWsName = role === "admin" ? "Platform Staff" : `${name.trim()}'s Workspace`;
      const chosenWsName = workspaceName || defaultWsName;
      const next: DemoSession = {
        role,
        id,
        email,
        name,
        workspace: chosenWsName,
        workspaceId,
        memberships: memberships || [],
      };
      setSession(next);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (workspaceId) window.localStorage.setItem(ACTIVE_WS_KEY, workspaceId);
    },
    [],
  );

  const switchWorkspace = useCallback((wsId: string, wsName: string) => {
    setSession((prev) => {
      if (!prev) return null;
      const next: DemoSession = {
        ...prev,
        workspaceId: wsId,
        workspace: wsName,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(ACTIVE_WS_KEY, wsId);
      return next;
    });
    toast.success(`Switched to ${wsName}`);
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_WS_KEY);
    void api("/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <DemoAuthContext.Provider
      value={{ session, ready, signIn, switchWorkspace, signOut, refreshSession }}
    >
      {children}
    </DemoAuthContext.Provider>
  );
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
      toast.error(role === "admin" ? "Platform staff sign-in required" : "Sign-in required");
    }
  }, [ready, session, role]);
  return { session, ready, signOut };
}
