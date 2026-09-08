import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import ConsoleMarketplacePage from "./page"
import { MarketplaceShowcase } from "./_components/marketplace-showcase"
import { TemplateCard } from "./_components/template-card"
import { OFFICIAL_APP_TEMPLATES } from "@/modules/deploy/app-template.seed"

const mockPush = mock(() => {})
mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush }),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      templates: {
        get: mock(async () => ({
          data: OFFICIAL_APP_TEMPLATES.map((tmpl) => ({
            id: tmpl.slug,
            slug: tmpl.slug,
            name: tmpl.name,
            tagline: tmpl.tagline,
            description: tmpl.description,
            iconUrl: tmpl.iconUrl,
            category: tmpl.category,
            isOfficial: tmpl.isOfficial,
            isFeatured: tmpl.isFeatured,
            installCount: tmpl.installCount,
            blueprintJson: tmpl.blueprint,
          })),
        })),
      },
      deploy: {
        submit: {
          post: mock(async () => ({
            data: { ok: true },
          })),
        },
      },
    },
  },
}))

mock.module("@/lib/billing-client", () => ({
  getCatalogProduct: mock(async () => ({
    ok: true,
    product: {
      code: "APP_HOSTING",
      name: "App Hosting",
      plans: [
        {
          id: "plan_starter",
          code: "STARTER",
          name: "Starter",
          offers: [
            {
              id: "off_1",
              billingPeriod: "MONTHLY",
              periodPrice: "15000",
              currency: "IDR",
            },
          ],
        },
      ],
    },
  })),
}))

describe("Console Marketplace Hub & Template Cards", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders TemplateCard with icon, tagline, official badge, category, and resource requirement chips", () => {
    const template = OFFICIAL_APP_TEMPLATES[0]
    const onDeploy = mock(() => {})

    const { container } = render(
      <TemplateCard
        template={{
          id: template.slug,
          slug: template.slug,
          name: template.name,
          tagline: template.tagline,
          category: template.category,
          isOfficial: template.isOfficial,
          blueprint: template.blueprint,
          iconUrl: template.iconUrl,
        }}
        onDeploy={onDeploy}
      />
    )

    // Name and Tagline
    expect(container.querySelector("h3")?.textContent).toBe(template.name)
    expect(container.textContent).toContain(template.tagline)

    // Official Verified badge
    expect(
      container.querySelector("[title='Official Verified']")
    ).toBeInTheDocument()

    // Category
    expect(container.textContent).toContain(template.category)

    // Resource chip (CPU & RAM & Dependencies)
    expect(container.textContent).toMatch(
      /500m CPU · 512MB RAM · Requires 1x Postgres/i
    )

    // Deploy CTA
    const deployBtn = container.querySelector("button")
    expect(deployBtn).toBeInTheDocument()
  })

  it("triggers onDeploy callback when clicking Deploy button on TemplateCard", async () => {
    const template = OFFICIAL_APP_TEMPLATES[1] // Hermes
    const onDeploy = mock(() => {})
    const user = userEvent.setup()

    const { container } = render(
      <TemplateCard
        template={{
          id: template.slug,
          slug: template.slug,
          name: template.name,
          tagline: template.tagline,
          category: template.category,
          isOfficial: template.isOfficial,
          blueprint: template.blueprint,
        }}
        onDeploy={onDeploy}
      />
    )

    const deployBtn = container.querySelector("button")
    expect(deployBtn).not.toBeNull()
    if (deployBtn) {
      await user.click(deployBtn)
    }

    expect(onDeploy).toHaveBeenCalledTimes(1)
    expect(onDeploy).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "hermes",
        name: template.name,
      })
    )
  })

  it("renders MarketplaceShowcase with hero banner featuring official templates and navigation tabs", () => {
    const { getByText } = render(<MarketplaceShowcase />)

    // Header title & description
    expect(getByText("App Marketplace")).toBeInTheDocument()
    expect(
      getByText(/1-Click deploy open-source apps, AI agents/i)
    ).toBeInTheDocument()

    // Navigation Tabs
    expect(getByText("Marketplace Hub")).toBeInTheDocument()
    expect(getByText("My Workspace Templates")).toBeInTheDocument()
    expect(getByText("Create Custom Template")).toBeInTheDocument()
  })
  it("filters templates by category chips", async () => {
    const user = userEvent.setup()
    const { getByText, getByRole, queryByText } = render(
      <MarketplaceShowcase />
    )

    // Initially all templates are shown in the grid
    expect(
      getByText("Fair-code workflow automation platform")
    ).toBeInTheDocument()
    expect(
      getByText("Autonomous AI agent gateway by Nous Research")
    ).toBeInTheDocument()
    expect(
      getByText("World's most popular open-source content management system")
    ).toBeInTheDocument()
    expect(
      getByText("Privacy-focused, lightweight open-source web analytics")
    ).toBeInTheDocument()

    // Click 'AI' category
    const aiCategoryBtn = getByRole("button", { name: /^AI$/i })
    await user.click(aiCategoryBtn)

    // AI templates should be visible
    expect(
      getByText("Autonomous AI agent gateway by Nous Research")
    ).toBeInTheDocument()
    expect(
      getByText("High-throughput LLM gateway and router")
    ).toBeInTheDocument()

    // Non-AI templates should not be in the template grid
    expect(
      queryByText("Fair-code workflow automation platform")
    ).not.toBeInTheDocument()
    expect(
      queryByText("World's most popular open-source content management system")
    ).not.toBeInTheDocument()

    // Click 'CMS' category
    const cmsCategoryBtn = getByRole("button", { name: /^CMS$/i })
    await user.click(cmsCategoryBtn)

    expect(
      getByText("World's most popular open-source content management system")
    ).toBeInTheDocument()
    expect(
      queryByText("Autonomous AI agent gateway by Nous Research")
    ).not.toBeInTheDocument()
  })

  it("filters templates by real-time search input", async () => {
    const user = userEvent.setup()
    const { getByText, getByPlaceholderText, queryByText } = render(
      <MarketplaceShowcase />
    )

    const searchInput = getByPlaceholderText(/search apps by name or stack/i)

    // Search for "analytics"
    await user.type(searchInput, "analytics")

    // Umami (privacy analytics) should match
    expect(
      getByText("Privacy-focused, lightweight open-source web analytics")
    ).toBeInTheDocument()
    expect(
      queryByText("Fair-code workflow automation platform")
    ).not.toBeInTheDocument()
    expect(
      queryByText("Autonomous AI agent gateway by Nous Research")
    ).not.toBeInTheDocument()

    // Clear search
    await user.clear(searchInput)
    expect(
      getByText("Fair-code workflow automation platform")
    ).toBeInTheDocument()
    expect(
      getByText("Autonomous AI agent gateway by Nous Research")
    ).toBeInTheDocument()
  })

  it("shows empty state when search matches no templates and allows clearing filters", async () => {
    const user = userEvent.setup()
    const { getByText, getByPlaceholderText, getByRole } = render(
      <MarketplaceShowcase />
    )

    const searchInput = getByPlaceholderText(/search apps by name or stack/i)

    await user.type(searchInput, "nonexistenttemplatequery123")

    expect(getByText("No templates found")).toBeInTheDocument()

    const clearBtn = getByRole("button", { name: /clear filters/i })
    await user.click(clearBtn)
    expect(
      getByText("Fair-code workflow automation platform")
    ).toBeInTheDocument()
  })

  it("renders full ConsoleMarketplacePage container with correct spacing and classes", () => {
    const { container, getByText } = render(<ConsoleMarketplacePage />)

    const mainDiv = container.querySelector(
      ".flex.flex-1.flex-col.gap-6.p-6.pt-0"
    )
    expect(mainDiv).not.toBeNull()
    expect(getByText("App Marketplace")).toBeInTheDocument()
  })

  it("launches drawer and handles deploy submit with targeted app query redirect", async () => {
    const user = userEvent.setup()
    const { getAllByRole, getByText } = render(<ConsoleMarketplacePage />)

    // Find first Deploy button in template cards
    const deployButtons = getAllByRole("button", { name: /^deploy$/i })
    expect(deployButtons.length).toBeGreaterThan(0)
    await user.click(deployButtons[0])

    // The drawer should open, enter app name if needed and submit
    const appNameInput = document.querySelector(
      "#app-name-input"
    ) as HTMLInputElement
    expect(appNameInput).toBeDefined()
    await user.clear(appNameInput)
    await user.type(appNameInput, "my-n8n-app")

    const submitDeployBtn = getByText("Confirm & Deploy Instantly")
    await user.click(submitDeployBtn)

    expect(mockPush).toHaveBeenCalledWith(
      "/en/console/app/platform/my-n8n-app?tab=deployments"
    )
  })
})
