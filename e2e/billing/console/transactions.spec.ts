/**
 * E2E tests for Console Transactions (Payment History).
 *
 * UC-12: Payment history with status filters (ALL/OPEN/PAID/VOID)
 */

import { test, expect } from "@playwright/test"

test.describe("Transactions (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/transactions")
  })

  test("UC-12: transactions page has history table", async ({ page }) => {
    await expect(page.getByText(/Transaction|Payment/i)).toBeVisible()
    const table = page.locator("table")
    await expect(table).toBeVisible()
  })

  test("UC-12: status filter controls are present", async ({ page }) => {
    const filter = page.getByRole("combobox", { name: /status/i })
      .or(page.getByRole("listbox", { name: /status/i }))
      .or(page.getByText(/ALL|OPEN|PAID|VOID/i))
    await expect(filter).toBeVisible()
  })
})
