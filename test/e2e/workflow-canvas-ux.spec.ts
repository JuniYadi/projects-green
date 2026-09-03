import { test, expect } from "@playwright/test"

test.describe("@e2e/whatsapp/user/canvas-header-ux", () => {
  test("reviews workflow canvas header controls and responsive behavior", async ({
    page,
  }) => {
    await page.goto("/en/console/whatsapp/workflows/wf_new/canvas")

    const header = page.locator("header")
    await expect(header).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toBeVisible()
    await expect(
      page.getByRole("textbox", { name: "Workflow name" })
    ).toHaveValue(/\S+/)
    await expect(
      page.getByRole("button", { name: "Save and deploy" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Simulate test" })
    ).toBeVisible()

    const overflowMenuButton = page
      .locator('button[aria-haspopup="menu"]')
      .last()
    await overflowMenuButton.click()
    await expect(page.getByRole("menu")).toBeVisible()
    await expect(page.getByRole("menu")).toContainText(
      "Set as default workflow"
    )
    await expect(page.getByRole("menu")).toContainText("Trigger Settings")
    await expect(
      page.getByRole("menuitem", { name: "Show MiniMap" })
    ).toBeVisible()
    await expect(
      page.getByRole("menuitem", { name: "Export JSON" })
    ).toBeVisible()
    await expect(
      page.getByRole("menuitem", { name: "Import JSON" })
    ).toBeVisible()

    const phoneSelector = page.getByRole("combobox")
    await expect(phoneSelector).toContainText(/\+\d+/)
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "AI Assist" }).click()
    const copilotPrompt = page.getByRole("textbox", {
      name: "Describe the workflow you want to build...",
    })
    await expect(copilotPrompt).toBeVisible()
    await expect(copilotPrompt).toHaveValue("")
    await expect(
      page.getByRole("button", { name: "Generate with AI" })
    ).toBeEnabled()
    await page.getByRole("button", { name: "Generate with AI" }).click()
    await expect(
      page.getByRole("region", { name: /Notifications/ })
    ).toContainText("Describe the workflow you want to build...")
    await page.getByRole("button", { name: "Close" }).click()
    await page.getByRole("button", { name: "Ask P", exact: true }).click()
    const assistant = page.getByRole("dialog", { name: "Ask P" })
    await expect(assistant).toBeVisible()
    await expect(
      assistant.getByRole("heading", { name: "Ask P" })
    ).toBeVisible()
    await expect(
      assistant.getByRole("textbox", {
        name: "Ask P anything about this page or workflows...",
      })
    ).toBeVisible()
    await assistant.getByRole("button", { name: "Close" }).click()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.getByRole("textbox", { name: "Workflow name" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Save and deploy" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Send message" })
    ).toBeVisible()
  })
})
