/**
 * PoisonGuard demo fixtures.
 *
 * Everything in this module is clearly-labeled DEVELOPMENT/DEMO data for the
 * frontend-only build. It is never live production evidence. A later phase
 * replaces this layer with real backend API responses.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type NetworkKey = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon" | "bsc";

export interface Network {
  key: NetworkKey;
  name: string;
  chainId: number;
  symbol: string;
  explorer: string;
  capabilities: string[];
  status: "operational" | "degraded" | "offline";
}

export const NETWORKS: Network[] = [
  { key: "ethereum", name: "Ethereum", chainId: 1, symbol: "ETH", explorer: "etherscan.io", capabilities: ["scan", "approvals", "monitoring", "revoke"], status: "operational" },
  { key: "base", name: "Base", chainId: 8453, symbol: "ETH", explorer: "basescan.org", capabilities: ["scan", "approvals", "monitoring", "revoke"], status: "operational" },
  { key: "arbitrum", name: "Arbitrum One", chainId: 42161, symbol: "ETH", explorer: "arbiscan.io", capabilities: ["scan", "approvals", "monitoring", "revoke"], status: "operational" },
  { key: "optimism", name: "OP Mainnet", chainId: 10, symbol: "ETH", explorer: "optimistic.etherscan.io", capabilities: ["scan", "approvals", "monitoring"], status: "operational" },
  { key: "polygon", name: "Polygon PoS", chainId: 137, symbol: "POL", explorer: "polygonscan.com", capabilities: ["scan", "approvals", "monitoring"], status: "degraded" },
  { key: "bsc", name: "BNB Smart Chain", chainId: 56, symbol: "BNB", explorer: "bscscan.com", capabilities: ["scan", "monitoring"], status: "operational" },
];

export const networkName = (key: string) => NETWORKS.find((n) => n.key === key)?.name ?? key;

/* ---------------------------------------------------------------- scans */

export interface Finding {
  id: string;
  category: string;
  title: string;
  severity: Severity;
  confidence: number; // 0-100
  method: string;
  detectedAt: string;
  summary: string;
  evidence: { label: string; source: string; value: string }[];
  limitations: string;
  recommendation: string;
}

export interface Scan {
  id: string;
  subject: string;
  subjectType: "address" | "transaction";
  network: NetworkKey;
  status: "completed" | "processing" | "failed" | "partial";
  riskScore: number; // 0-100 (higher = riskier)
  riskLabel: "critical" | "high" | "elevated" | "low" | "inconclusive";
  requestedAt: string;
  completedAt: string;
  findings: Finding[];
  coverage: { source: string; status: "covered" | "partial" | "unavailable"; note: string }[];
  summary: string;
  isExample?: boolean;
}

const LOOKALIKE_A = "0x7a9E... lookalike expanded below";
export const ADDR_SUBJECT = "0x7a9e4f3b1c2d5e6f8091a2b3c4d5e6f708192a3b";
export const ADDR_LOOKALIKE = "0x7a9e4f3b1c2d5e6f8091a2b3c4d5e6f708192a3d";
export const ADDR_LEGIT = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
export const USER_WALLET = "0x2f35DdE62dcb85dC7d8C56B45ce7f16b9333A0a8";
export const TX_SUBJECT = "0x9f2c8b4e7a1d6f3e5b8c0a2d4f6e8b1c3a5d7f9e1b2c4a6d8e0f2b4c6a8d0f2b";

const baseFindings: Finding[] = [
  {
    id: "F-1041",
    category: "Address poisoning",
    title: "Lookalike address in transfer history",
    severity: "high",
    confidence: 86,
    method: "Edit-distance similarity + zero-value transfer pattern (rules v1.3)",
    detectedAt: "2026-10-27T14:22:05Z",
    summary:
      "A zero-value token transfer involved an address that differs from a known recipient of this wallet by a single character. This is a common address-poisoning setup step, not proof of any loss.",
    evidence: [
      { label: "Lookalike address", source: "Token transfer log", value: ADDR_LOOKALIKE },
      { label: "Known legitimate recipient", source: "Workspace trusted recipients", value: ADDR_LEGIT },
      { label: "Similarity", source: "Detection rule", value: "Edit distance 1 · Levenshtein 0.97" },
      { label: "Transfer", source: "ERC-20 Transfer event", value: "value = 0 · 2026-10-26 09:14 UTC" },
    ],
    limitations: "Similarity alone does not prove malicious intent. Some lookalike addresses belong to vanity-address users; no prior loss event was observed.",
    recommendation: "Always paste recipients from your trusted list. Verify at least the first 6 and last 6 characters against the /check-recipient tool.",
  },
  {
    id: "F-1042",
    category: "Dust pattern",
    title: "Repeated zero-value transfers from unrelated senders",
    severity: "medium",
    confidence: 71,
    method: "Graph clustering (rules v1.3)",
    detectedAt: "2026-10-27T14:22:05Z",
    summary:
      "4 zero-value transfers from addresses sharing funding sources within 48 hours. Repeated dust patterns often precede a poisoning campaign.",
    evidence: [
      { label: "Cluster size", source: "Transfer graph", value: "4 addresses, common funder 0x5f2c...9b1e" },
      { label: "Window", source: "Block timestamps", value: "2026-10-25 → 2026-10-27" },
    ],
    limitations: "Airdrop campaigns (legitimate) can produce similar patterns. Only 30 days of indexer history were available.",
    recommendation: "Hide zero-value token transfers in your wallet and treat unsolicited airdrops as untrusted.",
  },
  {
    id: "F-1043",
    category: "Token approval",
    title: "Unlimited USDC allowance to unfamiliar spender",
    severity: "critical",
    confidence: 92,
    method: "allowance() inspection + spender reputation (rules v1.3)",
    detectedAt: "2026-10-27T14:22:06Z",
    summary:
      "An unlimited USDC allowance was granted to a spender with no known reputation and funded from the same cluster as the dust transfers.",
    evidence: [
      { label: "Spender", source: "EVM call", value: "0x5f2c44a7b01933881cc6ba3ed0b8f2a91e709b1e" },
      { label: "Allowance", source: "ERC-20 allowance()", value: "2^256-1 (unlimited)" },
      { label: "Granted in", source: "Receipt", value: "TX " + TX_SUBJECT.slice(0, 18) + "… · 2026-10-24" },
    ],
    limitations: "An approval existing is not proof it is malicious. Spender reputation is partial on smaller networks.",
    recommendation: "Revoke this allowance via the Revoke tool and re-check after the revocation is confirmed.",
  },
];

export const SCANS: Scan[] = [
  {
    id: "SC-2026-0412",
    subject: ADDR_SUBJECT,
    subjectType: "address",
    network: "ethereum",
    status: "completed",
    riskScore: 78,
    riskLabel: "high",
    requestedAt: "2026-10-27T14:21:58Z",
    completedAt: "2026-10-27T14:22:06Z",
    findings: baseFindings,
    summary:
      "Two address-poisoning indicators and one dangerous token approval were found. The address itself is not proven malicious — findings describe activity observed around it.",
    coverage: [
      { source: "EVM RPC (read-only)", status: "covered", note: "Balance, code, allowance reads succeeded" },
      { source: "Transfer indexer", status: "covered", note: "30-day ERC-20 transfer history" },
      { source: "Native TX history", status: "partial", note: "Provider limited to 10,000 recent blocks" },
      { source: "Threat intel feeds", status: "unavailable", note: "Feed not configured for this environment" },
    ],
  },
  {
    id: "SC-2026-0409",
    subject: ADDR_LEGIT,
    subjectType: "address",
    network: "base",
    status: "completed",
    riskScore: 12,
    riskLabel: "low",
    requestedAt: "2026-10-26T10:02:11Z",
    completedAt: "2026-10-26T10:02:19Z",
    findings: [],
    summary:
      "No poisoning indicators or risky approvals were detected in available data. This is NOT a guarantee the address is safe — coverage was partial (see Data Coverage).",
    coverage: [
      { source: "EVM RPC (read-only)", status: "covered", note: "Reads succeeded" },
      { source: "Transfer indexer", status: "partial", note: "Only 14 days of history returned" },
      { source: "Native TX history", status: "unavailable", note: "Provider quota exhausted during scan" },
      { source: "Threat intel feeds", status: "unavailable", note: "Feed not configured for this environment" },
    ],
  },
  {
    id: "SC-2026-0404",
    subject: TX_SUBJECT,
    subjectType: "transaction",
    network: "arbitrum",
    status: "completed",
    riskScore: 44,
    riskLabel: "elevated",
    requestedAt: "2026-10-25T18:40:00Z",
    completedAt: "2026-10-25T18:40:07Z",
    findings: [baseFindings[1] as Finding],
    summary: "One medium-severity dust-pattern finding applies to this transaction's counterparties.",
    coverage: [
      { source: "EVM RPC (read-only)", status: "covered", note: "Receipt replayed" },
      { source: "Transfer indexer", status: "covered", note: "Counterparty history retrieved" },
      { source: "Threat intel feeds", status: "unavailable", note: "Feed not configured" },
    ],
  },
  {
    id: "SC-2026-0398",
    subject: "0x3b1c9d2e7f4a8b6c0d5e3f1a9b7c5d3e1f0a2b4c",
    subjectType: "address",
    network: "optimism",
    status: "failed",
    riskScore: 0,
    riskLabel: "inconclusive",
    requestedAt: "2026-10-24T08:12:33Z",
    completedAt: "2026-10-24T08:12:41Z",
    findings: [],
    summary: "Scan failed: upstream transfer-indexer provider returned repeated 503s. No risk conclusion can be drawn.",
    coverage: [{ source: "EVM RPC (read-only)", status: "covered", note: "Reachable" }, { source: "Transfer indexer", status: "unavailable", note: "Provider outage (provider-hpi-3)" }],
  },
];

export const scanById = (id: string) => SCANS.find((s) => s.id === id);

/* -------------------------------------------------------------- wallets */

export interface WatchedWallet {
  id: string;
  label: string;
  address: string;
  network: NetworkKey;
  status: "active" | "paused";
  tags: string[];
  notes: string;
  monitoring: { frequency: string; alerts: string[]; lastChecked: string };
  addedBy: string;
  addedAt: string;
}

export const WALLETS: WatchedWallet[] = [
  { id: "W-201", label: "Treasury hot wallet", address: ADDR_SUBJECT, network: "ethereum", status: "active", tags: ["treasury", "ops"], notes: "Operational wallet — monitor closely.", monitoring: { frequency: "Every 5 minutes", alerts: ["Poisoning pattern", "New approval", "Large transfer"], lastChecked: "2026-10-29T05:02:00Z" }, addedBy: "Ava Chen", addedAt: "2026-09-02" },
  { id: "W-202", label: "Payroll safe", address: ADDR_LEGIT, network: "base", status: "active", tags: ["payroll"], notes: "", monitoring: { frequency: "Every 15 minutes", alerts: ["Poisoning pattern"], lastChecked: "2026-10-29T04:45:00Z" }, addedBy: "Ava Chen", addedAt: "2026-09-14" },
  { id: "W-203", label: "Ops signer", address: "0x3b1c9d2e7f4a8b6c0d5e3f1a9b7c5d3e1f0a2b4c", network: "optimism", status: "paused", tags: ["ops"], notes: "Paused during migration.", monitoring: { frequency: "Paused", alerts: [], lastChecked: "2026-10-20T09:00:00Z" }, addedBy: "Marcus Reid", addedAt: "2026-10-01" },
];

export const walletById = (id: string) => WALLETS.find((w) => w.id === id);

export interface TrustedRecipient {
  id: string;
  label: string;
  address: string;
  network: NetworkKey;
  description: string;
  acknowledgedRisk: boolean;
  status: "active" | "inactive";
  updatedBy: string;
  updatedAt: string;
}

export const RECIPIENTS: TrustedRecipient[] = [
  { id: "R-101", label: "Cold storage vault", address: ADDR_LEGIT, network: "ethereum", description: "Hardware wallet sweep destination.", acknowledgedRisk: true, status: "active", updatedBy: "Ava Chen", updatedAt: "2026-10-12" },
  { id: "R-102", label: "Fireblocks settlement", address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", network: "base", description: "Monthly settlement run.", acknowledgedRisk: true, status: "active", updatedBy: "Marcus Reid", updatedAt: "2026-10-08" },
  { id: "R-103", label: "Partner: NordPay", address: "0x53d284357ec70ce889d174ee24e601ac8a834449", network: "polygon", description: "", acknowledgedRisk: false, status: "inactive", updatedBy: "Ava Chen", updatedAt: "2026-09-28" },
];

/* --------------------------------------------------------------- agents */

export interface Agent {
  id: string;
  name: string;
  description: string;
  owner: string;
  environment: "production" | "staging" | "development";
  workspace: string;
  networks: NetworkKey[];
  permittedActions: string[];
  status: "active" | "disabled" | "pending_review";
  limits: { dailyUsd: number; perTxUsd: number };
  expiresAt: string;
  credentials: { id: string; label: string; prefix: string; createdAt: string; lastUsed: string; status: "active" | "revoked" }[];
  activity: { at: string; action: string; outcome: "allowed" | "blocked" | "pending"; detail: string }[];
  blockedRequests: { id: string; at: string; reason: string; intent: string }[];
  createdAt: string;
}

export const AGENTS: Agent[] = [
  {
    id: "AG-31",
    name: "treasury-rebalancer",
    description: "Rebalances idle USDC between treasury and yield vaults weekly.",
    owner: "Ava Chen",
    environment: "production",
    workspace: "Nordguard Labs",
    networks: ["ethereum", "base"],
    permittedActions: ["erc20.transfer", "vault.deposit"],
    status: "active",
    limits: { dailyUsd: 25000, perTxUsd: 10000 },
    expiresAt: "2026-12-31",
    credentials: [
      { id: "CR-71", label: "Primary key", prefix: "pgk_live_9a2f…", createdAt: "2026-09-20", lastUsed: "2026-10-29T03:12:00Z", status: "active" },
      { id: "CR-72", label: "Rotated key", prefix: "pgk_live_7c11…", createdAt: "2026-08-02", lastUsed: "2026-09-20T11:00:00Z", status: "revoked" },
    ],
    activity: [
      { at: "2026-10-29T03:12:00Z", action: "spend_intent.create", outcome: "pending", detail: "USDC 8,000 → yield vault (awaiting approval)" },
      { at: "2026-10-28T15:40:00Z", action: "spend_intent.execute", outcome: "allowed", detail: "USDC 5,200 → Cold storage vault" },
      { at: "2026-10-27T09:02:00Z", action: "spend_intent.create", outcome: "blocked", detail: "Exceeded per-tx limit (USDC 15,000)" },
    ],
    blockedRequests: [
      { id: "BR-88", at: "2026-10-27T09:02:00Z", reason: "Per-transaction limit exceeded (policy P-2, rule max_tx_usd)", intent: "USDC 15,000 → 0x53d2…4449" },
      { id: "BR-87", at: "2026-10-22T17:30:00Z", reason: "Recipient not on allowlist (policy P-2)", intent: "ETH 2.5 → 0xa9b1…77f0" },
    ],
    createdAt: "2026-08-02",
  },
  {
    id: "AG-32",
    name: "alerts-notifier",
    description: "Read-only agent that pushes security alerts to the on-call channel.",
    owner: "Marcus Reid",
    environment: "production",
    workspace: "Nordguard Labs",
    networks: ["ethereum"],
    permittedActions: ["alerts.read"],
    status: "active",
    limits: { dailyUsd: 0, perTxUsd: 0 },
    expiresAt: "2027-01-15",
    credentials: [{ id: "CR-73", label: "Primary key", prefix: "pgk_live_2d8e…", createdAt: "2026-10-02", lastUsed: "2026-10-29T05:00:00Z", status: "active" }],
    activity: [{ at: "2026-10-29T05:00:00Z", action: "alerts.read", outcome: "allowed", detail: "Fetched 12 new events" }],
    blockedRequests: [],
    createdAt: "2026-10-02",
  },
  {
    id: "AG-33",
    name: "market-maker-bot",
    description: "Pending review — requested broader permissions than policy allows.",
    owner: "Priya Nair",
    environment: "staging",
    workspace: "Nordguard Labs",
    networks: ["arbitrum"],
    permittedActions: ["erc20.transfer", "amm.swap"],
    status: "pending_review",
    limits: { dailyUsd: 5000, perTxUsd: 2500 },
    expiresAt: "2026-11-30",
    credentials: [],
    activity: [{ at: "2026-10-26T12:00:00Z", action: "agent.register", outcome: "pending", detail: "Awaiting owner review" }],
    blockedRequests: [],
    createdAt: "2026-10-26",
  },
];

export const agentById = (id: string) => AGENTS.find((a) => a.id === id);

/* -------------------------------------------------------- spend intents */

export interface SpendIntent {
  id: string;
  requester: string;
  requesterType: "agent" | "user";
  workspace: string;
  network: NetworkKey;
  recipient: string;
  recipientLabel: string;
  asset: string;
  amount: string;
  actionType: string;
  purpose: string;
  deadline: string;
  status: "draft" | "evaluated" | "pending_approval" | "approved" | "ready_for_signing" | "submitted" | "confirmed" | "denied" | "expired" | "cancelled" | "failed" | "reverted" | "reconciliation_mismatch";
  policyResult: { policy: string; version: number; verdict: "allow" | "deny" | "requires_approval"; rules: { rule: string; result: "pass" | "fail" | "warn"; detail: string }[] } | null;
  approvals: { approver: string; role: string; decision: "approved" | "denied"; at: string; note: string }[];
  requiredApprovals: number;
  execution: { attempts: { at: string; hash: string | null; status: string }[]; confirmedAt: string | null; reconciliation: string } | null;
  createdAt: string;
  evidence: string;
}

export const SPEND_INTENTS: SpendIntent[] = [
  {
    id: "SI-501",
    requester: "treasury-rebalancer",
    requesterType: "agent",
    workspace: "Nordguard Labs",
    network: "ethereum",
    recipient: ADDR_LEGIT,
    recipientLabel: "Cold storage vault",
    asset: "USDC",
    amount: "8,000.00",
    actionType: "erc20.transfer",
    purpose: "Weekly treasury sweep into yield vault.",
    deadline: "2026-10-30T18:00:00Z",
    status: "pending_approval",
    policyResult: {
      policy: "Treasury guardrails",
      version: 3,
      verdict: "requires_approval",
      rules: [
        { rule: "max_tx_usd ≤ 10,000", result: "pass", detail: "8,000 USDC ≈ $8,000" },
        { rule: "daily_limit_usd ≤ 25,000", result: "pass", detail: "$8,000 of $25,000 used today" },
        { rule: "recipient_allowlist", result: "pass", detail: "Cold storage vault (R-101) is allowlisted" },
        { rule: "risk_score < 60", result: "warn", detail: "Recipient wallet has 1 medium finding" },
        { rule: "approvals ≥ 1 (Approver role)", result: "pass", detail: "Policy requires 1 approval" },
      ],
    },
    approvals: [],
    requiredApprovals: 1,
    execution: null,
    createdAt: "2026-10-29T03:12:00Z",
    evidence: "Agent activity log AG-31 · policy evaluation PE-2201",
  },
  {
    id: "SI-500",
    requester: "treasury-rebalancer",
    requesterType: "agent",
    workspace: "Nordguard Labs",
    network: "ethereum",
    recipient: ADDR_LEGIT,
    recipientLabel: "Cold storage vault",
    asset: "USDC",
    amount: "5,200.00",
    actionType: "erc20.transfer",
    purpose: "Scheduled weekly rebalance.",
    deadline: "2026-10-28T18:00:00Z",
    status: "confirmed",
    policyResult: {
      policy: "Treasury guardrails",
      version: 3,
      verdict: "allow",
      rules: [
        { rule: "max_tx_usd ≤ 10,000", result: "pass", detail: "$5,200" },
        { rule: "recipient_allowlist", result: "pass", detail: "R-101 allowlisted" },
      ],
    },
    approvals: [{ approver: "Ava Chen", role: "Approver", decision: "approved", at: "2026-10-28T10:02:00Z", note: "Matches allowlisted recipient and weekly schedule." }],
    requiredApprovals: 1,
    execution: {
      attempts: [
        { at: "2026-10-28T10:04:00Z", hash: null, status: "Ready for signing" },
        { at: "2026-10-28T10:05:31Z", hash: "0x4a6d8e0f2b4c6a8d0f2b4c6a8d0f2b4c6a8d0f2b", status: "Submitted" },
      ],
      confirmedAt: "2026-10-28T10:07:02Z",
      reconciliation: "Receipt verified on-chain · allowance/nonce re-checked · no mismatch",
    },
    createdAt: "2026-10-28T09:55:00Z",
    evidence: "Execution attempt EA-309 · receipt verified",
  },
  {
    id: "SI-499",
    requester: "treasury-rebalancer",
    requesterType: "agent",
    workspace: "Nordguard Labs",
    network: "ethereum",
    recipient: "0xa9b1c3d5e7f9012345678901abcdef23456778f0",
    recipientLabel: "Unrecognized recipient",
    asset: "ETH",
    amount: "2.5",
    actionType: "native.transfer",
    purpose: "Agent-initiated transfer to unrecognized recipient.",
    deadline: "2026-10-27T18:00:00Z",
    status: "denied",
    policyResult: {
      policy: "Treasury guardrails",
      version: 3,
      verdict: "deny",
      rules: [
        { rule: "recipient_allowlist", result: "fail", detail: "Recipient is not on the workspace allowlist" },
        { rule: "max_tx_usd ≤ 10,000", result: "pass", detail: "≈ $6,300" },
      ],
    },
    approvals: [{ approver: "Policy engine", role: "System", decision: "denied", at: "2026-10-27T09:02:10Z", note: "Auto-denied: recipient_allowlist rule failed. No human override available for this rule." }],
    requiredApprovals: 1,
    execution: null,
    createdAt: "2026-10-27T09:02:00Z",
    evidence: "Blocked request BR-88",
  },
  {
    id: "SI-498",
    requester: "Ava Chen",
    requesterType: "user",
    workspace: "Nordguard Labs",
    network: "base",
    recipient: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    recipientLabel: "Fireblocks settlement",
    asset: "USDbC",
    amount: "12,000.00",
    actionType: "erc20.transfer",
    purpose: "October settlement run.",
    deadline: "2026-10-25T18:00:00Z",
    status: "reconciliation_mismatch",
    policyResult: {
      policy: "Treasury guardrails",
      version: 3,
      verdict: "allow",
      rules: [{ rule: "recipient_allowlist", result: "pass", detail: "R-102 allowlisted" }],
    },
    approvals: [{ approver: "Marcus Reid", role: "Approver", decision: "approved", at: "2026-10-25T09:00:00Z", note: "Settlement run approved." }],
    requiredApprovals: 1,
    execution: {
      attempts: [{ at: "2026-10-25T09:05:00Z", hash: "0x8d0f2b4c6a8d0f2b4c6a8d0f2b4c6a8d0f2b4c6a", status: "Submitted" }],
      confirmedAt: "2026-10-25T09:08:12Z",
      reconciliation: "MISMATCH: on-chain amount 11,980.00 USDbC vs intent 12,000.00. Fee deduction not covered by policy. Flagged for review.",
    },
    createdAt: "2026-10-25T08:40:00Z",
    evidence: "Execution attempt EA-301 · reconciliation flag REC-12",
  },
];

export const intentById = (id: string) => SPEND_INTENTS.find((i) => i.id === id);

/* ------------------------------------------------------------- policies */

export interface Policy {
  id: string;
  name: string;
  description: string;
  scope: string;
  status: "draft" | "active" | "disabled" | "archived";
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  rules: { category: string; rule: string; config: string }[];
  versions: { version: number; at: string; by: string; change: string }[];
  activations: { at: string; by: string; action: string; note: string }[];
}

export const POLICIES: Policy[] = [
  {
    id: "P-2",
    name: "Treasury guardrails",
    description: "Default policy applied to agent-initiated treasury transfers.",
    scope: "Workspace · all agents",
    status: "active",
    version: 3,
    createdBy: "Ava Chen",
    createdAt: "2026-08-10",
    updatedAt: "2026-10-18",
    rules: [
      { category: "Limit", rule: "max_tx_usd", config: "10,000" },
      { category: "Limit", rule: "daily_limit_usd", config: "25,000" },
      { category: "Allowlist", rule: "recipient_allowlist", config: "Trusted recipients (active only)" },
      { category: "Network", rule: "permitted_networks", config: "ethereum, base" },
      { category: "Risk", rule: "risk_score_threshold", config: "< 60 (warn), < 80 (deny)" },
      { category: "Approval", rule: "required_approvals", config: "1 × Approver role" },
      { category: "Emergency", rule: "deny_conditions", config: "Recipient matches known poisoning cluster" },
    ],
    versions: [
      { version: 3, at: "2026-10-18", by: "Ava Chen", change: "Raised daily limit 20k → 25k; added risk-score deny rule" },
      { version: 2, at: "2026-09-05", by: "Marcus Reid", change: "Added recipient allowlist rule" },
      { version: 1, at: "2026-08-10", by: "Ava Chen", change: "Initial version" },
    ],
    activations: [
      { at: "2026-10-18", by: "Ava Chen", action: "Activated v3", note: "Replaced v2 after simulator review" },
      { at: "2026-09-05", by: "Marcus Reid", action: "Activated v2", note: "" },
    ],
  },
  {
    id: "P-3",
    name: "Agent least-privilege baseline",
    description: "Restricts new agents to allowlisted actions and zero spend until reviewed.",
    scope: "Workspace · new agents",
    status: "active",
    version: 1,
    createdBy: "Priya Nair",
    createdAt: "2026-09-22",
    updatedAt: "2026-09-22",
    rules: [
      { category: "Action", rule: "permitted_actions", config: "alerts.read, data.read" },
      { category: "Limit", rule: "max_tx_usd", config: "0 until first access review" },
      { category: "Time", rule: "review_date", config: "90 days after registration" },
    ],
    versions: [{ version: 1, at: "2026-09-22", by: "Priya Nair", change: "Initial version" }],
    activations: [{ at: "2026-09-22", by: "Priya Nair", action: "Activated v1", note: "" }],
  },
  {
    id: "P-4",
    name: "Payroll window",
    description: "Time-boxed policy for payroll runs (draft — not yet active).",
    scope: "Workspace · payroll operators",
    status: "draft",
    version: 2,
    createdBy: "Marcus Reid",
    createdAt: "2026-10-20",
    updatedAt: "2026-10-27",
    rules: [
      { category: "Time", rule: "time_window", config: "Tue 14:00–16:00 UTC" },
      { category: "Limit", rule: "max_tx_usd", config: "50,000" },
      { category: "Approval", rule: "required_approvals", config: "2 × Approver (separation of duties)" },
    ],
    versions: [
      { version: 2, at: "2026-10-27", by: "Marcus Reid", change: "Added second approver requirement" },
      { version: 1, at: "2026-10-20", by: "Marcus Reid", change: "Initial draft" },
    ],
    activations: [],
  },
];

export const policyById = (id: string) => POLICIES.find((p) => p.id === id);

/* ----------------------------------------------------------------- team */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Approver" | "Operator" | "Auditor";
  status: "active" | "suspended";
  joinedAt: string;
  lastActive: string;
}

export const TEAM: TeamMember[] = [
  { id: "U-1", name: "Ava Chen", email: "ava@nordguard.example", role: "Owner", status: "active", joinedAt: "2026-08-01", lastActive: "2026-10-29T04:50:00Z" },
  { id: "U-2", name: "Marcus Reid", email: "marcus@nordguard.example", role: "Admin", status: "active", joinedAt: "2026-08-03", lastActive: "2026-10-29T02:10:00Z" },
  { id: "U-3", name: "Priya Nair", email: "priya@nordguard.example", role: "Approver", status: "active", joinedAt: "2026-09-12", lastActive: "2026-10-28T18:40:00Z" },
  { id: "U-4", name: "Tomás Alvarez", email: "tomas@nordguard.example", role: "Operator", status: "active", joinedAt: "2026-10-02", lastActive: "2026-10-29T01:15:00Z" },
  { id: "U-5", name: "Lena Fischer", email: "lena@audit.example", role: "Auditor", status: "active", joinedAt: "2026-09-30", lastActive: "2026-10-27T16:00:00Z" },
];

export const ROLE_MATRIX: { capability: string; Owner: boolean; Admin: boolean; Approver: boolean; Operator: boolean; Auditor: boolean }[] = [
  { capability: "Manage wallets & recipients", Owner: true, Admin: true, Approver: false, Operator: true, Auditor: false },
  { capability: "Run scans", Owner: true, Admin: true, Approver: false, Operator: true, Auditor: false },
  { capability: "Register agents", Owner: true, Admin: true, Approver: false, Operator: false, Auditor: false },
  { capability: "Create spend intents", Owner: true, Admin: true, Approver: false, Operator: true, Auditor: false },
  { capability: "Approve / deny spend intents", Owner: true, Admin: true, Approver: true, Operator: false, Auditor: false },
  { capability: "Edit & activate policies", Owner: true, Admin: true, Approver: false, Operator: false, Auditor: false },
  { capability: "Invite & remove members", Owner: true, Admin: true, Approver: false, Operator: false, Auditor: false },
  { capability: "Read audit & proofs", Owner: true, Admin: true, Approver: false, Operator: false, Auditor: true },
  { capability: "Manage billing", Owner: true, Admin: false, Approver: false, Operator: false, Auditor: false },
];

export const INVITATIONS = [
  { id: "INV-21", email: "dana@nordguard.example", role: "Operator", invitedBy: "Ava Chen", invitedAt: "2026-10-26", status: "pending", expiresAt: "2026-11-02" },
  { id: "INV-20", email: "sam@nordguard.example", role: "Auditor", invitedBy: "Ava Chen", invitedAt: "2026-10-12", status: "expired", expiresAt: "2026-10-19" },
];

/* ---------------------------------------------------------------- audit */

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  workspace: string;
  outcome: "success" | "failure";
  meta: string;
  chainHash: string;
}

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: "AE-9004", at: "2026-10-29T04:52:10Z", actor: "Ava Chen", action: "wallet.monitoring.resume", target: "W-201", workspace: "Nordguard Labs", outcome: "success", meta: "Frequency: 5m", chainHash: "9f2c…41ab" },
  { id: "AE-9003", at: "2026-10-29T03:12:00Z", actor: "agent:treasury-rebalancer", action: "spend_intent.create", target: "SI-501", workspace: "Nordguard Labs", outcome: "success", meta: "USDC 8,000 → R-101", chainHash: "7c11…88de" },
  { id: "AE-9002", at: "2026-10-28T10:05:31Z", actor: "operator:Tomás Alvarez", action: "tx.submit", target: "SI-500", workspace: "Nordguard Labs", outcome: "success", meta: "0x4a6d…f2b", chainHash: "53d2…0a9f" },
  { id: "AE-9001", at: "2026-10-27T09:02:10Z", actor: "policy-engine", action: "spend_intent.deny", target: "SI-499", workspace: "Nordguard Labs", outcome: "success", meta: "Rule: recipient_allowlist (P-2 v3)", chainHash: "1a9b…77f0" },
  { id: "AE-9000", at: "2026-10-26T16:20:00Z", actor: "Ava Chen", action: "policy.update", target: "P-2", workspace: "Nordguard Labs", outcome: "success", meta: "v2 → v3 draft created", chainHash: "b4c6…d0f2" },
];

export interface SecurityEvent {
  id: string;
  at: string;
  severity: Severity;
  type: string;
  detail: string;
  status: "open" | "investigating" | "resolved";
  workspace: string;
}

export const SECURITY_EVENTS: SecurityEvent[] = [
  { id: "SE-301", at: "2026-10-29T02:14:00Z", severity: "high", type: "Blocked spend request", detail: "Agent attempted transfer to non-allowlisted recipient (BR-88).", status: "resolved", workspace: "Nordguard Labs" },
  { id: "SE-300", at: "2026-10-28T21:40:00Z", severity: "medium", type: "New risky approval detected", detail: "Unlimited USDC allowance detected on watched wallet W-201.", status: "investigating", workspace: "Nordguard Labs" },
  { id: "SE-299", at: "2026-10-27T14:25:00Z", severity: "high", type: "Poisoning pattern on watched wallet", detail: "Lookalike-address finding raised on W-201 (F-1041).", status: "open", workspace: "Nordguard Labs" },
  { id: "SE-298", at: "2026-10-25T09:08:30Z", severity: "medium", type: "Reconciliation mismatch", detail: "Intent SI-498 amount mismatch flagged for review.", status: "open", workspace: "Nordguard Labs" },
];

export interface Notification {
  id: string;
  at: string;
  channel: "in_app" | "email" | "webhook";
  type: string;
  body: string;
  read: boolean;
}

export const NOTIFICATIONS: Notification[] = [
  { id: "N-1", at: "2026-10-29T03:12:05Z", channel: "in_app", type: "Approval required", body: "Spend intent SI-501 (USDC 8,000) is awaiting an approver.", read: false },
  { id: "N-2", at: "2026-10-28T21:41:00Z", channel: "in_app", type: "Risk finding", body: "New risky approval on W-201 — unlimited USDC allowance.", read: false },
  { id: "N-3", at: "2026-10-28T10:07:02Z", channel: "email", type: "Execution confirmed", body: "SI-500 confirmed and reconciled on-chain.", read: true },
  { id: "N-4", at: "2026-10-27T14:25:10Z", channel: "webhook", type: "Poisoning pattern", body: "Lookalike-address finding on W-201 delivered to https://hooks.nordguard.example/pg.", read: true },
];

/* ---------------------------------------------------------- knowledge */

export const KNOWLEDGE_DOCS = [
  { id: "KD-11", title: "Treasury operations runbook", source: "Internal Notion export", type: "runbook", status: "indexed", addedBy: "Ava Chen", addedAt: "2026-09-15", access: "Workspace members", size: "84 KB", retrievalCount: 42 },
  { id: "KD-10", title: "Counterparty onboarding checklist", source: "Internal PDF", type: "policy-support", status: "indexed", addedBy: "Marcus Reid", addedAt: "2026-09-20", access: "Workspace members", size: "210 KB", retrievalCount: 17 },
  { id: "KD-09", title: "Vendor bank confirmations Q3", source: "Upload", type: "finance", status: "processing", addedBy: "Priya Nair", addedAt: "2026-10-24", access: "Approvers only", size: "1.2 MB", retrievalCount: 0 },
];

/* ------------------------------------------------------------ billing */

export const SUBSCRIPTION = {
  plan: "Guard Team",
  status: "active",
  renewsAt: "2026-11-14",
  seats: 5,
  seatsUsed: 5,
  priceMonthly: 149,
  usage: [
    { metric: "Scans", used: 1284, quota: 5000 },
    { metric: "Watched wallets", used: 3, quota: 25 },
    { metric: "Agents", used: 3, quota: 10 },
    { metric: "Spend intents", used: 47, quota: 500 },
  ],
};

export const INVOICES = [
  { id: "INV-2026-10", period: "Oct 2026", amount: "$149.00", status: "paid", paidAt: "2026-10-14" },
  { id: "INV-2026-09", period: "Sep 2026", amount: "$149.00", status: "paid", paidAt: "2026-09-14" },
  { id: "INV-2026-08", period: "Aug 2026", amount: "$74.50", status: "paid", paidAt: "2026-08-14", note: "Prorated first month" },
];

/* --------------------------------------------------------------- admin */

export const ADMIN_OVERVIEW = {
  scansToday: 3842,
  scansFailedToday: 27,
  queueBacklog: 118,
  avgScanMs: 2100,
  activeWorkspaces: 217,
  openIncidents: 2,
  providerAlerts: 1,
  findingsRaised: 1520,
};

export const ADMIN_HEALTH = [
  { component: "API (eu-central)", status: "operational", latency: "42 ms", errorRate: "0.02%", note: "" },
  { component: "API (us-east)", status: "operational", latency: "51 ms", errorRate: "0.03%", note: "" },
  { component: "PostgreSQL primary", status: "operational", latency: "3 ms", errorRate: "0%", note: "Replication lag 120 ms" },
  { component: "Scan workers", status: "operational", latency: "—", errorRate: "0.4%", note: "12/12 workers alive" },
  { component: "Transfer indexer (provider-hpi-3)", status: "degraded", latency: "890 ms", errorRate: "4.1%", note: "Intermittent 503s since 2026-10-24 — affects Polygon history depth" },
  { component: "EVM RPC pool", status: "operational", latency: "110 ms", errorRate: "0.1%", note: "" },
  { component: "Notification fanout", status: "operational", latency: "18 ms", errorRate: "0%", note: "" },
];

export const ADMIN_WORKSPACES = [
  { id: "WS-1201", name: "Nordguard Labs", plan: "Guard Team", members: 5, wallets: 3, agents: 3, status: "active", createdAt: "2026-08-01" },
  { id: "WS-1187", name: "Helio Trading", plan: "Guard Pro", members: 12, wallets: 9, agents: 6, status: "active", createdAt: "2026-06-14" },
  { id: "WS-1102", name: "Kite Protocol", plan: "Guard Team", members: 4, wallets: 2, agents: 1, status: "restricted", createdAt: "2026-05-02" },
  { id: "WS-0994", name: "Delta Custody", plan: "Enterprise", members: 28, wallets: 31, agents: 11, status: "active", createdAt: "2026-03-19" },
];

export const ADMIN_INCIDENTS = [
  { id: "INC-58", type: "security", title: "Reported false positive spike on Polygon", severity: "medium", status: "investigating", openedAt: "2026-10-27", assignee: "Priya O. (staff)", notes: ["2026-10-27: Opened after 9 false-positive reports referencing provider-hpi-3 data.", "2026-10-28: Duplicated detection rule inputs confirmed; mitigation ticket OPS-118."] },
  { id: "INC-57", type: "security", title: "Credential reuse reported by customer", severity: "high", status: "resolved", openedAt: "2026-10-22", assignee: "Marcus V. (staff)", notes: ["2026-10-22: Customer reported leaked agent key in a public repo.", "2026-10-22: Key revoked at customer request; forced rotation enforced.", "2026-10-23: Closed after audit review."] },
];

export const ADMIN_REPORTS = [
  { id: "FP-72", scanId: "SC-2026-0412", workspace: "Nordguard Labs", category: "False positive", subject: ADDR_LOOKALIKE, status: "under_review", submittedAt: "2026-10-28", note: "Reporter claims the lookalike address is their own vanity address." },
  { id: "FP-71", scanId: "SC-2026-0398", workspace: "—", category: "Provider failure", subject: "0x3b1c…2b4c", status: "resolved", submittedAt: "2026-10-25", note: "Confirmed indexer outage; scan marked failed." },
];

export const ADMIN_INTEGRATIONS = [
  { id: "INT-1", name: "Transfer indexer (provider-hpi-3)", type: "indexer", status: "degraded", keyConfigured: true, lastCheck: "2026-10-29T05:00:00Z", note: "Elevated 503 rate; secrets stored in secure config" },
  { id: "INT-2", name: "EVM RPC pool (multi-provider)", type: "rpc", status: "operational", keyConfigured: true, lastCheck: "2026-10-29T05:00:00Z", note: "" },
  { id: "INT-3", name: "Threat intel feed", type: "intel", status: "not_configured", keyConfigured: false, lastCheck: "—", note: "API key not configured — feature returns explicit 'unavailable' state" },
  { id: "INT-4", name: "AI explanation provider", type: "ai", status: "not_configured", keyConfigured: false, lastCheck: "—", note: "Not configured — explanations return explicit unsupported state" },
  { id: "INT-5", name: "Payment provider", type: "payments", status: "operational", keyConfigured: true, lastCheck: "2026-10-29T05:00:00Z", note: "" },
];

export const ADMIN_BILLING_EVENTS = [
  { id: "PE-881", workspace: "WS-1201", type: "invoice.paid", amount: "$149.00", at: "2026-10-14", status: "verified", note: "" },
  { id: "PE-880", workspace: "WS-1187", type: "payment.failed", amount: "$399.00", at: "2026-10-12", status: "open", note: "Card declined twice — dunning in progress" },
  { id: "PE-879", workspace: "WS-0994", type: "subscription.updated", amount: "—", at: "2026-10-08", status: "verified", note: "Seats 24 → 28" },
];

export const ADMIN_CONTENT = [
  { id: "MV-4", type: "Methodology version", title: "Detection rules v1.3", status: "published", updatedAt: "2026-10-18", note: "Added dust-cluster rule; tightened lookalike scoring" },
  { id: "MV-3", type: "Methodology version", title: "Detection rules v1.2", status: "archived", updatedAt: "2026-08-30", note: "" },
  { id: "CT-7", type: "Public page", title: "/accuracy evaluation run EV-12", status: "published", updatedAt: "2026-10-01", note: "Latest measured results" },
];

export const ADMIN_FEATURE_FLAGS = [
  { id: "FF-1", key: "ai_explanations", name: "AI finding explanations", enabled: false, rollout: "0%", note: "Provider not configured" },
  { id: "FF-2", key: "proof_anchoring", name: "On-chain proof anchoring", enabled: false, rollout: "0%", note: "Pending verification model review" },
  { id: "FF-3", key: "recipient_checker_v2", name: "Recipient checker v2 UI", enabled: true, rollout: "100%", note: "" },
  { id: "FF-4", key: "polygon_history_deep", name: "Deep Polygon history", enabled: false, rollout: "0%", note: "Disabled during provider degradation" },
];

/* ---------------------------------------------------------- methodology */

export const METHODOLOGY_VERSIONS = [
  { version: "1.3", releasedAt: "2026-10-18", changes: "Added dust-cluster rule; tightened lookalike scoring; documented provider outage behavior." },
  { version: "1.2", releasedAt: "2026-08-30", changes: "Approval analysis now checks post-grant transfers of granted allowances." },
  { version: "1.1", releasedAt: "2026-07-02", changes: "Introduced confidence values and per-finding limitations." },
  { version: "1.0", releasedAt: "2026-05-20", changes: "Initial public methodology." },
];

export const EVALUATION_RUN = {
  id: "EV-12",
  dataset: "poison-eval-ds-v4 (1,180 labeled cases)",
  lastRun: "2026-10-01",
  methodologyVersion: "1.3",
  cases: { poisoning: 420, benign: 620, approvals: 140 },
  results: { truePositives: 372, falsePositives: 19, trueNegatives: 594, falseNegatives: 48 },
  precision: 0.951, // 372 / (372 + 19)
  recall: 0.886, // 372 / (372 + 48)
  blindSpots: [
    "Novel poisoning contracts not yet represented in the dataset",
    "Chains with partial indexer coverage (notably Polygon during provider degradation)",
    "Transactions older than available indexer history",
    "Threat-intel enrichment when the feed is not configured",
  ],
};

/* ------------------------------------------------------------- approvals */

export const TOKEN_ALLOWANCES = [
  { id: "TA-1", token: "USDC", tokenAddr: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", spender: "0x5f2c44a7b01933881cc6ba3ed0b8f2a91e709b1e", spenderLabel: "Unfamiliar spender", allowance: "Unlimited", grantedAt: "2026-10-24", network: "ethereum" as NetworkKey, risk: "critical" as Severity, note: "Funded from same cluster as dust transfers" },
  { id: "TA-2", token: "WETH", tokenAddr: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", spender: "0x1111111254eeb25477b68fb85ed92940a95f41c0", spenderLabel: "Known DEX aggregator", allowance: "5.0 WETH", grantedAt: "2026-09-30", network: "ethereum" as NetworkKey, risk: "low" as Severity, note: "Recognized router" },
  { id: "TA-3", token: "DAI", tokenAddr: "0x6b175474e89094c44da98b954eedeac495271d0f", spender: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", spenderLabel: "Known DEX router", allowance: "1,000 DAI", grantedAt: "2026-10-02", network: "ethereum" as NetworkKey, risk: "low" as Severity, note: "Recognized router" },
];

/* --------------------------------------------------------------- proofs */

export const PROOFS = [
  { id: "PR-71", scope: "Audit chain (Nordguard Labs)", kind: "Hash-chain checkpoint", at: "2026-10-29T00:00:00Z", entries: 412, status: "verified", anchor: "Internal only (not on-chain)", verification: "Recomputed 412 chained hashes · head matches checkpoint" },
  { id: "PR-70", scope: "Execution SI-500", kind: "Execution evidence", at: "2026-10-28T10:07:02Z", entries: 3, status: "verified", anchor: "TX 0x4a6d…f2b (Ethereum)", verification: "Receipt status 1 · logs decoded · allowance unchanged post-tx" },
  { id: "PR-69", scope: "Execution SI-498", kind: "Reconciliation proof", at: "2026-10-25T09:08:30Z", entries: 5, status: "mismatch", anchor: "TX 0x8d0f…4c6a (Base)", verification: "On-chain amount 11,980 vs intent 12,000 — mismatch preserved, not hidden" },
];

/* ------------------------------------------------------ false positives */

export const FALSE_POSITIVE_CATEGORIES = ["False positive", "Missed detection", "Provider failure", "Data issue", "Other"];

export const WORKSPACES_LIST = [
  { id: "WS-1201", name: "Nordguard Labs", role: "Owner" },
  { id: "WS-0994", name: "Delta Custody", role: "Auditor" },
];
