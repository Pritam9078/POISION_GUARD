/** Plan catalogue (single source of truth for seeding and for the platform knowledge base). */
export const PLANS = [
  { key: 'free', name: 'Free', priceMonthlyCents: 0, entitlements: { monthlyScans: 100, watchedWallets: 2, seats: 3, agents: 1, monthlySpendIntents: 50, apiAccess: false, graphAnalytics: false, aiAssistant: false, auditRetentionDays: 90, webhooks: 1 } },
  { key: 'pro', name: 'Pro', priceMonthlyCents: 4900, entitlements: { monthlyScans: 2000, watchedWallets: 10, seats: 5, agents: 3, monthlySpendIntents: 500, apiAccess: true, graphAnalytics: false, aiAssistant: true, auditRetentionDays: 365, webhooks: 5 } },
  { key: 'business', name: 'Business', priceMonthlyCents: 14900, entitlements: { monthlyScans: 10000, watchedWallets: 50, seats: 25, agents: 15, monthlySpendIntents: 5000, apiAccess: true, graphAnalytics: true, aiAssistant: true, auditRetentionDays: 730, webhooks: 20 } },
  { key: 'enterprise', name: 'Enterprise', priceMonthlyCents: 0, entitlements: { monthlyScans: null, watchedWallets: null, seats: null, agents: null, monthlySpendIntents: null, apiAccess: true, graphAnalytics: true, aiAssistant: true, auditRetentionDays: 2555, webhooks: null } },
]
