import { test, expect } from "@playwright/test"

test.describe("WhatsApp dashboard locale flow @e2e/whatsapp/user/locale-subscription", () => {
  test("verifies English dashboard and subscription dialog", async ({
    page,
  }) => {
    await page.goto("/en/console/whatsapp/dashboard")

    await expect(
      page.getByRole("heading", { name: "WhatsApp Dashboard", level: 1 })
    ).toBeVisible()
    await expect(
      page.getByText(
        "Monitor your WhatsApp devices, conversations, and message activity.",
        { exact: true }
      )
    ).toBeVisible()

    await page.getByRole("button", { name: "Subscribe Plan" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("heading", { name: "Subscribe to WhatsApp", level: 2 })
    ).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Subscribe" })
    ).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible()
  })

  test("verifies Indonesian dashboard and subscription dialog", async ({
    page,
  }) => {
    await page.goto("/id/console/whatsapp/dashboard")

    await expect(
      page.getByRole("heading", { name: "Dasbor WhatsApp", level: 1 })
    ).toBeVisible()
    await expect(
      page.getByText(
        "Pantau perangkat, percakapan, dan aktivitas pesan WhatsApp Anda.",
        { exact: true }
      )
    ).toBeVisible()

    await page.getByRole("button", { name: "Pilih Paket" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("heading", { name: "Langganan WhatsApp", level: 2 })
    ).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Langganan Sekarang" })
    ).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Batal" })).toBeVisible()
  })
})
