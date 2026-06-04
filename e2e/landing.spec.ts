import { test, expect } from "@playwright/test"

test.describe("Landing Page (/)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en")
  })

  test("has correct page title and description metadata", async ({ page }) => {
    await expect(page).toHaveTitle(/PFNApp/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /cloud|platform|developer/i
    )
  })

  test("navbar logo and brand are visible", async ({ page }) => {
    const nav = page.locator("header nav")
    await expect(nav.locator('a[href="/"]').first()).toBeVisible()
  })

  test("navbar has navigation links", async ({ page }) => {
    const nav = page.locator("header nav")
    await expect(nav.getByText("Products")).toBeVisible()
    await expect(nav.getByText("Pricing")).toBeVisible()
    await expect(nav.getByText("Docs")).toBeVisible()
    await expect(nav.getByText("Blog")).toBeVisible()
  })

  test("navbar has Sign in button linking to /login", async ({ page }) => {
    const link = page.locator('header nav a[href="/login"]')
    await expect(link).toBeVisible()
    await expect(link).toHaveText("Sign in")
  })

  test("navbar has Get started free CTA linking to /signup", async ({ page }) => {
    const link = page.locator('header nav a[href="/signup"]').first()
    await expect(link).toBeVisible()
    await expect(link).toHaveText("Get started free")
  })

  test("hero section renders with heading and subtext", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(
      page.getByText(/Deploy apps, send emails & SMS/i)
    ).toBeVisible()
  })

  test("hero has Start building free and Watch demo CTAs", async ({ page }) => {
    await expect(page.getByText("Start building free")).toBeVisible()
    await expect(page.getByText("Watch demo")).toBeVisible()
  })

  test("hero badges are visible", async ({ page }) => {
    await expect(page.getByText("SOC 2 Type II")).toBeVisible()
    await expect(page.getByText("Git-native deploys")).toBeVisible()
    await expect(page.getByText("1-click rollbacks")).toBeVisible()
  })

  test("services section has all 6 service cards", async ({ page }) => {
    const services = [
      "App Hosting",
      "Communication",
      "Storage S3",
      "AI Services",
      "Security & Auth",
      "Analytics",
    ]
    for (const service of services) {
      await expect(
        page.getByRole("heading", { name: service, exact: false })
      ).toBeVisible()
    }
  })

  test("pricing section has 4 plan tier headings", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Hobby", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Enterprise", exact: true })).toBeVisible()
  })

  test("pricing plan cards have price elements", async ({ page }) => {
    // $0 and /mo are in separate <span>s (Next.js hydration)
    await expect(page.locator("#pricing-plan-hobby")).toContainText("$0")
    await expect(page.locator("#pricing-plan-hobby")).toContainText("/mo")

    await expect(page.locator("#pricing-plan-pro")).toContainText("$23")
    await expect(page.locator("#pricing-plan-pro")).toContainText("/mo")

    await expect(page.locator("#pricing-plan-team")).toContainText("$79")
    await expect(page.locator("#pricing-plan-team")).toContainText("/mo")

    await expect(page.locator("#pricing-plan-enterprise")).toContainText("Custom")
  })

  test("pricing has Hobby plan features", async ({ page }) => {
    await expect(page.locator("#pricing-plan-hobby").getByText("3 projects", { exact: true })).toBeVisible()
    await expect(page.locator("#pricing-plan-hobby").getByText("100 GB bandwidth/mo")).toBeVisible()
  })

  test("pricing Pro plan has correct trial link", async ({ page }) => {
    const trialLink = page.locator("#pricing-cta-pro")
    await expect(trialLink).toHaveAttribute("href", "/signup?plan=pro")
  })

  test("pricing toggles between Monthly and Yearly", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Monthly/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /Yearly.*-20%/i })).toBeVisible()
  })

  test("features section heading is visible", async ({ page }) => {
    await expect(page.getByText("The platform that gets out of your way")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Git-native workflow" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Deploy in seconds" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Zero-trust security" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Global edge network" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Developer-first APIs" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Auto-scaling infra" })).toBeVisible()
  })

  test("CTA section has Start building for free link", async ({ page }) => {
    const startFree = page.getByRole("link", { name: /Get started free/i }).last()
    await expect(startFree).toBeVisible()
    await expect(startFree).toHaveAttribute("href", "/signup")
  })

  test("footer sections are present", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    const footer = page.locator("footer")
    await expect(footer.getByRole("heading", { name: "Product", exact: true })).toBeVisible()
    await expect(footer.getByRole("heading", { name: "Developers", exact: true })).toBeVisible()
    await expect(footer.getByRole("heading", { name: "Company", exact: true })).toBeVisible()
    await expect(footer.getByRole("heading", { name: "Legal", exact: true })).toBeVisible()
  })

  test("footer copyright bar is visible", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const footer = page.locator("footer")
    await expect(footer.getByText(/All rights reserved/)).toBeVisible()
    await expect(footer.getByText(/All systems operational/)).toBeVisible()
  })
})

test.describe("Landing Page — Mobile Responsive", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("page heading is readable on mobile", async ({ page }) => {
    await page.goto("/en")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("pricing cards are rendered on mobile", async ({ page }) => {
    await page.goto("/en")
    await expect(page.locator("#pricing-plan-hobby")).toBeVisible()
    await expect(page.locator("#pricing-plan-hobby")).toContainText("Hobby")
  })
})

test.describe("Landing Page — SEO & Accessibility", () => {
  test("has semantic heading hierarchy", async ({ page }) => {
    await page.goto("/en")
    const h1 = page.locator("h1")
    await expect(h1).toHaveCount(1)
    const h2Count = await page.locator("h2").count()
    expect(h2Count).toBeGreaterThanOrEqual(3)
  })
})

test.describe("Landing Page — Navigation", () => {
  test("Pricing link scrolls to pricing section", async ({ page }) => {
    await page.goto("/en")
    await page.locator('header nav a[href="#pricing"]').click()
    await page.waitForTimeout(1000)
    const pricingHeading = page.getByRole("heading", { name: "Simple, transparent pricing" })
    await expect(pricingHeading).toBeInViewport()
  })

  test("Sign in link has correct href", async ({ page }) => {
    await page.goto("/en")
    const signIn = page.locator('header nav a[href="/login"]')
    await expect(signIn).toHaveAttribute("href", "/login")
  })

  test("Get started free navigates to /signup", async ({ page }) => {
    await page.goto("/en")
    await page.locator('header nav a[href="/signup"]').first().click()
    await page.waitForURL("**/signup**")
  })
})
