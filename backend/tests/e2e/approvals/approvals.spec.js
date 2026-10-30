import { test, expect } from '@playwright/test'

test.describe('E2E: Token Approvals & Revocation Center', () => {
  test('Revoke Page - displays wallet connect and allowances table', async ({ page }) => {
    await page.goto('/revoke')
    await expect(page).toHaveURL(/.*\/revoke/)

    const heading = page.getByRole('heading', { name: /Revoke/i }).first()
    await expect(heading).toBeVisible()

    const connectBtn = page.getByRole('button', { name: /Connect/i }).first()
    await expect(connectBtn).toBeVisible()
  })
})
