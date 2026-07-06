/**
 * E2E tests for the WhatsApp Dashboard (authenticated).
 *
 * These tests require a valid auth session saved in `.auth/user.json`.
 * Run `bun run test:e2e:auth` first to set it up.
 */

import { test, expect } from "@playwright/test"

test.describe("WhatsApp Dashboard (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/console/whatsapp/dashboard")
  })

  test("page has correct heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "WhatsApp Dashboard" })
    ).toBeVisible()
  })

  test("shows global stat cards", async ({ page }) => {
    // Global stat cards render with aggregate totals
    await expect(page.getByText("Total Devices")).toBeVisible()
    await expect(page.getByText("Messages In")).toBeVisible()
    await expect(page.getByText("Messages Out")).toBeVisible()
    await expect(page.getByText("Broadcasts")).toBeVisible()
  })

  test("shows quick action cards", async ({ page }) => {
    // These are always visible regardless of API data
    await expect(page.getByText("Send Template Message")).toBeVisible()
    await expect(page.getByText("Manage Templates")).toBeVisible()
    await expect(page.getByText("View Contacts")).toBeVisible()
  })

  test("has Manage Devices and Send Template Message buttons in header", async ({
    page,
  }) => {
    await expect(
      page.getByRole("link", { name: /Manage Devices/i })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Send Template Message/i })
    ).toBeVisible()
  })

  test("navigates to devices page via Manage Devices button", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /Manage Devices/i }).click()
    await expect(page).toHaveURL(/\/console\/whatsapp\/devices/)
  })

  test("navigates to messages page via Send Template Message header button", async ({
    page,
  }) => {
    await page
      .getByRole("link", { name: /Send Template Message/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/console\/whatsapp\/messages/)
  })

  test("navigates to templates page via Manage Templates card", async ({
    page,
  }) => {
    await page.getByText("Manage Templates").click()
    await expect(page).toHaveURL(/\/console\/whatsapp\/templates/)
  })

  test("navigates to contacts page via View Contacts card", async ({
    page,
  }) => {
    await page.getByText("View Contacts").click()
    await expect(page).toHaveURL(/\/console\/whatsapp\/contacts/)
  })

  test("sidebar navigation is visible", async ({ page }) => {
    // Sidebar should render with console sections
    const sidebar = page.locator("nav[data-sidebar]")
    await expect(sidebar).toBeVisible()
  })

  test("sidebar has WhatsApp section", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Dashboard/i })).toBeVisible()
  })
})
