/**
 * E2E tests for the Portal Billing Overview page.
 *
 * UC-1: Platform stats (total balance, active orgs, monthly spend, low-balance orgs)
 * UC-2: Search and browse orgs with billing accounts
 * UC-3: Click org to view billing detail
 *
 * Requires admin auth state in `.auth/admin.json`.
 * Run `bun run test:e2e:admin-auth` first to set it up.
 */

import { test, expect } from "@playwright/test"

test.describe("Portal Billing Overview (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/portal/billing")
  })

  test("UC-1: platform stats cards are visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Billing Overview/i })
    ).toBeVisible()

    // Platform stat cards
    await expect(page.getByText(/Total Balance/i)).toBeVisible()
    await expect(page.getByText(/Active Orgs/i)).toBeVisible()
    await expect(page.getByText(/Monthly Spend/i)).toBeVisible()
  })

  test("UC-2: org table is searchable and browseable", async ({ page }) => {
    // Org summary table should exist
    const orgTable = page.locator("table")
    await expect(orgTable).toBeVisible()

    // Search input exists
    const searchInput = page.getByPlaceholder(/search/i)
      .or(page.getByRole("textbox", { name: /search/i }))
    await expect(searchInput).toBeVisible()
  })

  test("UC-3: clicking org row navigates to org billing detail", async ({ page }) => {
    // Click the first org link/row in the table
    const firstOrgLink = page.locator("table a").first()
    await expect(firstOrgLink).toBeVisible()

    await firstOrgLink.click()
    await expect(page).toHaveURL(/\/portal\/billing\/org\//)
  })

  test("UC-22: all-invoices feed is visible", async ({ page }) => {
    // Scroll to the invoices feed section
    await expect(page.getByText(/Invoices/i)).toBeVisible()
  })

  test("UC-23: platform usage trend chart is visible", async ({ page }) => {
    await expect(page.getByText(/Usage/i)).toBeVisible()
  })
})
