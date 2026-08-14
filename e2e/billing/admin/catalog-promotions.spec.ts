/**
 * E2E coverage for the consolidated portal billing navigation and promotion
 * type filters. Requires `.auth/admin.json`.
 */

import { test, expect } from "@playwright/test"

test.describe("Portal billing consolidation", () => {
  test.setTimeout(60_000)

  test("@e2e/billing/admin/catalog-navigation exposes canonical workspaces", async ({
    page,
  }) => {
    await page.goto("/en/portal/billing", { waitUntil: "domcontentloaded" })

    await expect(
      page.getByRole("link", { name: "Promotions", exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Catalog", exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Vouchers", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Pricing", exact: true })
    ).toHaveCount(0)
  })

  test("@e2e/billing/admin/promotion-kind-filter persists in URL", async ({
    page,
  }) => {
    await page.goto("/en/portal/billing/promotions", {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByText("Filters", { exact: true })).toBeVisible({
      timeout: 30_000,
    })

    const typeFilter = page
      .getByRole("combobox")
      .filter({ hasText: "All Types" })
    await expect(typeFilter).toBeVisible()
    await typeFilter.click()
    await page.getByRole("option", { name: "Product promotions" }).click()

    await expect(page).toHaveURL(/kind=PRODUCT_PROMOTION/)
    await expect(
      page.getByRole("combobox").filter({ hasText: "Product promotions" })
    ).toContainText("Product promotions")
  })
})
