/**
 * E2E tests for Console Billing Dashboard.
 *
 * UC-1: See org balance, next invoice date, est monthly cost, active subscriptions, recent invoices
 * UC-2: Navigate to sub-pages from dashboard
 */

import { test, expect } from "@playwright/test"

test.describe("Billing Dashboard (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing")
  })

  test("UC-1: dashboard shows balance card", async ({ page }) => {
    await expect(page.getByText(/Balance/i).first()).toBeVisible()
  })

  test("UC-1: dashboard shows active subscriptions", async ({ page }) => {
    await expect(page.getByText(/Subscription|Active Service/i)).toBeVisible()
  })

  test("UC-1: dashboard shows recent invoices", async ({ page }) => {
    await expect(page.getByText(/Invoice/i)).toBeVisible()
  })

  test("UC-2: can navigate to invoices sub-page", async ({ page }) => {
    const link = page.getByRole("link", { name: /Invoice/i }).first()
    await link.click()
    await expect(page).toHaveURL(/\/console\/billing\/invoice/)
  })

  test("UC-2: can navigate to topup sub-page", async ({ page }) => {
    const link = page
      .getByRole("link", { name: /Top.?up/i })
      .or(page.getByRole("button", { name: /Top.?up/i }))
      .first()
    await link.click()
    await expect(page).toHaveURL(/\/console\/billing\/topup|top.?up/i)
  })

  test("UC-2: can navigate to usage sub-page", async ({ page }) => {
    const link = page.getByRole("link", { name: /Usage/i }).first()
    await link.click()
    await expect(page).toHaveURL(/\/console\/billing\/usage/)
  })
})
