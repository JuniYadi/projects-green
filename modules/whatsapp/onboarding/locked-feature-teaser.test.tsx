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

  it("renders Indonesian copy and localizes the mission link", () => {
    const view = render(
      <LockedFeatureTeaser
        featureTitle="API Key Produksi"
        featureDescription="Buat dan kelola API key untuk integrasi WhatsApp."
        unlockLevel={2}
        prerequisiteDescription="Kirim pesan pertama dan setujui template."
        activeMissionHref="/console/whatsapp/messages"
        locale="id"
      />
    )

    expect(view.getByText("Fitur Terkunci • Level 2")).toBeInTheDocument()
    expect(view.getByText("Syarat Pembukaan")).toBeInTheDocument()
    expect(view.getByText("Selesaikan Misi Aktif")).toBeInTheDocument()
    expect(
      view.getByRole("link", { name: "Selesaikan Misi Aktif" })
    ).toHaveAttribute("href", "/id/console/whatsapp/messages")
  })
})
