/**
 * E2E tests for Console Billing Dashboard.
 *
 * UC-1: See org balance, next invoice date, est monthly cost, active subscriptions, recent invoices
 * UC-2: Navigate to sub-pages from dashboard
 */

import { test, expect } from "@playwright/test"

test.describe("Billing Dashboard (console) @e2e/billing/console/dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing")
  })

  test("UC-1: dashboard shows balance, next invoice, and est. monthly cards", async ({
    page,
  }) => {
    const balanceCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Balance" })
      .first()
    await expect(balanceCard).toBeVisible()
    await expect(balanceCard).toContainText(/(?:IDR|Rp|\$|€|£)\s*[\d.,]+/)

    const nextInvoiceCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Next Invoice" })
      .first()
    await expect(nextInvoiceCard).toBeVisible()

    const monthlyCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Est. Monthly" })
      .first()
    await expect(monthlyCard).toBeVisible()
  })

  test("UC-1: dashboard shows active subscriptions", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Active Subscriptions", exact: true })
    ).toBeVisible()
  })

  test("UC-1: dashboard shows recent invoices table with search and filter", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Recent Invoices", exact: true })
    ).toBeVisible()
    await expect(page.getByPlaceholder("Search invoices...")).toBeVisible()
    await expect(page.getByRole("combobox")).toBeVisible()

    const table = page.getByRole("table")
    await expect(table).toBeVisible()
    for (const header of ["Invoice #", "Issued Date", "Amount", "Status"]) {
      await expect(
        table.getByRole("columnheader", { name: header, exact: true })
      ).toBeVisible()
    }
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
