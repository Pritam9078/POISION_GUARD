/**
 * PoisonGuard assistant client.
 *  - askPlatform(): public help — answers about the platform from the published guide (no account, no workspace data)
 *  - askWorkspace(): Guard assistant — platform guide + your workspace knowledge base, role-aware, conversation memory
 * The assistant explains; it never approves, signs or changes anything.
 */
import { api } from "./api";

export interface AssistantCitation {
  ref: string;
  title: string;
  section: string;
  excerpt: string;
  documentId: string;
}

export interface AssistantAnswer {
  answer: string | null;
  route: "security_knowledge" | "finding_explanation" | "policy" | "account_billing" | "action_request" | "live_blockchain";
  /** "extractive" = quoted from sources (no generative model); "generative" = model-written, grounded and guarded */
  mode?: "extractive" | "generative";
  provider: string | null;
  citations: AssistantCitation[];
  answerSource?: { ref: string; title: string; section: string };
  uncertainty?: string;
  guardApplied?: boolean;
  conversationId?: string;
}

export function askPlatform(question: string) {
  return api<AssistantAnswer>("/assistant/ask", { method: "POST", body: { question } });
}

export function askWorkspace(workspaceId: string, message: string, opts: { conversationId?: string | undefined; findingId?: string | undefined } = {}) {
  return api<AssistantAnswer>(`/workspaces/${encodeURIComponent(workspaceId)}/assistant/chat`, {
    method: "POST",
    body: { message, ...opts },
  });
}

/** Resolves the signed-in user's current workspace id (remembered per browser). */
export async function currentWorkspaceId(): Promise<string | null> {
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("pg-workspace-id") : null;
    const me = await api<{ memberships: { workspaceId: string }[] }>("/auth/me");
    const ids = me.memberships.map((m) => m.workspaceId);
    const id = saved && ids.includes(saved) ? saved : ids[0] ?? null;
    if (id && typeof window !== "undefined") window.localStorage.setItem("pg-workspace-id", id);
    return id;
  } catch {
    return null;
  }
}
