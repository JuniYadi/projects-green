/**
 * Authenticated admin proof for the VPN package/catalog boundary.
 * Requires `.auth/admin.json` and at least one active VPN server.
 */

import { expect, test } from "@playwright/test"

test.describe("VPN package catalog pricing", () => {
  test.setTimeout(120_000)

  test("creates a package, prices its selected plan, and returns to packages @e2e/billing/admin/vpn-package-catalog-pricing", async ({
    page,
  }) => {
    const packageName = `E2E VPN ${Date.now()}`

    await page.goto("/en/portal/vpn/packages", {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByRole("heading", { name: "Packages" })).toBeVisible({
      timeout: 30_000,
    })

    await page.getByRole("button", { name: "Add Package" }).click()
    const serverCheckboxes = page.locator(
      '[data-slot="dialog-content"] input[type="checkbox"][aria-label^="Include "]'
    )
    if ((await serverCheckboxes.count()) === 0) {
      test.skip(true, "No VPN servers are configured for authenticated E2E.")
    }
    const serverLabel = await serverCheckboxes
      .first()
      .getAttribute("aria-label")
    if (!serverLabel) {
      test.skip(true, "VPN server selector has no accessible label.")
      return
    }
    await page.getByLabel(serverLabel).check()
    await page.locator("#package-name").fill(packageName)
    await page.getByRole("button", { name: "Save" }).click()

    const packageRow = page.getByRole("row").filter({ hasText: packageName })
    await expect(packageRow).toBeVisible({ timeout: 30_000 })
    await expect(packageRow.getByText("Pricing required")).toBeVisible()
    await packageRow.getByRole("link", { name: "Manage pricing" }).click()

    await expect(page).toHaveURL(
      /\/portal\/billing\/catalog\/products\/vpn\?.*planId=.*returnTo=.*tab=plans/
    )
    await expect(page.getByText("Selected from VPN package")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Back to VPN packages" })
    ).toBeVisible()

    const selectedPlan = page.locator('[data-selected-plan="true"]')
    await expect(selectedPlan).toBeVisible()
    const monthlyPrice = selectedPlan.getByLabel(/IDR.*Monthly.*price/i)
    await monthlyPrice.fill("100000")

    const publishButton = page.getByRole("button", { name: "Publish" }).last()
    await expect(publishButton).toBeEnabled()
    await publishButton.click()
    await expect(
      page.getByRole("heading", { name: "Publish product?" })
    ).toBeVisible()
    await page.getByRole("button", { name: "Publish" }).last().click()

    await expect(page.getByText("Product published")).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("link", { name: "Back to VPN packages" }).click()
    await expect(page).toHaveURL(/\/portal\/vpn\/packages$/)
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: packageName })
        .getByText("IDR 100000")
    ).toBeVisible({ timeout: 30_000 })

    const visibleCatalog = await page.request.get("/api/vpn/packages")
    const visibleBody = (await visibleCatalog.json()) as {
      data: Array<{ name: string }>
    }
    expect(visibleBody.data.some((item) => item.name === packageName)).toBe(
      true
    )

    page.once("dialog", (dialog) => dialog.accept())
    await page
      .getByRole("row")
      .filter({ hasText: packageName })
      .getByRole("button", { name: `Deactivate ${packageName}` })
      .click()
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: packageName })
        .getByText("Inactive")
    ).toBeVisible({ timeout: 30_000 })

    const hiddenCatalog = await page.request.get("/api/vpn/packages")
    const hiddenBody = (await hiddenCatalog.json()) as {
      data: Array<{ name: string }>
    }
    expect(hiddenBody.data.some((item) => item.name === packageName)).toBe(
      false
    )
  })
})
