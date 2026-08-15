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

  test("@e2e/billing/admin/promotion-create-flow keeps kind controls scoped", async ({
    page,
  }) => {
    await page.goto("/en/portal/billing/promotions/new", {
      waitUntil: "domcontentloaded",
    })

    await expect(
      page.getByRole("heading", { name: "New Promotion" })
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.locator('[data-slot="toggle-group"]').first()
    ).toHaveClass(/sm:grid-cols-2/)

    await page.getByRole("radio", { name: /Product Promotion/ }).click()
    await expect(page.getByLabel("Credit Amount")).toHaveCount(0)
    await expect(page.getByLabel("Discount Value")).toBeVisible()

    await page.getByRole("button", { name: "Rules", exact: true }).click()
    await expect(page.getByLabel("Expiration date and time")).toBeVisible()
    await expect(
      page.getByText("Eligible products or plans", { exact: true })
    ).toBeVisible()

    await page
      .getByRole("button", { name: "Publish", exact: true })
      .first()
      .click()
    await expect(
      page.getByRole("radio", { name: /Save as draft/ })
    ).toBeVisible()
    await expect(page.getByRole("radio", { name: /Publish now/ })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Fix errors to publish" })
    ).toBeDisabled()

    await page.getByRole("button", { name: "Type", exact: true }).click()
    await page.setViewportSize({ width: 375, height: 800 })
    await expect(
      page.getByRole("radio", { name: /Balance Credit/ })
    ).toBeVisible()
    await expect(
      page.getByRole("radio", { name: /Product Promotion/ })
    ).toBeVisible()
  })

  test("@e2e/billing/admin/promotion-create-api enforces expiry and restrictions", async ({
    page,
  }) => {
    await page.goto("/en/portal/billing/promotions", {
      waitUntil: "domcontentloaded",
    })

    const invalidResponse = await page.request.post("/api/vouchers/portal", {
      data: {
        kind: "PRODUCT_PROMOTION",
        status: "ACTIVE",
        maxClaims: 1,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        discountType: "PERCENTAGE",
        discountValue: 15,
        currencyPolicy: "MATCH_CURRENCY_ONLY",
        allowedPackageCodes: [],
        allowedBillingPeriods: [],
      },
    })

    expect(invalidResponse.status()).toBe(422)
    const invalidBody = await invalidResponse.json()
    expect(invalidBody.ok).toBe(false)
    expect(invalidBody.fieldErrors.expiresAt).toBeDefined()
    expect(invalidBody.fieldErrors.allowedPackageCodes).toBeDefined()
    expect(invalidBody.fieldErrors.allowedBillingPeriods).toBeDefined()

    const balanceResponse = await page.request.post("/api/vouchers/portal", {
      data: {
        kind: "BALANCE_CREDIT",
        status: "ACTIVE",
        maxClaims: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        amount: 100,
        currency: "IDR",
      },
    })

    expect(balanceResponse.status()).toBe(201)
    const balanceBody = await balanceResponse.json()
    expect(balanceBody.data.kind).toBe("BALANCE_CREDIT")
    expect(balanceBody.data.status).toBe("ACTIVE")

    const productResponse = await page.request.post("/api/vouchers/portal", {
      data: {
        kind: "PRODUCT_PROMOTION",
        status: "DISABLED",
        maxClaims: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        discountType: "PERCENTAGE",
        discountValue: 15,
        currencyPolicy: "MATCH_CURRENCY_ONLY",
        allowedPackageCodes: ["VPN"],
        allowedBillingPeriods: ["MONTHLY"],
      },
    })

    expect(productResponse.status()).toBe(201)
    const productBody = await productResponse.json()
    expect(productBody.data.kind).toBe("PRODUCT_PROMOTION")
    expect(productBody.data.status).toBe("DISABLED")
    expect(productBody.data.allowedPackageCodes).toEqual(["VPN"])
    expect(productBody.data.allowedBillingPeriods).toEqual(["MONTHLY"])
    expect(productBody.data.amount).toBe("0.00")
  })
})
