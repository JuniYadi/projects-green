import { test, expect } from "@playwright/test"

test.describe("Documentation navigation @e2e/docs/public/documentation-navigation", () => {
  test("opens the docs landing page and WhatsApp API key guide", async ({
    page,
  }) => {
    await page.goto("/en/docs")

    await expect(
      page.getByRole("heading", {
        name: "Documentation & Tutorials",
        level: 1,
      })
    ).toBeVisible()

    await expect(
      page.getByText(
        "Step-by-step guides with real visual screenshots, API references, and practical code examples to help you integrate and scale."
      )
    ).toBeVisible()

    await expect(
      page.getByRole("heading", {
        name: "Explore by Category",
        level: 2,
      })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", { name: "WhatsApp", level: 3 })
    ).toBeVisible()

    await expect(page.getByRole("link", { name: "Read guide" })).toBeVisible()

    await page.goto("/en/docs/whatsapp/api-keys")

    await expect(
      page.getByRole("heading", {
        name: "WhatsApp API Key Management & Integration Guide",
        level: 1,
      })
    ).toBeVisible()

    await expect(
      page.getByText("Verified Guide", { exact: true })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", {
        name: "1. Overview & Security Model",
        level: 2,
      })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", {
        name: "2. Generating Your API Key",
        level: 2,
      })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", {
        name: "3. Key Lifecycle Management",
        level: 2,
      })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", {
        name: "4. Authenticating API Requests",
        level: 2,
      })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", { name: "5. Audit & Compliance", level: 2 })
    ).toBeVisible()

    await expect(
      page.getByRole("img", { name: "Initial Not Generated State" })
    ).toBeVisible()

    await expect(
      page.getByRole("img", { name: "Key Generated with One-Time Secret" })
    ).toBeVisible()

    await expect(
      page.getByRole("img", { name: "Rotate API Key Confirmation Dialog" })
    ).toBeVisible()

    await expect(
      page.getByRole("img", { name: "Revoke API Key Confirmation Dialog" })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", {
        name: "Example: Checking WhatsApp Devices Status",
        level: 3,
      })
    ).toBeVisible()

    await expect(
      page.getByRole("heading", {
        name: "OpenAPI Specification & SDK Reference",
        level: 3,
      })
    ).toBeVisible()

    await expect(page.getByText("ON THIS PAGE", { exact: true })).toBeVisible()

    await expect(
      page.getByRole("link", { name: "3. Key Lifecycle Management" })
    ).toBeVisible()

    await page
      .getByRole("link", { name: "3. Key Lifecycle Management" })
      .click()

    await expect(page).toHaveURL(
      /\/en\/docs\/whatsapp\/api-keys#3-key-lifecycle-management$/
    )
    await expect(
      page.getByRole("heading", {
        name: "3. Key Lifecycle Management",
        level: 2,
      })
    ).toBeVisible()
  })
})
