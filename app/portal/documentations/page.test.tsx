import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import PortalDocumentationsPage from "@/app/portal/documentations/page"

describe("PortalDocumentationsPage", () => {
  it("keeps documentation scope and links tenant management to console", () => {
    const view = render(<PortalDocumentationsPage />)

    expect(view.getByText("Documentation Registry")).toBeTruthy()
    expect(
      view.getByRole("link", { name: "Open Console Organization Admin" })
        .getAttribute("href")
    ).toBe("/console/organization")
    expect(view.queryByText("Effective role:")).toBeNull()
  })
})
