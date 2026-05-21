import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import InvoicesPage from "@/app/[lang]/console/invoices/page"

describe("InvoicesPage", () => {
  it("renders invoice table tools and records", async () => {
    const ui = await InvoicesPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(view.getByRole("heading", { name: "Invoices" })).toBeInTheDocument()
    expect(view.getByText("Billing History")).toBeInTheDocument()
    expect(view.getByRole("button", { name: "Invoice ID" })).toBeInTheDocument()
    expect(view.getByLabelText("Filter by Invoice ID...")).toBeInTheDocument()
    expect(view.getByText("INV-2026-0041")).toBeInTheDocument()
    expect(view.getByText("$149.00")).toBeInTheDocument()
    expect(view.getByText("Pending")).toBeInTheDocument()
  })
})
