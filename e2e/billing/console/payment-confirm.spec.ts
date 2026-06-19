/**
 * E2E tests for Console Payment Confirmation.
 *
 * UC-19: Confirm manual bank transfer with date, sender details, screenshot upload
 */

import { test, expect } from "@playwright/test"

test.describe("Payment Confirmation (console)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/payments/confirm")
  })

  test("UC-19: payment confirmation form is visible", async ({ page }) => {
    await expect(page.getByText(/Confirm|Transfer|Payment/i)).toBeVisible()
  })

  test("UC-19: form has required fields", async ({ page }) => {
    // Sender details
    await expect(
      page.getByRole("textbox", { name: /sender|account|name/i }).first()
    ).toBeVisible()

    // Date picker or date input
    await expect(
      page.getByLabel(/date|transfer/i).or(page.getByPlaceholder(/date|transfer/i))
    ).toBeVisible()
  })

  test("UC-19: screenshot upload is available", async ({ page }) => {
    // File input for upload
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeVisible()
  })
})
