# What is a spend intent?
A spend intent is a formal request to move funds from a watched wallet: network, recipient, asset (native coin or an ERC-20 token), exact amount in base units, purpose, optional reference, expiry (default 72 hours) and an idempotency key so a retried request is not duplicated. Intents can come from members or from AI agents. An intent is a proposal — nothing moves until it is approved and then signed in the authorized wallet.

# What are the stages of a spend intent?
draft → evaluated → pending approval or approved or denied → ready to sign → submitted → confirmed. Other end states: denied, expired, cancelled, failed, reverted, reconciliation mismatch. Approval, signing and confirmation are separate stages: approved means humans and policy authorized it; ready to sign means the unsigned transaction was prepared; submitted means a transaction hash was recorded; confirmed means PoisonGuard verified the receipt on chain.

# What happens when I evaluate an intent?
The deterministic policy engine checks it against every active policy plus agent limits, and gathers evidence about the recipient (trusted list, prior findings, lookalikes of trusted recipients, contract code). The decision is allow, deny or require approval, with reason codes and the number of approvals needed. The evaluation and the evidence snapshot are stored.

# What happens if I change an intent after it was approved?
Changing the recipient, amount or asset invalidates every existing approval and returns the intent to draft. It must be evaluated and approved again. Approvals are bound to a hash of the exact parameters.

# How do I execute an approved intent?
Prepare it: PoisonGuard builds the unsigned transaction (native transfer, or ERC-20 transfer(to, amount)). Sign and send that exact transaction from the authorized wallet. Submit the transaction hash. PoisonGuard then reconciles: after enough confirmations it checks the sender, recipient, token, calldata and the amount the recipient actually received according to Transfer logs. A match becomes confirmed; a difference (for example a fee-on-transfer token delivering less) becomes reconciliation mismatch and opens a security event; a failed transaction becomes reverted.

# How does the approval queue work?
Tabs: pending my approval (excludes your own requests and your own agents' requests), all pending, approved, rejected, expired, cancelled, awaiting signature, awaiting on-chain confirmation and reconciliation failures. A rejection requires a reason. Each approver counts once per set of parameters.
