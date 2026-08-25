import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { LockedFeatureTeaser } from "./locked-feature-teaser"

describe("LockedFeatureTeaser", () => {
  it("renders locked feature title and unlock level badge", () => {
    const view = render(
      <LockedFeatureTeaser
        featureTitle="Production API Keys"
        featureDescription="Create, scope, and rotate programmatic API keys."
        unlockLevel={2}
        prerequisiteDescription="Send your first message to unlock."
        activeMissionHref="/console/whatsapp/messages"
        activeMissionLabel="Open Messages"
      />
    )

    expect(view.getByText("Production API Keys")).toBeInTheDocument()
    expect(view.getByText(/Level 2/i)).toBeInTheDocument()
    expect(view.getByText("Open Messages")).toBeInTheDocument()
  })
})
