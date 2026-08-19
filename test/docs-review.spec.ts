import { test, expect } from "@playwright/test"

test.describe("@e2e/docs/public/whatsapp-api-key-guide", () => {
  test("opens the docs index and WhatsApp API key guide", async ({ page }) => {
    await page.goto("/en/docs")

    await expect(page).toHaveURL(/\/en\/docs$/)
    await expect(page.getByRole("banner")).toBeVisible()
    await expect(page.getByRole("link", { name: "PFNApp" })).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Documentation" }).first()
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Console" })).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "PFNApp Platform Documentation",
        level: 1,
      })
    ).toBeVisible()

    const guideCard = page.getByRole("main").getByRole("link", {
      name: /WhatsApp API Key Management & Integration Guide/i,
    })
    await expect(guideCard).toBeVisible()
    await expect(guideCard).toHaveAttribute(
      "href",
      "/en/docs/whatsapp/api-keys"
    )

    await page.goto("/en/docs/whatsapp/api-keys")

    await expect(page).toHaveURL(/\/en\/docs\/whatsapp\/api-keys$/)
    await expect(
      page
        .getByRole("heading", {
          name: "WhatsApp API Key Management & Integration Guide",
          level: 1,
        })
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(
        "Generate, rotate, and securely use your organization's static WhatsApp API key",
        { exact: false }
      )
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Documentation" }).last()
    ).toHaveAttribute("href", "/en/docs")

    for (const section of [
      "1. Overview & Security Model",
      "2. Generating Your API Key",
      "3. Key Lifecycle Management",
      "4. Authenticating API Requests",
      "5. Audit & Compliance",
    ]) {
      await expect(
        page.getByRole("heading", { name: section, level: 2 })
      ).toBeVisible()
    }

    for (const alt of [
      "Initial Not Generated State",
      "Key Generated with One-Time Secret",
      "Rotate API Key Confirmation Dialog",
      "Revoke API Key Confirmation Dialog",
    ]) {
      const image = page.locator(`img[alt="${alt}"]`)
      await expect(image).toBeVisible()
      await expect(image).toHaveAttribute("src", /.+/)
    }

    const codeBlocks = page.locator("pre code")
    await expect(codeBlocks).toHaveCount(2)
    for (let index = 0; index < 2; index += 1) {
      await expect(codeBlocks.nth(index)).not.toBeEmpty()
    }

    await page.setViewportSize({ width: 500, height: 844 })
    await expect(
      page
        .getByRole("heading", {
          name: "WhatsApp API Key Management & Integration Guide",
          level: 1,
        })
        .first()
    ).toBeVisible()
  })
})
