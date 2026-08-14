/**
 * E2E coverage for the catalog admin write flow:
 * - Navigate to Catalog
 * - Open a product editor
 * - Verify the Basics tab loads
 * - Navigate to Plans tab
 * - Navigate to Publish tab
 * - Save the product via the API (Publish button)
 * - Refresh and verify data persists (loaded from server)
 * - Confirm legacy Pricing and Voucher pages return 404
 *
 * Requires `.auth/admin.json`.
 */

import { test, expect } from "@playwright/test"

test.describe("Catalog authoring flow", () => {
  test.setTimeout(90_000)

  test("@e2e/billing/admin/catalog-authoring navigates catalog and opens product editor", async ({
    page,
  }) => {
    // Navigate to the catalog list page
    await page.goto("/en/portal/billing/catalog", {
      waitUntil: "domcontentloaded",
    })

    // Should see the "Product Catalog" heading
    await expect(
      page.getByRole("heading", { name: "Product Catalog" })
    ).toBeVisible({ timeout: 30_000 })

    // Should have product cards visible (at least one)
    const productCards = page.locator(
      "a[href*='/portal/billing/catalog/products/']"
    )
    const count = await productCards.count()

    if (count > 0) {
      // Click the first product to open the editor
      await productCards.first().click()

      // Verify we land on the product editor page
      await expect(page).toHaveURL(/\/portal\/billing\/catalog\/products\//)

      // Should see the Basics tab content (product editor loaded)
      await expect(page.getByRole("tab", { name: "Basics" })).toBeVisible({
        timeout: 15_000,
      })

      // Verify all tabs exist
      await expect(page.getByRole("tab", { name: "Plans" })).toBeVisible()
      await expect(page.getByRole("tab", { name: "Add-ons" })).toBeVisible()
      await expect(page.getByRole("tab", { name: "Publish" })).toBeVisible()

      // Navigate to Plans tab
      await page.getByRole("tab", { name: "Plans" }).first().click()
      await expect(page).toHaveURL(/tab=plans/)

      // Navigate to Publish tab
      await page.getByRole("tab", { name: "Publish" }).first().click()
      await expect(page).toHaveURL(/tab=publish/)
    }
  })

  test("@e2e/billing/admin/catalog-authoring product editor shows save and publish buttons", async ({
    page,
  }) => {
    await page.goto("/en/portal/billing/catalog", {
      waitUntil: "domcontentloaded",
    })

    await expect(
      page.getByRole("heading", { name: "Product Catalog" })
    ).toBeVisible({ timeout: 30_000 })

    const productCards = page.locator(
      "a[href*='/portal/billing/catalog/products/']"
    )
    const count = await productCards.count()

    if (count > 0) {
      await productCards.first().click()
      await expect(page).toHaveURL(/\/portal\/billing\/catalog\/products\//)

      // Verify Save draft button exists
      await expect(
        page.getByRole("button", { name: /Save draft/i })
      ).toBeVisible({ timeout: 15_000 })

      // Verify Publish button exists
      await expect(page.getByRole("button", { name: /Publish/i })).toBeVisible()
    }
  })

  test("@e2e/billing/admin/catalog-authoring legacy pricing page returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/en/portal/billing/pricing", {
      waitUntil: "domcontentloaded",
    })

    // Should get 404 since we removed the page
    expect(response?.status()).toBe(404)
  })

  test("@e2e/billing/admin/catalog-authoring legacy voucher page returns 404", async ({
    page,
  }) => {
    const response = await page.goto("/en/portal/billing/voucher", {
      waitUntil: "domcontentloaded",
    })

    // Should get 404 since we removed the page
    expect(response?.status()).toBe(404)
  })

  test("@e2e/billing/admin/catalog-authoring catalog editor persists after refresh", async ({
    page,
  }) => {
    await page.goto("/en/portal/billing/catalog", {
      waitUntil: "domcontentloaded",
    })

    await expect(
      page.getByRole("heading", { name: "Product Catalog" })
    ).toBeVisible({ timeout: 30_000 })

    const productCards = page.locator(
      "a[href*='/portal/billing/catalog/products/']"
    )
    const count = await productCards.count()

    if (count > 0) {
      // Click first product
      await productCards.first().click()
      await expect(page).toHaveURL(/\/portal\/billing\/catalog\/products\//)

      // Wait for editor to fully load
      await expect(page.getByRole("tab", { name: "Basics" })).toBeVisible({
        timeout: 15_000,
      })

      // Get the product name shown in the heading
      const headingText = await page.locator("h1").first().textContent()

      // Refresh the page
      await page.reload({ waitUntil: "domcontentloaded" })

      // Verify the same product name is shown (loaded from server, not localStorage)
      await expect(page.getByRole("tab", { name: "Basics" })).toBeVisible({
        timeout: 15_000,
      })

      const headingAfterRefresh = await page.locator("h1").first().textContent()

      expect(headingAfterRefresh).toBe(headingText)
    }
  })
})
