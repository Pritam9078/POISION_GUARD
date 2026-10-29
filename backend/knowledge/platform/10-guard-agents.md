# How do I register an AI agent?
Agents → Register: name, description, owner, environment, allowed networks, controlled wallets (must be watched wallets), allowed tools (check_recipient, scan_wallet, propose_transfer, propose_revoke), per-transaction limits, period limits with a reset period in hours, an approval threshold, and an expiry. Agents that can propose transfers must have at least one explicit per-transaction limit; an asset without a limit is always denied. A new agent starts as pending and must be activated by an owner or admin.

# How do agent credentials work?
After activation, issue a credential. The secret (starting pgk_live_) is shown once and stored only as a keyed hash — it can never be retrieved again. Rotate a credential to revoke the old one and get a new one; revoke credentials individually. Credentials only work on the agent API; they never act as a user session.

# What can an agent do through the agent API?
With Authorization: Bearer pgk_live_…, an agent can check recipients, run scans and propose spend intents — each only if that tool is allowed and the network is in its allowlist. Proposals are evaluated by the policy engine immediately. Agents can never approve, sign or broadcast. Blocked calls are recorded and shown under blocked requests. Three or more blocked requests in 24 hours open a security event.

# What happens when I freeze an agent?
Freezing blocks new agent actions immediately and cancels its draft and pending-approval intents. It does not cancel transactions that were already approved or submitted on chain — review those in Spend intents. Unfreezing requires a reason and an owner or admin. Disabling an agent also revokes its credentials.
