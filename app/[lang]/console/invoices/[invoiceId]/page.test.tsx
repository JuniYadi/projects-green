import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import InvoiceDetailPage from "@/app/[lang]/console/invoices/[invoiceId]/page"

describe("InvoiceDetailPage", () => {
  it("renders invoice detail sections from mocked state", async () => {
    const ui = await InvoiceDetailPage({
      params: Promise.resolve({ lang: "en", invoiceId: "invoice_41" }),
      searchParams: Promise.resolve({}),
    })
    const view = render(ui)

    expect(
      view.getByRole("heading", {
        name: "Invoice Detail",
      })
    ).toBeInTheDocument()
    expect(
      view.getByRole("link", { name: "Back to Invoices" })
    ).toHaveAttribute("href", "/en/console/invoices")
    expect(view.getByText("Action Placeholders")).toBeInTheDocument()
    expect(view.getByText("Identity")).toBeInTheDocument()
    expect(view.getByText("Line Items Summary")).toBeInTheDocument()
    expect(view.getByText("Totals")).toBeInTheDocument()
    expect(view.getByText("Due & Payment Status")).toBeInTheDocument()
    expect(view.getByText("Metadata")).toBeInTheDocument()
    expect(view.getAllByText("INV-2026-0041").length).toBeGreaterThan(0)
    expect(view.getAllByText("Pending").length).toBeGreaterThan(0)
  })

  it("defaults to empty scenario for unknown invoice ids", async () => {
    const ui = await InvoiceDetailPage({
      params: Promise.resolve({ lang: "en", invoiceId: "invoice_unknown" }),
      searchParams: Promise.resolve({}),
    })
    const view = render(ui)

    expect(
      view.getAllByText(
        /Invoice "invoice_unknown" is not available in mocked records\./
      ).length
    ).toBeGreaterThan(0)
  })

  it("accepts scenario override from query params", async () => {
    const ui = await InvoiceDetailPage({
      params: Promise.resolve({ lang: "en", invoiceId: "invoice_41" }),
      searchParams: Promise.resolve({ scenario: "loading" }),
    })
    const view = render(ui)

    expect(
      view.getByText("Preparing detailed invoice summary.")
    ).toBeInTheDocument()
  })
})
