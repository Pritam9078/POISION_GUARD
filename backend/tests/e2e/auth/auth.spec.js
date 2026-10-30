import { test, expect } from '@playwright/test'

test.describe('E2E: User Authentication & Guard Portal Access', () => {
  test('Login Page - renders required fields, toggles password visibility', async ({ page }) => {
    await page.goto('/guard/login')
    await expect(page).toHaveTitle(/PoisonGuard/i)

    // Verify presence of form inputs
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[name="password"], input[type="password"]')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()

    // Test password visibility toggle button
    const toggleBtn = page.locator('button[aria-label*="password" i]')
    if (await toggleBtn.count() > 0) {
      await passwordInput.fill('SecretPassword123!')
      await expect(passwordInput).toHaveAttribute('type', 'password')
      await toggleBtn.click()
      await expect(page.locator('input[type="text"]').filter({ hasText: '' })).toBeVisible()
      await toggleBtn.click()
      await expect(page.locator('input[type="password"]')).toBeVisible()
    }
  })

  test('Login Page - validates empty submission', async ({ page }) => {
    await page.goto('/guard/login')
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")')
    await submitBtn.click()
    // HTML5 native validation prevents navigation
    await expect(page).toHaveURL(/.*\/guard\/login/)
  })

  test('Signup Page - renders registration inputs', async ({ page }) => {
    await page.goto('/guard/register')
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })
})

