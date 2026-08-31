import { describe, expect, it } from "bun:test"
import { render, screen } from "@testing-library/react"
import { MetaNameStatusBadge } from "./meta-name-status-badge"

describe("MetaNameStatusBadge", () => {
  it("renders approved badge correctly", () => {
    render(<MetaNameStatusBadge nameStatus="APPROVED" />)
    expect(screen.getByText(/approved|disetujui/i)).toBeDefined()
  })

  it("renders with verified name when showName is true", () => {
    render(
      <MetaNameStatusBadge
        nameStatus="APPROVED"
        verifiedName="Acme Corp"
        showName
      />
    )
    expect(screen.getByText("Acme Corp")).toBeDefined()
    expect(screen.getByText(/approved|disetujui/i)).toBeDefined()
  })

  it("handles unavailable sync state", () => {
    render(
      <MetaNameStatusBadge
        nameStatus="APPROVED"
        profile={{ meta_name_status_sync_state: "UNAVAILABLE" }}
      />
    )
    expect(screen.getByText("Meta unavailable")).toBeDefined()
  })
})
