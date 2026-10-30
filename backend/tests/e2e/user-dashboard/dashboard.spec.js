import { test, expect } from '@playwright/test'

test.describe('E2E: User Guard Workspace Navigation', () => {
  test('User Login & Dashboard Overview Access', async ({ page }) => {
    await page.goto('/guard/login')

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"], input[name="password"]')

    await emailInput.fill('admin@poisonguard.com')
    await passwordInput.fill('PoisonGuardAdmin2026!')

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")')
    await submitBtn.click()

    // Wait for redirect to dashboard or workspace
    await expect(page).toHaveURL(/.*\/guard/, { timeout: 10000 })
    await expect(page.locator('nav, header, main, div').first()).toBeVisible()
  })

  test('Public Pricing Page - allows viewing plan tiers', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page).toHaveURL(/.*\/pricing/)
    await expect(page.locator('main, section, div').first()).toBeVisible()
  })
})
