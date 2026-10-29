# What is address poisoning?
Address poisoning is a scam where an attacker creates an address that looks like one you have used — same first and last characters — and plants it in your transaction history with zero-value or dust transfers or fake token transfers. Later, if you copy a recipient from your history, you may paste the attacker's address. PoisonGuard's rules look for exactly these patterns.

# How does PoisonGuard detect lookalike addresses? (PG-POISON-001)
Rule PG-POISON-001 "Lookalike counterparty" compares every address in the wallet's history with its established counterparties — addresses the wallet actually sent value to, plus active trusted recipients in a Guard workspace. A strong match shares at least 4 leading and 4 trailing hex characters; a weak match at least 3 and 3 with 7 in total. It fires only if the wallet never initiated a value transfer to the lookalike. Severity is high for a strong match with zero or dust transfers, medium for a strong match, low for a weak one. Similarity alone never proves malice — vanity addresses can match too.

# What is a zero-value transfer spoof? (PG-POISON-002)
Many tokens let anyone call transferFrom(victim, x, 0) without an allowance. This writes a Transfer log that makes it look as if your wallet sent tokens to an attacker's address. Rule PG-POISON-002 flags zero-value Transfer logs that name your wallet as sender when the transaction was sent by someone else. No funds move. Confidence is higher when PoisonGuard confirms the real transaction sender.

# What is a dust attack or dust burst? (PG-POISON-003)
Rule PG-POISON-003 flags when three or more different senders transfer zero or dust amounts (less than 0.01 of the token) to your wallet. Dust bursts often accompany poisoning campaigns. Legitimate airdrops can look similar. Treat unsolicited tokens as untrusted and do not visit links in token names.

# What is a counterfeit token? (PG-POISON-004)
Rule PG-POISON-004 flags tokens that use a well-known symbol such as USDC, USDT, DAI or WETH but are deployed at a non-canonical contract address. Fake stablecoins make poisoned history entries look like real payments. Bridged or legacy versions of a token can trigger it.

# What makes a token approval risky? (PG-APPROVAL-001 and PG-APPROVAL-002)
PG-APPROVAL-001 flags an effectively unlimited allowance (at least 2^128 base units). Unlimited approvals to unrecognized spenders are high severity; to recognized contracts such as Uniswap Permit2 or 1inch routers they are low severity, because "recognized" means identified, not audited or safe. PG-APPROVAL-002 flags any non-zero allowance to an address with no contract code (a plain wallet) — a common drainer pattern; it is critical when unlimited and high otherwise.

# What methodology version is PoisonGuard using?
The current deterministic rule set is methodology version 1.0. Rules are versioned; every finding records its rule id and rule version. The public methodology page lists every rule, its thresholds and its known false positives. Reports from users never change rules automatically.
