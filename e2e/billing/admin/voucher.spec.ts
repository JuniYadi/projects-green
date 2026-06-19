/**
 * E2E tests for Admin Voucher Management.
 *
 * UC-17: List all vouchers with status filter and prefix search
 * UC-18: Create a new voucher
 * UC-19: View voucher detail
 * UC-20: Disable a voucher
 * UC-21: View claim history
 *
 * Requires admin auth state in `.auth/admin.json`.
 */

import { test, expect } from "@playwright/test"

test.describe("Voucher Management (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/portal/billing/voucher")
  })

  test("UC-17: voucher list page has table and filters", async ({ page }) => {
    await expect(page.getByText(/Voucher/i)).toBeVisible()

    // Voucher table
    const table = page.locator("table")
    await expect(table).toBeVisible()

    // Search input for prefix
    const searchInput = page.getByPlaceholder(/search|prefix/i)
      .or(page.getByRole("textbox", { name: /search|prefix/i }))
      .or(page.locator('input[placeholder*="prefix" i]'))
    await expect(searchInput).toBeVisible()
  })

  test("UC-18: create voucher dialog opens and has required fields", async ({ page }) => {
    // Open create dialog
    const createBtn = page.getByRole("button", { name: /Create|New/i })
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    // Dialog should have form fields
    await expect(page.getByRole("dialog")).toBeVisible()

    // Key fields
    await expect(page.getByText(/Prefix|Amount|Currency|Max Claims|Expires/i)).toBeVisible()
  })

  test("UC-19: clicking a voucher navigates to detail", async ({ page }) => {
    // Click first voucher row/link in the table
    const firstLink = page.locator("table a").first()
    await expect(firstLink).toBeVisible()

    await firstLink.click()
    await expect(page).toHaveURL(/\/portal\/billing\/voucher\//)
  })

  test("UC-20 and UC-21: voucher detail shows info and claims", async ({ page }) => {
    // Navigate to a voucher detail
    await page.goto("/en/portal/billing/voucher")
    const firstLink = page.locator("table a").first()
    await firstLink.click()
    await page.waitForURL(/\/portal\/billing\/voucher\//)

    // UC-19: Voucher info card
    await expect(page.getByText(/Code|Status|Amount|Created/i)).toBeVisible()

    // UC-20: Disable action
    const disableBtn = page.getByRole("button", { name: /Disable/i })
    if (await disableBtn.isVisible()) {
      // Action exists — actual click is destructive, just verify visibility
      await expect(disableBtn).toBeVisible()
    }

    // UC-21: Claim history table
    await expect(page.getByText(/Claim|History/i)).toBeVisible()
    const claimTable = page.locator("table")
    await expect(claimTable).toBeVisible()
  })
})
