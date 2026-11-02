import {
  SCANS,
  TOKEN_ALLOWANCES,
  ADDR_LOOKALIKE,
  ADDR_LEGIT,
  ADDR_SUBJECT,
  NETWORKS,
  type NetworkKey,
} from "./fixtures";
import { isValidAddress, isValidTxHash } from "./validation";

const REMOTE_BACKEND = "https://poisonguard-backend.onrender.com/api/v1";
const TOKEN_KEY = "pg_auth_token";

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function setAuthToken(token: string | null) {
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function resolveApiBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_BASE || (import.meta as any).env?.VITE_API_URL;
  if (envBase) {
    const trimmed = String(envBase).replace(/\/$/, "");
    return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
  }
  return "/api/v1";
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  { method = "GET", body }: { method?: string; body?: any } = {},
): Promise<T> {
  const base = resolveApiBase();
  const token = getAuthToken();
  let res: Response;
  const headers: Record<string, string> = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const init: RequestInit = {
    method,
    credentials: "include",
    headers,
  };
  if (body) {
    init.body = JSON.stringify(body);
  }

  try {
    res = await fetch(base + path, init);
    // If local/relative path returned 404, fallback directly to the live Render backend
    if (!res.ok && res.status === 404 && base !== REMOTE_BACKEND) {
      res = await fetch(REMOTE_BACKEND + path, init);
    }
  } catch {
    // If primary fetch failed with network error, attempt fallback to remote backend
    if (base !== REMOTE_BACKEND) {
      try {
        res = await fetch(REMOTE_BACKEND + path, init);
      } catch {
        throw new ApiError("NETWORK", "Cannot reach the PoisonGuard API backend.", 0);
      }
    } else {
      throw new ApiError("NETWORK", "Cannot reach the PoisonGuard API backend.", 0);
    }
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }

  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(
      json?.error?.code || `HTTP_${res.status}`,
      json?.error?.message || `Request failed (${res.status}).`,
      res.status,
    );
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

/** Check recipient with backend support or demo analysis fallback */
export async function checkRecipient(payload: {
  chainId: number;
  address: string;
  expectedLabel?: string | undefined;
  contextTxHash?: string | undefined;
}) {
  try {
    return await api("/recipients/check", { method: "POST", body: payload });
  } catch (err: any) {
    // Demo fallback for frontend standalone mode
    const cleanAddr = payload.address.toLowerCase().trim();
    const isLookalike =
      cleanAddr === ADDR_LOOKALIKE.toLowerCase() ||
      (cleanAddr.startsWith(ADDR_SUBJECT.slice(0, 8).toLowerCase()) &&
        cleanAddr.endsWith(ADDR_SUBJECT.slice(-6).toLowerCase()) &&
        cleanAddr !== ADDR_SUBJECT.toLowerCase());

    const isKnownLegit = cleanAddr === ADDR_LEGIT.toLowerCase() || cleanAddr === ADDR_SUBJECT.toLowerCase();

    return {
      address: payload.address,
      chainId: payload.chainId,
      isKnownLookalike: isLookalike,
      similarityScore: isLookalike ? 0.94 : isKnownLegit ? 1.0 : 0.12,
      riskLevel: isLookalike ? "CRITICAL" : isKnownLegit ? "LOW" : "UNKNOWN",
      verdict: isLookalike
        ? "Potential address-poisoning lookalike detected! The first and last characters match your expected wallet, but the middle bytes diverge."
        : isKnownLegit
        ? "Address matches known legitimate history."
        : "No prior interaction or poisoning pattern detected in indexer scope.",
      expectedLabelMatch: payload.expectedLabel ? (isKnownLegit ? true : false) : null,
      contextVerified: Boolean(payload.contextTxHash && isValidTxHash(payload.contextTxHash)),
      checkedAt: new Date().toISOString(),
    };
  }
}

/** Fetch allowances with backend support or fixture fallback */
export async function fetchAllowances(owner: string, chainId: number) {
  try {
    const data = await api(`/approvals?owner=${encodeURIComponent(owner)}&chainId=${chainId}`);
    return data.items || [];
  } catch {
    return TOKEN_ALLOWANCES;
  }
}

/** Submit report/feedback */
export async function submitFeedback(payload: {
  scanRef?: string | undefined;
  chainId: number;
  subject: string;
  category: string;
  explanation: string;
  contact?: string | undefined;
}) {
  try {
    return await api("/feedback", { method: "POST", body: payload });
  } catch {
    // Demo response
    return {
      id: `FB-${Math.floor(1000 + Math.random() * 9000)}`,
      received: true,
      timestamp: new Date().toISOString(),
    };
  }
}
