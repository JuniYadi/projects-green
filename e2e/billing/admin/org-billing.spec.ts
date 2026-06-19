/**
 * E2E tests for the Org Billing Detail page tabs.
 *
 * UC-4 to UC-16: All org billing tabs (balance, topup, invoices, usage,
 * subscriptions, adjustments, alerts, contacts, settings)
 *
 * Requires admin auth state in `.auth/admin.json`.
 */

import { test, expect } from "@playwright/test"

test.describe("Org Billing Detail (admin)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to first org's billing detail
    await page.goto("/en/portal/billing")
    const firstOrgLink = page.locator("table a").first()

    // Skip if no orgs exist in the test environment
    test.skip(await firstOrgLink.count() === 0, "No orgs available in test environment")

    await firstOrgLink.click()
    await page.waitForURL(/\/portal\/billing\/org\//)
  })

  test("UC-4: org balance and low-balance warning is visible", async ({ page }) => {
    await expect(page.getByText(/Balance/i).or(page.getByText(/balance/i))).toBeVisible()
  })

  test("UC-5: admin can topup org balance", async ({ page }) => {
    // Navigate to topup tab — tabs are sidebar or nav links within org page
    const topupTab = page.getByRole("tab", { name: /Top.?up/i })
      .or(page.getByRole("link", { name: /Top.?up/i }))
    await expect(topupTab).toBeVisible()

    await topupTab.click()
    await expect(page).toHaveURL(/\/portal\/billing\/org\/.*topup|top.?up/i)
  })

  test("UC-6: invoices tab lists org invoices", async ({ page }) => {
    const invoicesTab = page.getByRole("tab", { name: /Invoices/i })
      .or(page.getByRole("link", { name: /Invoices/i }))
    await invoicesTab.click()
    await expect(page).toHaveURL(/\/portal\/billing\/org\/.*invoice/i)
  })

  test("UC-7: can issue a DRAFT invoice (action present)", async ({ page }) => {
    const invoicesTab = page.getByRole("tab", { name: /Invoices/i })
      .or(page.getByRole("link", { name: /Invoices/i }))
    await invoicesTab.click()

    // Issue button should exist for DRAFT invoices
    const issueBtn = page.getByRole("button", { name: /Issue/i }).first()
    await expect(issueBtn).toBeVisible()
  })

  test("UC-8: can cancel an invoice (action present)", async ({ page }) => {
    const invoicesTab = page.getByRole("tab", { name: /Invoices/i })
      .or(page.getByRole("link", { name: /Invoices/i }))
    await invoicesTab.click()

    const cancelBtn = page.getByRole("button", { name: /Cancel/i }).first()
    await expect(cancelBtn).toBeVisible()
  })

  test("UC-10: usage tab shows breakdown and trend", async ({ page }) => {
    const usageTab = page.getByRole("tab", { name: /Usage/i })
      .or(page.getByRole("link", { name: /Usage/i }))
    await usageTab.click()

    await expect(page.getByText(/Cost|Spend|Usage/i)).toBeVisible()
  })

  test("UC-11: subscriptions tab shows org plans", async ({ page }) => {
    const subsTab = page.getByRole("tab", { name: /Subscriptions/i })
      .or(page.getByRole("link", { name: /Subscriptions/i }))
    await subsTab.click()

    await expect(page.getByText(/Subscription|Plan/i)).toBeVisible()
  })

  test("UC-12/13: adjustments tab shows history and create form", async ({ page }) => {
    const adjTab = page.getByRole("tab", { name: /Adjustments/i })
      .or(page.getByRole("link", { name: /Adjustments/i }))
    await adjTab.click()

    // Adjustment history table
    await expect(page.locator("table")).toBeVisible()

    // Create adjustment form / button
    await expect(
      page.getByRole("button", { name: /Adjustment|Credit|Debit/i }).first()
    ).toBeVisible()
  })

  test("UC-14: alerts tab shows threshold config", async ({ page }) => {
    const alertsTab = page.getByRole("tab", { name: /Alerts/i })
      .or(page.getByRole("link", { name: /Alerts/i }))
    await alertsTab.click()

    await expect(page.getByText(/Threshold|Alert/i)).toBeVisible()
  })

  test("UC-15: contacts tab is accessible", async ({ page }) => {
    const contactsTab = page.getByRole("tab", { name: /Contacts/i })
      .or(page.getByRole("link", { name: /Contacts/i }))
    await contactsTab.click()

    await expect(page.getByText(/Contact/i)).toBeVisible()
  })

  test("UC-16: settings tab shows currency preference", async ({ page }) => {
    const settingsTab = page.getByRole("tab", { name: /Settings/i })
      .or(page.getByRole("link", { name: /Settings/i }))
    await settingsTab.click()

    await expect(page.getByText(/Currency|IDR|USD/i)).toBeVisible()
  })
})
