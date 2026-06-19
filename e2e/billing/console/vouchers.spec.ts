/**
 * E2E tests for Console Voucher Redemption.
 *
 * UC-14: Redeem a voucher code for billing credit
 * UC-15: View redemption history
 */

import { test, expect } from "@playwright/test"

test.describe("Vouchers (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/vouchers")
  })

  test("UC-14: redeem voucher input and button are visible", async ({ page }) => {
    const input = page.getByPlaceholder(/code|voucher/i)
      .or(page.getByRole("textbox", { name: /code|voucher/i }))
    await expect(input).toBeVisible()

    await expect(page.getByRole("button", { name: /Redeem/i })).toBeVisible()
  })

  test("UC-15: redemption history table is visible", async ({ page }) => {
    const table = page.locator("table")
    await expect(table).toBeVisible()
  })
})
