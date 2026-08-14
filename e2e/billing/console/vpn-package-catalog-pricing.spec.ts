/**
 * Authenticated member proof for VPN catalog visibility.
 * Requires `.auth/user.json` and a seeded, published VPN package.
 */

import { expect, test } from "@playwright/test"

test("shows only purchasable VPN packages in the member catalog @e2e/billing/console/vpn-package-catalog-pricing", async ({
  page,
}) => {
  await page.goto("/en/console/vpn/order", {
    waitUntil: "domcontentloaded",
  })

  await expect(
    page.getByRole("heading", { name: "Order VPN Package" })
  ).toBeVisible({ timeout: 30_000 })

  const emptyState = page.getByText("No VPN packages are available right now.")
  const selectButtons = page.getByRole("button", { name: "Select" })
  if ((await selectButtons.count()) === 0) {
    await expect(emptyState).toBeVisible()
    return
  }

  await expect(selectButtons.first()).toBeVisible()
  await expect(page.getByText("Pricing required")).toHaveCount(0)
})
