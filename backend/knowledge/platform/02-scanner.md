# How do I scan a wallet or transaction?
On the home page, choose the network, paste a wallet address (0x followed by 40 hex characters) or a transaction hash (0x followed by 64 hex characters) and press Scan. No account is needed. ENS names are not resolved yet — paste the 0x address.
The scan runs in the background through the stages queued, running and then completed, partial, failed or timed out. The results page shows findings, token approvals, evidence, data coverage and recommendations.
Public scans are never saved into a Guard workspace. Scans you run inside Guard are saved only to that workspace.

# What do the scan statuses mean?
completed means every core data source was covered. partial means at least one source was limited or unavailable, for example native transaction history without an indexer; findings are still valid but coverage is incomplete. failed means the scan could not run, for example because no blockchain data provider is configured for that network or the transaction was not found. timed out means the scan exceeded its time budget. A failed or timed-out scan is always "inconclusive" — never a clean result.

# What do risk labels and risk score mean?
Risk labels are critical, high, elevated, low and inconclusive. The risk score (0–100) is an ordering heuristic: the weight of the most severe finding plus 5 for each extra finding. It is not a calibrated probability. Inconclusive means there was not enough data to conclude anything; the score is empty in that case.

# What is data coverage on a scan?
Each scan lists every data source with covered, partial or unavailable and a note: EVM RPC reads (pinned to one block), token transfer history, native transaction history, token approvals and threat-intelligence feeds. Without an indexer, token history covers only the most recent block window scanned with eth_getLogs, and native transaction history is unavailable. No threat-intelligence feed is integrated; detection is rule-based.

# What is the difference between a fact, a measurement and an interpretation in evidence?
Every finding's evidence is labeled. On-chain fact: something read directly from the blockchain, such as a transaction hash, a Transfer log or an allowance value. Derived: a measurement PoisonGuard computed, such as how many characters two addresses share. Interpretation: why it may matter. Evidence items with a transaction hash link to the block explorer.

# How do I scan a transaction hash?
Paste the 0x + 64-hex hash. PoisonGuard reads the transaction and its receipt. If a zero-value token transfer in the receipt names someone other than the sender, that address is treated as the likely victim and the scan is analyzed from its perspective; findings are limited to addresses involved in that transaction.

# Can I re-run, share or export a scan?
Re-run creates a new scan at the current block and never changes the original. Share creates an unguessable link (default 30 days, up to 90) to a read-only risk card with the summary, severity counts, evidence links and a staleness warning; share cards never include workspace names, members or trusted-recipient labels. Inside Guard you can also compare two scans (findings added, resolved and unchanged) and export a scan as JSON.
