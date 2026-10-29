# What notifications do I get?
In-app notifications for approval requests, approved intents, blocked spend, execution confirmed or problems, high-severity findings and completed scans. Filter read and unread, mark one or all as read.

# How do webhooks work?
Add an https endpoint and choose events (or *). The signing secret (whsec_…) is shown once. Each delivery carries PoisonGuard-Signature: t=<unix seconds>,v1=<HMAC-SHA256 of "t.body" in hex>, plus PoisonGuard-Event-Id and PoisonGuard-Event-Type. Verify the signature, reject timestamps older than 5 minutes and de-duplicate by event id. Failed deliveries retry with backoff (30 s up to 6 h) before being marked dead. Private, local and non-https URLs are rejected. You can send a test, rotate the secret, view deliveries and disable the endpoint.

# What plans are available?
Free: 100 scans per month, 2 watched wallets, 3 seats, 1 agent, 50 spend intents per month, 1 webhook, 90-day audit retention, no API access, no assistant. Pro: 2,000 scans, 10 wallets, 5 seats, 3 agents, 500 intents, 5 webhooks, API access, the assistant, 365-day retention. Business: 10,000 scans, 50 wallets, 25 seats, 15 agents, 5,000 intents, 20 webhooks, graph analytics, 730-day retention. Enterprise: custom limits. Hitting a limit returns a plan-limit message asking you to upgrade.

# How does billing and checkout work?
Owners start checkout from Billing; payment runs on Dodo Payments' hosted checkout. Your plan changes only when Dodo sends PoisonGuard a signed confirmation webhook — returning to the success page alone changes nothing. Past-due subscriptions keep access during dunning; cancelled or expired subscriptions fall back to Free. Billing shows plan, renewal date, seats used, usage against each limit and payment history.

# What are API keys?
Owners and admins can create workspace API keys with scopes (scans:read, scans:write, recipients:check) and an optional expiry. The secret is shown once. Keys can be revoked.

# What is in workspace settings?
Workspace name, alert preferences, data retention and default network; deletion requests (type the workspace name to confirm; staff process it after a cooling-off period); plus your personal sessions and linked wallets.
