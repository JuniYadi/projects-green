import { test, expect } from "@playwright/test"

test.describe("@e2e/whatsapp/portal/catalogs", () => {
  test("catalog creation flow exposes the current empty/error state", async ({
    page,
  }) => {
    await page.goto("/en/portal/whatsapp/catalogs")

    await expect(page.getByRole("heading", { name: "Catalogs" })).toBeVisible()
    await expect(
      page.getByText(
        "Manage your Facebook Catalogs and sync products from Commerce Manager."
      )
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Add Catalog" })
    ).toBeVisible()
    await expect(page.getByText("All Catalogs")).toBeVisible()

    await page.getByRole("button", { name: "Add Catalog" }).click()
    const dialog = page.getByRole("dialog", { name: "Add Catalog" })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(
        "Link a Facebook Commerce Manager catalog to your WhatsApp account."
      )
    ).toBeVisible()
    await expect(dialog.getByLabel("Catalog Name")).toHaveAttribute(
      "placeholder",
      "My Store Catalog"
    )
    await expect(dialog.getByLabel("Meta Catalog ID")).toHaveAttribute(
      "placeholder",
      "123456789"
    )
    await expect(dialog.getByLabel("Device ID (optional)")).toHaveAttribute(
      "placeholder",
      "Leave empty to use default device"
    )

    await dialog.getByRole("button", { name: "Create Catalog" }).click()
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Create Catalog" })
    ).toBeVisible()

    await dialog.getByLabel("Catalog Name").fill("ZZZ E2E TEST DELETE ME")
    await dialog.getByLabel("Meta Catalog ID").fill("e2e-test-catalog-0001")
    await dialog.getByRole("button", { name: "Create Catalog" }).click()

    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Create Catalog" })
    ).toBeVisible()
    await expect(page.getByText("ZZZ E2E TEST DELETE ME")).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole("heading", { name: "Catalogs" })).toBeVisible()
    await expect(page.getByText("No catalogs yet.")).toBeVisible()
  })
})
