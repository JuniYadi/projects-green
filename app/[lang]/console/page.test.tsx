import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import ConsolePage from "@/app/[lang]/console/page"

describe("ConsolePage", () => {
  it("renders workspace entry cards for tenant admin, docs, and deploy", async () => {
    const ui = await ConsolePage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(view.getByRole("heading", { name: "Console" })).toBeTruthy()
    expect(view.getByText("Tenant Management")).toBeTruthy()
    expect(view.getByText("Documentation Registry")).toBeTruthy()
    expect(view.getByText("Deployments")).toBeTruthy()

    const links = view.getAllByRole("link", { name: "Open" })
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/en/console/organization",
      "/en/portal/documentations",
      "/en/console/app/deploy",
    ])
  })
})
