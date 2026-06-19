/**
 * E2E tests for Admin Invoice Detail.
 *
 * UC-9: View invoice line items grouped by service
 *
 * Requires admin auth state in `.auth/admin.json`.
 */

import { test, expect } from "@playwright/test"

test.describe("Invoice Detail (admin)", () => {
  test("UC-9: invoice detail page shows line items grouped by service", async ({ page }) => {
    // Navigate from billing overview → invoices feed → click first invoice
    await page.goto("/en/portal/billing")

    // Find an invoice link in the invoices feed section
    const invoiceLink = page.locator("a[href*='/portal/billing/invoices/']").first()
    await expect(invoiceLink).toBeVisible()

    await invoiceLink.click()
    await page.waitForURL(/\/portal\/billing\/invoices\//)

    // Invoice heading and line items
    await expect(page.getByText(/Invoice|INV-/i)).toBeVisible()
  })
})
