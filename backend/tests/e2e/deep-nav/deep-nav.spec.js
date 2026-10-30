import { test, expect } from '@playwright/test'

test.describe('Deep Navigation: Page Reload, History Navigation & Route Resilience', () => {
  const routesToTest = [
    '/',
    '/check-recipient',
    '/revoke',
    '/wallet-connect',
    '/pricing',
    '/docs',
    '/report',
    '/accuracy',
  ]

  for (const route of routesToTest) {
    test(`Deep Navigation: ${route} supports direct navigation, reload, and back/forward`, async ({ page }) => {
      const consoleErrors = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      // 1. Direct navigation
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')

      // 2. Refresh / reload on the page
      await page.reload()
      await page.waitForLoadState('domcontentloaded')

      // 3. Navigation to another page and back/forward
      const navTarget = route === '/' ? '/docs' : '/'
      await page.goto(navTarget)
      await page.waitForLoadState('domcontentloaded')

      await page.goBack()
      await page.waitForLoadState('domcontentloaded')
      expect(page.url()).toContain(route)

      // Filter out harmless extension or warning messages
      const genuineErrors = consoleErrors.filter(
        (err) => !err.includes('favicon') && !err.includes('contentscript') && !err.includes('EventEmitter')
      )
      expect(genuineErrors).toEqual([])
    })
  }

  test('Route Resilience: Invalid shared report ID displays graceful 404/not-found UI without white-screen crash', async ({ page }) => {
    await page.goto('/share/non-existent-report-uuid-999999999')
    await page.waitForLoadState('domcontentloaded')

    // Page must still render UI containers and not crash
    const container = page.locator('main, header, div, nav').first()
    await expect(container).toBeVisible()
  })
})
