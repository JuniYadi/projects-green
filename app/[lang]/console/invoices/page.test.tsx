import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import InvoicesPage from "@/app/[lang]/console/invoices/page"

describe("InvoicesPage", () => {
  it("renders invoice table tools and records", async () => {
    const ui = await InvoicesPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(view.getByRole("heading", { name: "Invoices" })).toBeTruthy()
    expect(view.getByText("Billing History")).toBeTruthy()
    expect(view.getByRole("button", { name: "Invoice ID" })).toBeTruthy()
    expect(view.getByLabelText("Filter by Invoice ID...")).toBeTruthy()
    expect(view.getByText("INV-2026-0041")).toBeTruthy()
    expect(view.getByText("$149.00")).toBeTruthy()
    expect(view.getByText("Pending")).toBeTruthy()
  })
})
