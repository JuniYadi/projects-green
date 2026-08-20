import { test, expect } from "@playwright/test"

test.describe("@e2e/docs/public/whatsapp-api-keys", () => {
  test("renders English and Indonesian WhatsApp API key guides", async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text())
      }
    })
    page.on("pageerror", (error) => {
      pageErrors.push(error.message)
    })

    await page.setViewportSize({ width: 1440, height: 1000 })

    const englishResponse = await page.goto("/en/docs/whatsapp/api-keys")
    expect(englishResponse?.status()).toBe(200)
    await expect(page).toHaveTitle(/WhatsApp API Key Management/i)
    await expect(page.locator("main h1")).toContainText(
      "WhatsApp API Key Management & Integration Guide"
    )
    await expect(page.locator("main h2").first()).toBeVisible()
    await expect(page.locator("main")).toContainText("Generate API key")
    await expect(page.locator("main")).toContainText("Rotate API key")

    const englishImages = page.locator("main img")
    await expect(englishImages.first()).toBeVisible()
    expect(await englishImages.count()).toBeGreaterThan(0)
    for (let index = 0; index < (await englishImages.count()); index++) {
      await expect
        .poll(() =>
          englishImages
            .nth(index)
            .evaluate(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0
            )
        )
        .toBe(true)
    }

    const englishToc = page
      .locator("aside")
      .filter({ has: page.locator('a[href^="#"]') })
    await expect(englishToc).toBeVisible()
    await expect(englishToc.locator('a[href^="#"]').first()).toBeVisible()

    const indonesianResponse = await page.goto("/id/docs/whatsapp/api-keys")
    expect(indonesianResponse?.status()).toBe(200)
    await expect(page).toHaveTitle(/Panduan Pengelolaan & Integrasi WhatsApp/i)
    await expect(page.locator("main h1")).toContainText(
      "Panduan Pengelolaan & Integrasi WhatsApp API Key"
    )
    await expect(page.locator("main h2").first()).toBeVisible()
    await expect(page.locator("main")).toContainText("Generate API Key")
    await expect(page.locator("main")).toContainText("Rotasi API Key")

    const indonesianImages = page.locator("main img")
    await expect(indonesianImages.first()).toBeVisible()
    expect(await indonesianImages.count()).toBeGreaterThan(0)
    for (let index = 0; index < (await indonesianImages.count()); index++) {
      await expect
        .poll(() =>
          indonesianImages
            .nth(index)
            .evaluate(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0
            )
        )
        .toBe(true)
    }

    const indonesianToc = page
      .locator("aside")
      .filter({ has: page.locator('a[href^="#"]') })
    await expect(indonesianToc).toBeVisible()
    await expect(indonesianToc.locator('a[href^="#"]').first()).toBeVisible()

    expect(consoleErrors).toEqual([])
    expect(pageErrors).toEqual([])
  })
})
