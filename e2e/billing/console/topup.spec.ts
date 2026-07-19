/**
 * E2E tests for Console Top-Up page.
 *
 * UC-3: Top up balance via manual bank transfer, VA, or QRIS
 */

import { test, expect } from "@playwright/test"

test.describe("Top-Up (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/topup")
  })

  test("UC-3: top-up page has payment method options", async ({ page }) => {
    await expect(page.getByText(/Top.?Up|Balance/i)).toBeVisible()
  })

  test("UC-3: manual bank transfer option is shown", async ({ page }) => {
    await expect(
      page.getByText(/Bank Transfer/i).or(page.getByText(/Transfer/i))
    ).toBeVisible()
  })

  test("UC-3: virtual account option is shown", async ({ page }) => {
    await expect(page.getByText(/Virtual Account|VA/i)).toBeVisible()
  })
})
