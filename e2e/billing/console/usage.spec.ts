/**
 * E2E tests for Console Usage page.
 *
 * UC-9: Usage summary (total cost, events, services, daily avg)
 * UC-10: Cost-by-service breakdown and 30-day bar chart
 * UC-11: CSV export
 */

import { test, expect } from "@playwright/test"

test.describe("Usage (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/usage")
  })

  test("UC-9: usage summary cards are visible", async ({ page }) => {
    await expect(page.getByText(/Total Cost|Usage|Spend/i)).toBeVisible()
  })

  test("UC-10: cost breakdown by service is visible", async ({ page }) => {
    await expect(page.getByText(/Service|Category/i)).toBeVisible()
  })

  test("UC-11: CSV export button is present", async ({ page }) => {
    const exportBtn = page
      .getByRole("button", { name: /Export|CSV/i })
      .or(page.getByRole("link", { name: /Export|CSV/i }))
    await expect(exportBtn).toBeVisible()
  })
})
