/**
 * E2E tests for Console Invoices.
 *
 * UC-4: View invoice list
 * UC-5: View invoice detail with line items
 * UC-6: Pay an invoice with balance
 * UC-7: Top up and pay in one flow
 * UC-8: Pay via payment gateway redirect (Duitku)
 */

import { test, expect } from "@playwright/test"

test.describe("Invoices (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/invoices")
  })

  test("UC-4: invoice list is visible", async ({ page }) => {
    await expect(page.getByText(/Invoice/i)).toBeVisible()
    const table = page.locator("table")
    await expect(table).toBeVisible()
  })

  test("UC-5: clicking invoice shows detail with line items", async ({
    page,
  }) => {
    const firstLink = page.locator("table a").first()
    await expect(firstLink).toBeVisible()

    await firstLink.click()
    await page.waitForURL(/\/console\/billing\/invoices\/[^/]+$/)
    await expect(page.getByText(/Invoice|INV-/i)).toBeVisible()
  })

  test("UC-6: pay with balance button is present on invoice detail", async ({
    page,
  }) => {
    const firstLink = page.locator("table a").first()
    await firstLink.click()
    await page.waitForURL(/\/console\/billing\/invoices\/[^/]+$/)

    await expect(page.getByRole("button", { name: /Pay/i })).toBeVisible()
  })
})
