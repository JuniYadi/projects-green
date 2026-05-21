import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import InvoicesPage from "@/app/[lang]/console/invoices/page"

describe("InvoicesPage", () => {
  it("renders invoice table tools and shared foundation preview", async () => {
    const ui = await InvoicesPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(view.getByRole("heading", { name: "Invoices" })).toBeInTheDocument()
    expect(view.getByText("Billing History")).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Invoice ID" })).toBeInTheDocument()
    expect(view.getByLabelText("Filter by Invoice ID...")).toBeInTheDocument()
    expect(view.getAllByText("INV-2026-0041").length).toBeGreaterThan(0)
    expect(view.getByRole("link", { name: "INV-2026-0041" })).toHaveAttribute(
      "href",
      "/en/console/invoices/invoice_41"
    )
    expect(view.getByText("$149.00")).toBeInTheDocument()
    expect(view.getAllByText("Pending").length).toBeGreaterThan(0)
    expect(view.getByText("Invoice Screen Foundation Preview")).toBeTruthy()
    expect(
      view.getByText(
        "Shared screen-state preview for upcoming invoice surfaces."
      )
    ).toBeTruthy()
  })
})
