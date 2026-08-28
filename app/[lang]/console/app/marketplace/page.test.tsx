import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import ConsoleMarketplacePage from "./page"
import { MarketplaceShowcase } from "./_components/marketplace-showcase"
import { TemplateCard } from "./_components/template-card"
import { OFFICIAL_APP_TEMPLATES } from "@/modules/deploy/app-template.seed"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mock(() => {}) }),
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
        name: "Hermes",
      })
    )
  })

  it("renders MarketplaceShowcase with hero banner featuring official templates and navigation tabs", () => {
    render(<MarketplaceShowcase />)

    // Header title & description
    expect(screen.getByText("App Marketplace")).toBeInTheDocument()
    expect(
      screen.getByText(/1-Click deploy open-source apps, AI agents/i)
    ).toBeInTheDocument()

    // Navigation Tabs
    expect(screen.getByText("Marketplace Hub")).toBeInTheDocument()
    expect(screen.getByText("My Workspace Templates")).toBeInTheDocument()
    expect(screen.getByText("Create Custom Template")).toBeInTheDocument()
  })
  it("filters templates by category chips", async () => {
    const user = userEvent.setup()
    render(<MarketplaceShowcase />)

    // Initially all templates are shown in the grid
    expect(
      screen.getByText("Fair-code workflow automation platform")
    ).toBeInTheDocument()
    expect(
      screen.getByText("AI Agent workspace and interactive canvas")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "World's most popular open-source content management system"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText("Privacy-focused, lightweight open-source web analytics")
    ).toBeInTheDocument()

    // Click 'AI' category
    const aiCategoryBtn = screen.getByRole("button", { name: /^AI$/i })
    await user.click(aiCategoryBtn)

    // AI templates should be visible
    expect(
      screen.getByText("AI Agent workspace and interactive canvas")
    ).toBeInTheDocument()
    expect(
      screen.getByText("High-throughput LLM gateway and router")
    ).toBeInTheDocument()

    // Non-AI templates should not be in the template grid
    expect(
      screen.queryByText("Fair-code workflow automation platform")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "World's most popular open-source content management system"
      )
    ).not.toBeInTheDocument()

    // Click 'CMS' category
    const cmsCategoryBtn = screen.getByRole("button", { name: /^CMS$/i })
    await user.click(cmsCategoryBtn)

    expect(
      screen.getByText(
        "World's most popular open-source content management system"
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText("AI Agent workspace and interactive canvas")
    ).not.toBeInTheDocument()
  })

  it("filters templates by real-time search input", async () => {
    const user = userEvent.setup()
    render(<MarketplaceShowcase />)

    const searchInput = screen.getByPlaceholderText(
      /search apps by name or stack/i
    )

    // Search for "analytics"
    await user.type(searchInput, "analytics")

    // Umami (privacy analytics) should match
    expect(
      screen.getByText("Privacy-focused, lightweight open-source web analytics")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Fair-code workflow automation platform")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("AI Agent workspace and interactive canvas")
    ).not.toBeInTheDocument()

    // Clear search
    await user.clear(searchInput)
    expect(
      screen.getByText("Fair-code workflow automation platform")
    ).toBeInTheDocument()
    expect(
      screen.getByText("AI Agent workspace and interactive canvas")
    ).toBeInTheDocument()
  })

  it("shows empty state when search matches no templates and allows clearing filters", async () => {
    const user = userEvent.setup()
    render(<MarketplaceShowcase />)

    const searchInput = screen.getByPlaceholderText(
      /search apps by name or stack/i
    )

    await user.type(searchInput, "nonexistenttemplatequery123")

    expect(screen.getByText("No templates found")).toBeInTheDocument()

    const clearBtn = screen.getByRole("button", { name: /clear filters/i })
    await user.click(clearBtn)
    expect(
      screen.getByText("Fair-code workflow automation platform")
    ).toBeInTheDocument()
  })

  it("renders full ConsoleMarketplacePage container with correct spacing and classes", () => {
    const { container } = render(<ConsoleMarketplacePage />)

    const mainDiv = container.querySelector(
      ".flex.flex-1.flex-col.gap-6.p-6.pt-0"
    )
    expect(mainDiv).not.toBeNull()
    expect(screen.getByText("App Marketplace")).toBeInTheDocument()
  })
})
