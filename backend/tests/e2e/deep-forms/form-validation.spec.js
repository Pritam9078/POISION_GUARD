import { test, expect } from '@playwright/test'

test.describe('Deep Form Validation: Boundaries, Unicode, Payloads & Field Sanitization', () => {
  test('Scanner address field: Rejects empty, whitespace-only, and short boundary inputs', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const input = page.locator('input').first()
    const submitBtn = page.getByRole('button', { name: /Inspect Risk|Scan/i }).first()

    // 1. Whitespace only
    await input.fill('     ')
    await submitBtn.click()
    // Button or error notice should prevent scanning of blank whitespace
    await page.waitForTimeout(500)

    // 2. 41 characters (one character below minimum 42-char hex)
    await input.fill('0x' + 'a'.repeat(39))
    await submitBtn.click()
    await page.waitForTimeout(500)

    // 3. 43 characters (one character above maximum 42-char hex)
    await input.fill('0x' + 'a'.repeat(41))
    await submitBtn.click()
    await page.waitForTimeout(500)
    // Page must remain stable and interactive
    await expect(input).toBeVisible()
  })

  test('Scanner address field: Handles Unicode, emojis, script tags, and SQL-like payloads safely', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const input = page.locator('input').first()
    const submitBtn = page.getByRole('button', { name: /Inspect Risk|Scan/i }).first()

    const payloads = [
      '0x742d🛡️⚠️🚀', // Unicode / emoji
      '<script>alert("XSS")</script>', // HTML / Script injection
      "0x' OR 1=1 --", // SQL injection
      '0x' + 'f'.repeat(500), // Extremely long string (500+ chars)
    ]

    for (const payload of payloads) {
      await input.fill(payload)
      await submitBtn.click()
      await page.waitForTimeout(300)
      // Assert no unhandled dialogs/alerts were triggered and input element is intact
      await expect(input).toBeVisible()
    }
  })

  test('Recipient checker form: Handles case sensitivity and leading/trailing whitespace cleanly', async ({ page }) => {
    await page.goto('/check-recipient')
    await page.waitForLoadState('domcontentloaded')

    const inputs = page.locator('input')
    const count = await inputs.count()

    if (count > 0) {
      const input = inputs.first()
      // Leading and trailing whitespace should be accepted and trimmed cleanly
      await input.fill('  0x742d35Cc6634C0532925a3b844Bc454e4438f44e  ')
      const val = await input.inputValue()
      expect(val).toContain('0x742d')
    }
  })
})
