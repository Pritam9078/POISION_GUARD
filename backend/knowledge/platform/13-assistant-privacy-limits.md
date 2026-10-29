# What can the PoisonGuard assistant do?
It answers questions about the platform and about your workspace's knowledge base documents, and explains findings, always citing the sources it used. It cannot approve, sign, execute, revoke, change settings or certify anything as safe; if asked, it refuses. Questions about live chain state such as balances, allowances or whether a transaction confirmed are redirected to a scan or the intent view, which read the blockchain directly. If no source answers a question, it says so instead of guessing. The workspace assistant needs a plan that includes it (Pro and above).

# How does the workspace knowledge base work?
Owners and admins add text or markdown documents with a title, category, access level (all members, approvers and above, or admins only), optional retention in days and tags. Documents are split into sections and indexed for keyword and semantic search. Members only ever retrieve documents their role may see. Documents past their retention period are removed automatically. PDF and Word extraction is not supported yet.

# What data does PoisonGuard store about public scans?
The scanned address or transaction, the network, results and a salted hash of your IP address for abuse prevention; the IP hash is deleted after 30 days. Public scans are not linked to any account. Optional report emails are deleted after 180 days.

# Which networks are supported?
Ethereum, Base, Arbitrum One, OP Mainnet, Polygon PoS, BNB Smart Chain and the Sepolia testnet are in the registry. A network is usable only when PoisonGuard has a data provider configured for it; otherwise it shows as offline. Approval checks are available on Ethereum, Base, Arbitrum, OP Mainnet, Polygon and Sepolia; revocation on Ethereum, Base, Arbitrum and Sepolia; BNB Smart Chain supports scanning and monitoring only.

# What does PoisonGuard not support yet?
ENS names, NFT approvals, Permit2 sub-allowances, smart-contract wallet sign-in, USD-denominated limits, PDF/Word documents in the knowledge base, multilingual content and threat-intelligence feeds.

# Which wallets work with PoisonGuard?
Any EVM wallet that can sign a message and send a transaction through the browser (for example MetaMask, Rabby or Coinbase Wallet) works with the sign-in and revoke flows. WalletConnect wallets work if the website enables WalletConnect. Cake Wallet supports Ethereum, Polygon, Base and Arbitrum, but its dApp connection method has not been verified with PoisonGuard yet.

# Where is the accuracy of PoisonGuard published?
The accuracy page shows recorded evaluation runs with true and false positives and negatives, precision = TP / (TP + FP) and recall = TP / (TP + FN). Until a run has been recorded and published it shows "evaluation in progress" — PoisonGuard does not publish made-up numbers.
