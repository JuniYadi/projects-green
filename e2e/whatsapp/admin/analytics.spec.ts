import { expect, test } from "@playwright/test"

test.describe("@e2e/whatsapp/admin/analytics-profitability", () => {
  test("loads analytics data after Meta pricing sync", async ({ page }) => {
    await page.goto("/id/portal/whatsapp/analytics")

    await expect(
      page.getByRole("heading", { name: "WhatsApp Analytics & Profit" })
    ).toBeVisible()
    await expect(
      page.getByText(
        "Rekonsiliasi biaya riil Meta (+ PPN 11%), pendapatan langganan, dan margin keuntungan platform."
      )
    ).toBeVisible()
    await expect(page.getByRole("combobox")).toHaveValue("30 Hari Terakhir")

    for (const label of [
      "Internal Revenue",
      "Meta Real Expense (COGS)",
      "Gross Profit",
      "Platform Gross Margin",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }

    const categoryTable = page.locator("table").first()
    await expect(categoryTable).toBeVisible()
    await expect(categoryTable).toContainText("Kategori")
    await expect(categoryTable).toContainText("Volume")
    await expect(categoryTable).toContainText("Margin (%)")

    await expect(
      page.getByText("Profitabilitas per Organisasi / Tenant")
    ).toBeVisible()
    await expect(
      page.getByText(/Belum ada data rekonsiliasi organisasi pada periode ini/)
    ).toBeVisible()

    const syncResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/whatsapp/analytics/sync") &&
        response.status() === 200
    )
    await page.getByRole("button", { name: "Sync Meta Pricing" }).click()
    await syncResponse

    await expect(
      page.getByRole("button", { name: "Sync Meta Pricing" })
    ).toBeEnabled()
    await expect(page.getByText(/Rp\s*[\d.,]+/).first()).toBeVisible()

    await expect(categoryTable.locator("tbody tr")).not.toHaveCount(0)

    const organizationTable = page.locator("table").nth(1)
    await expect(organizationTable).toBeVisible()
    await expect(organizationTable).toContainText("Organization ID")
    await expect(organizationTable).toContainText("Devices")
    await expect(organizationTable).toContainText("Delivered")
    await expect(organizationTable).toContainText("Status")
    await expect(organizationTable.locator("tbody tr")).not.toHaveCount(0)
    await expect(organizationTable.locator("tbody tr").first()).not.toBeEmpty()

    // The verified page currently has no timeseries chart container.
    await expect(
      page.locator("canvas, [data-testid*='chart'], [aria-label*='chart' i]")
    ).toHaveCount(0)
  })
})
