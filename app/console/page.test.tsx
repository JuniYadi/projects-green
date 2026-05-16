import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import ConsolePage from "@/app/console/page"

describe("ConsolePage", () => {
  it("renders workspace entry cards for tenant admin, docs, and deploy", () => {
    const view = render(<ConsolePage />)

    expect(view.getByRole("heading", { name: "Console" })).toBeTruthy()
    expect(view.getByText("Tenant Management")).toBeTruthy()
    expect(view.getByText("Documentation Registry")).toBeTruthy()
    expect(view.getByText("Deployments")).toBeTruthy()

    const links = view.getAllByRole("link", { name: "Open" })
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/console/organization",
      "/portal/documentations",
      "/console/app/deploy",
    ])
  })
})
