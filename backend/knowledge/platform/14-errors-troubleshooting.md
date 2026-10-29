# What do common error messages mean?
VALIDATION_ERROR: a field is missing or malformed — the message names the field. UNAUTHENTICATED: sign in again. FORBIDDEN: your role does not include that action. NOT_FOUND: the item does not exist or belongs to another workspace. PLAN_LIMIT or PLAN_FEATURE: your plan's limit or feature — upgrade in Billing. INVALID_STATE_TRANSITION: the item changed state (for example someone already approved or it expired) — refresh. RATE_LIMITED: too many requests, wait a minute. ACCOUNT_LOCKED: too many failed sign-ins. RPC_NOT_CONFIGURED: no blockchain data provider for that network. FEATURE_DISABLED: the feature is not enabled for your workspace yet. ORIGIN_REJECTED: the request came from a site that is not PoisonGuard.

# Why does my scan say failed or inconclusive?
Usually the network has no data provider configured, the transaction hash is on a different network than selected, or the provider timed out. Choose the right network and re-run. Inconclusive is never a clean result.

# Why was my spend intent denied?
Open the intent and read the policy result: each rule shows pass, warn or fail with a reason code, for example PER_TX_LIMIT, PERIOD_LIMIT, RECIPIENT_NOT_TRUSTED, RECIPIENT_BLOCKED, RECIPIENT_POISONING_EVIDENCE, RECIPIENT_LOOKALIKE_OF_TRUSTED, CHAIN_NOT_PERMITTED, TOKEN_NOT_PERMITTED, OUTSIDE_TIME_WINDOW, AGENT_PER_TX_LIMIT, AGENT_ASSET_NOT_PERMITTED or AGENT_NOT_ACTIVE. Fix the cause, then create or edit the intent and evaluate again.

# Why can't I approve this intent?
You may have requested it yourself, you may own the agent that requested it, you may have already approved these exact parameters, your role may not include approvals, or the intent may no longer be pending (approved by others, expired, cancelled or edited back to draft).

# Why can't I activate my policy?
Activation requires that the exact version was run through the policy simulator at least once (SIMULATION_REQUIRED), and only owners and admins can activate.

# Why does my revoke show verification failed?
The transaction succeeded but the allowance read back from chain was not zero — usually a new approval was granted afterwards, or you revoked a different spender or token. Re-check the approvals list.
