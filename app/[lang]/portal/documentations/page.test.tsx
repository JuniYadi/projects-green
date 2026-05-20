import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import PortalDocumentationsPage from "@/app/[lang]/portal/documentations/page"

describe("PortalDocumentationsPage", () => {
  it("keeps documentation scope and links tenant management to console", async () => {
    const ui = await PortalDocumentationsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(view.getByText("Documentation Registry")).toBeTruthy()
    expect(
      view.getByRole("link", { name: "Open Console Organization Admin" })
        .getAttribute("href")
    ).toBe("/en/console/organization")
    expect(view.queryByText("Effective role:")).toBeNull()
  })
})
