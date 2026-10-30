import { test, expect } from '@playwright/test'
import { TEST_ADDRESSES } from '../../fixtures/test-addresses.js'

test.describe('E2E: Interactive Scanner Workflow', () => {
  test('Scanner Input - displays placeholder and validates address entry', async ({ page }) => {
    await page.goto('/')

    // Find scanner input
    const scanInput = page.locator('input[placeholder*="0x" i], input[type="text"]').first()
    await expect(scanInput).toBeVisible()

    // Enter valid address
    await scanInput.fill(TEST_ADDRESSES.vitalik)
    await expect(scanInput).toHaveValue(TEST_ADDRESSES.vitalik)

    // Check scan trigger button
    const scanBtn = page.locator('button:has-text("Inspect Risk"), button:has-text("Scan"), button:has-text("Analyze")').first()
    await expect(scanBtn).toBeVisible()
  })

  test('Recipient Checker - loads checker page and checks input form', async ({ page }) => {
    await page.goto('/check-recipient')
    await expect(page).toHaveURL(/.*\/check-recipient/)
    const recipientInput = page.locator('input[placeholder*="0x" i], input[type="text"]').first()
    await expect(recipientInput).toBeVisible()
  })

  test('Revoke Approvals - loads token approvals revoke center', async ({ page }) => {
    await page.goto('/revoke')
    await expect(page).toHaveURL(/.*\/revoke/)
    const revokeContainer = page.locator('main, section, div').first()
    await expect(revokeContainer).toBeVisible()
  })
})
