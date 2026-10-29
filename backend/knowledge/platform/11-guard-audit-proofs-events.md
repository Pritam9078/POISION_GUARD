# What is the audit timeline?
Every important action is recorded: sign-ins, membership changes, wallet and recipient changes, policy changes, agent actions, scans, policy decisions, approvals, transaction submissions and reconciliation results, plus any PoisonGuard staff inspection of your workspace. Each event is chained with SHA-256 to the previous one, and the database refuses edits or deletions. Owners, admins and auditors see the whole timeline; approvers and operators see only their own events. Filter by action, actor, target and date; export as JSON or CSV.

# How do I verify the audit log?
Use Verify on the audit timeline. PoisonGuard recomputes every hash in the range and reports exactly which sequence numbers were verified, or the first broken link and why. This is an application-level integrity check, not an on-chain anchor. A failed verification opens a critical security event.

# What is the proof explorer?
Checkpoints record the verified head hash of your audit chain. Each checkpoint creates a proof that starts as local (not on chain). If on-chain anchoring is configured, the commitment can be anchored to the PoisonGuard ProofRegistry smart contract; it becomes anchored only after the transaction receipt and the Anchored event are verified and the anchor is not revoked. Statuses: local, submitted, anchored, failed, mismatch.

# What does the ProofRegistry smart contract do?
It stores only a 32-byte hash per batch with an opaque scope id, kind, order number and timestamp — never names, personal data or report contents. Records cannot be edited or deleted; anchors per workspace are strictly ordered; a revoker can flag a record as revoked without erasing it; anyone can verify a record for free with verify(batchId, commitment).

# What are security events?
Automatically opened incidents for your workspace: high-severity findings on watched wallets, risky approvals, repeated blocked agent requests, agent freezes, reconciliation mismatches and audit verification failures. You can acknowledge, investigate, escalate, assign, add notes and resolve (a resolution note is required). The original event is never changed.
