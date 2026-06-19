/**
 * E2E tests for Console Billing Settings.
 *
 * UC-18: Set preferred currency (USD/IDR), locked after invoices exist
 */

import { test, expect } from "@playwright/test"

test.describe("Billing Settings (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/settings")
  })

  test("UC-18: settings page has currency selector", async ({ page }) => {
    await expect(page.getByText(/Currency|IDR|USD/i)).toBeVisible()
  })

  test("UC-18: preferred currency can be selected", async ({ page }) => {
    const select = page.getByRole("combobox", { name: /currency/i })
      .or(page.getByRole("listbox", { name: /currency/i }))
    await expect(select).toBeVisible()
  })
})
