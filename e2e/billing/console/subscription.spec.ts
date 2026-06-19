/**
 * E2E tests for Console Subscription page.
 *
 * UC-13: View subscriptions (App Hosting, VPN, WhatsApp) with plan/status
 */

import { test, expect } from "@playwright/test"

test.describe("Subscription (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/subscription")
  })

  test("UC-13: subscription page shows plans", async ({ page }) => {
    await expect(page.getByText(/Subscription|Plan/i)).toBeVisible()
  })
})
