# What can a policy control?
A policy can scope itself to specific wallets, agents, networks, transfer types (native or ERC-20) or requester types (user or agent). Rules: allowed networks; allowed tokens; per-transaction limits and per-period limits (per asset and network, in base units, period in hours); recipient mode allowlist or any; blocked recipients; what to do with untrusted recipients (deny, require approval, allow); deny on poisoning evidence about the recipient; deny on lookalikes of trusted recipients; what to do when chain data is unavailable; required approvals plus higher counts at amount thresholds; whether agent owners may approve their agent's spend; a weekly time window in UTC; and an effective period.

# How are policy decisions made?
Deterministically. Any deny wins. Otherwise any "require approval" makes the decision require approval, using the highest approval count required by any rule. Otherwise the intent is allowed. If no active policy applies, the default is to require one human approval. AI never influences a policy decision.

# How many approvals does a spend intent need?
It depends on your active policies. Each policy sets a required number of approvals and can require more at amount thresholds; the highest requirement wins. If no active policy applies to an intent, PoisonGuard requires one human approval by default. Agent approval thresholds can also force a human approval. Each approver counts once, and the requester and the agent's owner do not count.

# How do I create and activate a policy?
Create a policy (version 1, draft) → validate → run the policy simulator against that version → review the diff between versions → activate. Activation is refused until the version has been simulated at least once. Versions are immutable: editing creates a new draft version. Rollback creates a new version that copies an earlier configuration, so history is never erased. Disabling a policy leaves intents defaulting to one human approval.

# How do I use the policy simulator?
Enter a wallet or agent, network, recipient, asset and amount, optionally a draft configuration or specific versions, and optionally override the intelligence snapshot. You get the decision, required approvals, reason codes, each rule's result and missing evidence. Nothing is created or executed. Period limits assume zero prior usage in simulations.

# Why are limits in base units and not dollars?
PoisonGuard has no price oracle, so it does not convert to USD. Limits are exact token base units (for example 1 USDC = 1000000 because USDC has 6 decimals; 1 ETH = 10^18 wei).
