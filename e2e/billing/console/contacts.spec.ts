/**
 * E2E tests for the Billing Contacts page (authenticated).
 *
 * These tests require a valid auth session saved in `.auth/user.json`.
 * Run `bun run test:e2e:auth` first to set it up.
 */

import { test, expect } from "@playwright/test"

test.describe("Billing Contacts (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/billing/contacts")
  })

  test("page has correct heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Billing Contacts" })
    ).toBeVisible()
    await expect(
      page.getByText("Manage who receives billing notifications")
    ).toBeVisible()
  })

  test("shows add contact button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Add Contact/i })
    ).toBeVisible()
  })

  test("add contact dialog opens and can be cancelled", async ({ page }) => {
    await page.getByRole("button", { name: /Add Contact/i }).click()
    await expect(
      page.getByRole("dialog", { name: "Add Billing Contact" })
    ).toBeVisible()

    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(
      page.getByRole("dialog", { name: "Add Billing Contact" })
    ).not.toBeVisible()
  })

  test("add contact dialog validates empty email", async ({ page }) => {
    await page.getByRole("button", { name: /Add Contact/i }).click()
    const addButton = page.getByRole("button", { name: "Add Contact" }).last()

    // Add button should be disabled when email is empty
    await expect(addButton).toBeDisabled()
  })

  test("shows role badge for OWNER contact", async ({ page }) => {
    // The OWNER contact is always present (auto-created)
    await expect(page.getByText("OWNER")).toBeVisible()
  })

  test("navigates to billing settings page via sidebar", async ({ page }) => {
    // Existing sidebar link in the billing dashboard
    await page.goto("/en/console/billing")
    await page
      .getByRole("link", { name: /Settings/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/console\/billing\/settings/)
  })
})
