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
}))

describe("Console Marketplace Hub & Template Cards", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders TemplateCard with icon, tagline, official badge, category, and resource requirement chips", () => {
    const template = OFFICIAL_APP_TEMPLATES[0]
    const onDeploy = mock(() => {})

    render(
      <TemplateCard
        template={{
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
    expect(screen.getByText(template.name)).toBeInTheDocument()
    expect(screen.getByText(template.tagline)).toBeInTheDocument()

    // Official Verified badge
    expect(screen.getByTitle("Official Verified")).toBeInTheDocument()

    // Category
    expect(screen.getByText(template.category)).toBeInTheDocument()

    // Resource chip (CPU & RAM & Dependencies)
    expect(
      screen.getByText(/500m CPU · 512MB RAM · Requires 1x Postgres/i)
    ).toBeInTheDocument()

    // Deploy CTA
    const deployBtn = screen.getByRole("button", { name: /deploy/i })
    expect(deployBtn).toBeInTheDocument()
  })

  it("triggers onDeploy callback when clicking Deploy button on TemplateCard", async () => {
    const template = OFFICIAL_APP_TEMPLATES[1] // Hermes
    const onDeploy = mock(() => {})
    const user = userEvent.setup()

    render(
      <TemplateCard
        template={{
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

    const deployBtn = screen.getByRole("button", { name: /deploy/i })
    await user.click(deployBtn)

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

    // Hero title & description
    expect(screen.getByText("App Hosting Marketplace")).toBeInTheDocument()
    expect(
      screen.getByText(/Deploy open-source applications, AI agent workspaces/i)
    ).toBeInTheDocument()

    // Navigation Tabs
    expect(screen.getByText("Marketplace Hub")).toBeInTheDocument()
    expect(screen.getByText("My Workspace Templates")).toBeInTheDocument()
    expect(screen.getByText("Create Custom Template")).toBeInTheDocument()

    // Featured templates in hero
    expect(screen.getByRole("button", { name: /n8n/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /hermes/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /9router/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /umami/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /wordpress/i })
    ).toBeInTheDocument()
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
      /search templates by name, category, or stack/i
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
      /search templates by name, category, or stack/i
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
    expect(screen.getByText("App Hosting Marketplace")).toBeInTheDocument()
  })
})
