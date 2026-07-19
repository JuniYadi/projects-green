/**
 * E2E tests for Console Billing Alerts.
 *
 * UC-17: Configure balance/usage alert thresholds
 */

import { test, expect } from "@playwright/test"

test.describe("Billing Alerts (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/alerts")
  })

  test("UC-17: alerts page has threshold configuration", async ({ page }) => {
    await expect(page.getByText(/Alert|Threshold/i)).toBeVisible()
  })

  test("UC-17: balance alert threshold input is present", async ({ page }) => {
    const input = page
      .getByRole("textbox", { name: /balance/i })
      .or(page.getByRole("spinbutton", { name: /balance|threshold/i }))
    await expect(input).toBeVisible()
  })
})
