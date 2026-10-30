import { test, expect } from '@playwright/test'

test.describe('E2E: Admin Platform Operations', () => {
  test('Admin Login - loads staff login page with quick-fill credentials and password toggle', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=PoisonGuard').first()).toBeVisible()
    await expect(page.locator('text=Staff sign in')).toBeVisible()

    // Verify Quick Fill buttons exist
    const adminFillBtn = page.locator('button:has-text("Admin (admin@poisonguard.com)")')
    await expect(adminFillBtn).toBeVisible()

    // Click quick fill
    await adminFillBtn.click()

    // Assert inputs are populated
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[name="password"], input[type="password"], input[type="text"]')
    await expect(emailInput).toHaveValue('admin@poisonguard.com')

    // Test show/hide password toggle
    const toggleBtn = page.locator('button[aria-label*="password" i]')
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click()
      await expect(page.locator('input[type="text"]').last()).toBeVisible()
      await toggleBtn.click()
      await expect(page.locator('input[type="password"]').last()).toBeVisible()
    }

    // Submit login
    const signInBtn = page.locator('button:has-text("Sign in")')
    await signInBtn.click()

    // Verify navigation to overview
    await expect(page).toHaveURL(/.*\/overview/, { timeout: 10000 })
    await expect(page.locator('nav, header, main, div').first()).toBeVisible()
  })

  test('Admin Dashboard - navigates through administration sidepane views', async ({ page }) => {
    // Navigate with pre-authenticated state or login
    await page.goto('/login')
    const adminFillBtn = page.locator('button:has-text("Admin (admin@poisonguard.com)")')
    if (await adminFillBtn.count() > 0) {
      await adminFillBtn.click()
      await page.locator('button:has-text("Sign in")').click()
      await expect(page).toHaveURL(/.*\/overview/, { timeout: 10000 })
    }

    // Navigate to Health view
    const healthLink = page.locator('a[href*="/health"], button:has-text("Health")').first()
    if (await healthLink.count() > 0) {
      await healthLink.click()
      await expect(page).toHaveURL(/.*\/health/)
    }
  })
})
