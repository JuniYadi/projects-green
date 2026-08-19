import { test, expect } from "@playwright/test"

test.describe("WhatsApp API key docs @e2e/docs/public/api-keys", () => {
  const openApiHash =
    "/api/openapi#tag/whatsapp-devices/GET/api/whatsapp/devices/"

  async function verifyPage(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
    path: string,
    sectionHeading: RegExp,
    openApiLabel: RegExp
  ) {
    await page.goto(path)

    await expect(page.locator("main")).toBeVisible()
    await expect(page.locator("article")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const section = page
      .locator("article")
      .getByRole("heading", { level: 2, name: sectionHeading })
    await expect(section).toBeVisible()

    const curlCommand = page
      .locator("article code")
      .filter({ hasText: "curl -X GET" })
      .filter({ hasText: "/api/whatsapp/devices/" })
      .first()
    await expect(curlCommand).toBeVisible()
    await expect(curlCommand).toContainText(/curl -X GET/)
    await expect(curlCommand).toContainText("/api/whatsapp/devices/")
    await expect(curlCommand).toContainText(/Authorization:\s*Bearer/)

    const openApiLink = page
      .locator("article")
      .getByRole("link", { name: openApiLabel })
    await expect(openApiLink).toBeVisible()
    await expect(openApiLink).toHaveAttribute("href", new RegExp(openApiHash))
  }

  test("verifies English and Indonesian WhatsApp API key docs", async ({
    page,
  }) => {
    await verifyPage(
      page,
      "/en/docs/whatsapp/api-keys",
      /4\. Authenticating API Requests/,
      /WhatsApp Devices OpenAPI Reference/
    )

    await verifyPage(
      page,
      "/id/docs/whatsapp/api-keys",
      /4\. Otentikasi Panggilan API/,
      /Referensi OpenAPI WhatsApp Devices/
    )
  })
})
