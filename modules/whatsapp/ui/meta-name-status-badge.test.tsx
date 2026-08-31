import "@/test/register"
import { afterEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

let currentLocale = "en"
mock.module("next/navigation", () => ({
  useParams: () => ({ lang: currentLocale }),
}))

import { MetaNameStatusBadge } from "./meta-name-status-badge"
describe("MetaNameStatusBadge", () => {
  afterEach(() => {
    currentLocale = "en"
  })

  it("renders approved badge correctly", () => {
    const view = render(<MetaNameStatusBadge nameStatus="APPROVED" />)
    expect(view.getByText("Approved")).toBeInTheDocument()
  })

  it("renders with verified name when showName is true", () => {
    const view = render(
      <MetaNameStatusBadge
        nameStatus="APPROVED"
        verifiedName="Acme Corp"
        showName
      />
    )
    expect(view.getByText("Acme Corp")).toBeInTheDocument()
    expect(view.getByText("Approved")).toBeInTheDocument()
  })

  it("handles unavailable sync state", () => {
    const view = render(
      <MetaNameStatusBadge
        nameStatus="APPROVED"
        profile={{ meta_name_status_sync_state: "UNAVAILABLE" }}
      />
    )
    expect(view.getByText("Meta unavailable")).toBeInTheDocument()
  })

  it("renders Indonesian translation when locale is id", () => {
    currentLocale = "id"
    const view = render(
      <MetaNameStatusBadge
        nameStatus="APPROVED"
        profile={{ meta_name_status_sync_state: "UNAVAILABLE" }}
      />
    )
    expect(view.getByText("Meta tidak tersedia")).toBeInTheDocument()
  })
})
