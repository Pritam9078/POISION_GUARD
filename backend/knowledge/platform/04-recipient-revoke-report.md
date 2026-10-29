# How do I check a recipient before sending?
Open Check recipient, choose the network and paste the recipient address. Optionally add your own wallet as the sender (this lets PoisonGuard compare against addresses you have actually paid), an expected label, and a context transaction hash. The result is clear, suspicious or inconclusive — never "safe".
Suspicious means the address resembles one you have paid or a trusted recipient but is different, or it has prior poisoning findings. Clear means an exact match with a known counterparty and no poisoning evidence — still not a guarantee. Inconclusive means no evidence either way. Labels you type are never treated as proof of ownership. In Guard, the checker also compares against your workspace's trusted recipients.

# How do I review and revoke token approvals?
Open Revoke approvals and connect your wallet. PoisonGuard lists ERC-20 allowances with token, spender, amount (Unlimited or exact), risk and the block at which the allowance was read. Select one and choose Revoke.
Step by step: 1) preview — PoisonGuard builds an unsigned approve(spender, 0) transaction and estimates gas; 2) you review and sign it in your own wallet; 3) the transaction hash is submitted; 4) PoisonGuard waits for confirmations; 5) it re-reads the allowance on chain. It shows "allowance verified" only when the re-read allowance is 0. If the allowance is still non-zero you see "verification failed"; if the transaction failed, "reverted".
Revoking stops future spending only. It does not recover tokens that were already taken. NFT approvals (ERC-721/1155) and Permit2 sub-allowances are not supported yet.

# How do I report an incorrect finding (false positive)?
Use Report a finding, or "Report incorrect finding" on a scan. Choose a category (false positive, incorrect match, stale approval, wrong token metadata, missing evidence, missed detection, provider failure, data issue, other), explain in at least 10 characters, optionally add a transaction link and an email for follow-up with consent. You get a reference such as FP-7KQ2M9. Submitting the same report twice returns the same reference. Staff review reports; a report never changes detection rules automatically, and your contact email is deleted after 180 days.

# How do I report a fake PoisonGuard site?
Use the anti-phishing page to submit the URL and evidence (consent required). You get a PH- reference.

# What should I do if I already sent funds to a poisoned address?
Blockchain transfers cannot be reversed by PoisonGuard or anyone else. Immediately: stop using addresses copied from history; revoke any approvals the attacker might use; scan your wallet; preserve the transaction hash and evidence; report to the exchange or token issuer involved and to local authorities. Beware recovery scams — nobody legitimate will ask for your seed phrase or an upfront fee to "recover" funds.
