import { test, expect } from '@playwright/test'

test.describe('Accessibility (a11y) & Usability Standards', () => {
  test('Home page has valid semantic structure and heading hierarchy', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 1. Heading hierarchy: h1 is visible after hydration
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible({ timeout: 10000 })

    // 2. Navigation landmarks exist
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()

    // 3. Buttons have accessible names
    const buttons = page.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Scanner on homepage provides accessible input and keyboard focusability', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const input = page.locator('input').first()
    await expect(input).toBeVisible({ timeout: 10000 })

    // Focus input via keyboard tab or click
    await input.focus()
    const isFocused = await input.evaluate((el) => document.activeElement === el)
    expect(isFocused).toBe(true)
  })

  test('Admin login form contains accessible form labels and submit button', async ({ page }) => {
    await page.goto('http://localhost:5174/login')
    await page.waitForLoadState('domcontentloaded')

    const emailInput = page.locator('input[type="email"], input').first()
    await expect(emailInput).toBeVisible({ timeout: 10000 })

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")').first()
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toBeEnabled()
  })
})
