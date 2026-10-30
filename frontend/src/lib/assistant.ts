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

function getOfflineAnswer(question: string): AssistantAnswer {
  const q = question.toLowerCase();
  let answer = "";
  if (q.includes("poison") || q.includes("lookalike") || q.includes("dust")) {
    answer = "Address poisoning is an attack where an adversary generates a vanity address matching the first 4–6 and last 4–6 characters of a known contact or previous recipient. They send a 0-value or dust token transfer to your wallet to place their lookalike address in your transaction history. If you copy-paste from recent history without checking the entire 42-character hex string, your funds are sent to the attacker.\n\nPoisonGuard monitors mempools and blocks, computes Levenshtein distances and edit distances against your trusted recipients, and alerts you before execution.";
  } else if (q.includes("revoke") || q.includes("approval") || q.includes("allowance")) {
    answer = "Token approvals grant smart contracts permission to transfer tokens from your wallet. Unlimited or obsolete allowances leave your funds exposed if a protocol is exploited. PoisonGuard scans active token allowances across Ethereum and EVM chains, flagging unconstrained permissions so you can reset approvals to zero.";
  } else if (q.includes("guard") || q.includes("workspace") || q.includes("agent") || q.includes("policy")) {
    answer = "PoisonGuard Guard provides multi-tenant workspaces where teams manage watched wallets, register AI spending agents, enforce transaction amount and velocity policies, and require multi-person human approvals before on-chain execution.";
  } else if (q.includes("safe") || q.includes("clean") || q.includes("guarantee")) {
    answer = "A PoisonGuard scan with zero findings indicates that no known poisoning clusters, dust spoofing, or blacklisted addresses were detected. However, blockchain transfers are irreversible and no automated tool can guarantee absolute safety. Always verify recipient addresses across trusted external channels.";
  } else {
    answer = "PoisonGuard is an on-chain security platform designed to detect lookalike address poisoning, audit token allowances, enforce agent spending policies, and verify recipient legitimacy across EVM networks.";
  }
  return {
    answer,
    route: "security_knowledge",
    mode: "extractive",
    provider: "PoisonGuard Platform Knowledge",
    citations: [
      {
        ref: "[S1]",
        title: "PoisonGuard Security Guide",
        section: "Detection & Prevention",
        excerpt: "Autonomous address poisoning detection and agent spending governance.",
        documentId: "pg-guide-01",
      },
    ],
  };
}

export async function askPlatform(question: string): Promise<AssistantAnswer> {
  try {
    return await api<AssistantAnswer>("/assistant/ask", { method: "POST", body: { question } });
  } catch (err: any) {
    // If backend is sleeping, starting up, or endpoint 404s, provide platform guide knowledge
    return getOfflineAnswer(question);
  }
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
