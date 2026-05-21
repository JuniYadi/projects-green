import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import ApplicationsPage from "@/app/[lang]/console/app/page"

describe("ApplicationsPage", () => {
  it("renders application lifecycle entry cards", async () => {
    const ui = await ApplicationsPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(
      view.getByRole("heading", { name: "Applications" })
    ).toBeInTheDocument()
    expect(view.getByText("Deploy")).toBeInTheDocument()
    expect(view.getByText("Manage")).toBeInTheDocument()
    expect(view.getByText("Monitoring")).toBeInTheDocument()

    const links = view.getAllByRole("link", { name: "Open" })
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/en/console/app/deploy",
      "/en/console/app/manage",
      "/en/console/app/monitoring",
    ])
  })
})
