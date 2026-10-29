# How do I add a watched wallet?
Wallets → Add wallet: name, address, network, type (treasury, payroll, personal, agent-controlled, other), owner (an active member), monitoring enabled or paused, alert preferences, check frequency (5–1440 minutes, default 15), tags and notes. Monitoring runs scans automatically on schedule on networks with a configured data provider. Removing a wallet stops monitoring but keeps its history and audit records. Changing a wallet's owner is a separate, audited action requiring member-management rights.

# What are trusted recipients and how are they verified?
Trusted recipients are your workspace's verified address book. Add one with label, network and address, allowed use (payroll, vendor, treasury, other), optional token restrictions, verification method (independent confirmation, multisig approval, other) and evidence, plus optional effective and expiry dates. New recipients start as pending verification. A different member — not the person who added or last edited it — must verify it (four-eyes rule) before it becomes active. If the new address resembles an existing trusted recipient, you get a warning.
Edits create a new version with history; material edits send it back to pending verification. Address and network cannot be edited — add a new recipient instead.

# Does a trusted recipient bypass policy?
No. Being trusted never overrides hard policy rules such as limits or the blocklist, and never overrides current poisoning evidence about that address.

# What does wallet activity show?
Transfers PoisonGuard observed while scanning the wallet, its scans and its spend intents. It is not a complete chain history.
