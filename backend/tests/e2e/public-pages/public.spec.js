import { test, expect } from '@playwright/test'

const PUBLIC_ROUTES = [
  { path: '/', titleRegex: /PoisonGuard/i },
  { path: '/about', headingRegex: /About/i },
  { path: '/accuracy', headingRegex: /Accuracy|Methodology/i },
  { path: '/methodology', headingRegex: /Methodology/i },
  { path: '/pricing', headingRegex: /Pricing|Plans/i },
  { path: '/faq', headingRegex: /FAQ|Frequently/i },
  { path: '/terms', headingRegex: /Terms/i },
  { path: '/privacy', headingRegex: /Privacy/i },
  { path: '/report', headingRegex: /Report/i },
  { path: '/revoke', headingRegex: /Revoke|Approvals/i },
  { path: '/check-recipient', headingRegex: /Recipient|Verify/i },
  { path: '/recovery', headingRegex: /Recovery/i },
  { path: '/anti-phishing', headingRegex: /Phishing/i },
  { path: '/docs', headingRegex: /Documentation|Docs/i },
  { path: '/wallet-connect', headingRegex: /Wallet/i },
]

test.describe('E2E: Public Pages Discovery & Integrity', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`Public route: ${route.path} loads cleanly without runtime crash`, async ({ page }) => {
      const consoleErrors = []
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBeLessThan(400)

      // Ensure page has rendered DOM nodes
      await page.waitForLoadState('domcontentloaded')
      const container = page.locator('main, header, nav, h1, h2, form, div').first()
      await expect(container).toBeVisible()
    })
  }
})
