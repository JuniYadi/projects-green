import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { InvoiceTable } from "./invoice-table"
import type { InvoiceListItem } from "@/lib/billing-client"

const sampleInvoices: InvoiceListItem[] = [
  {
    id: "inv-001",
    invoiceNumber: "INV-2025-0001",
    status: "PAID",
    issuedAt: "2025-01-15T00:00:00.000Z",
    dueAt: "2025-02-14T00:00:00.000Z",
    periodStart: "2025-01-01T00:00:00.000Z",
    periodEnd: "2025-01-31T23:59:59.999Z",
    totalAmountIdr: "150000",
    currency: "IDR",
    lines: [],
  },
  {
    id: "inv-002",
    invoiceNumber: "INV-2025-0002",
    status: "OPEN",
    issuedAt: "2025-02-01T00:00:00.000Z",
    dueAt: "2025-03-01T00:00:00.000Z",
    periodStart: "2025-02-01T00:00:00.000Z",
    periodEnd: "2025-02-28T23:59:59.999Z",
    totalAmountIdr: "250000",
    currency: "IDR",
    lines: [],
  },
  {
    id: "inv-003",
    invoiceNumber: "INV-2025-0003",
    status: "OVERDUE",
    issuedAt: "2025-03-01T00:00:00.000Z",
    dueAt: "2025-04-01T00:00:00.000Z",
    periodStart: "2025-03-01T00:00:00.000Z",
    periodEnd: "2025-03-31T23:59:59.999Z",
    totalAmountIdr: "350000",
    currency: "IDR",
    lines: [],
  },
  {
    id: "inv-004",
    invoiceNumber: "INV-2025-0004",
    status: "CANCELLED",
    issuedAt: null,
    dueAt: null,
    periodStart: "2025-04-01T00:00:00.000Z",
    periodEnd: "2025-04-30T23:59:59.999Z",
    totalAmountIdr: "0",
    currency: "IDR",
    lines: []
  },
]

describe("InvoiceTable", () => {
  it("renders table controls and empty row when there are no invoices", () => {
    const view = render(<InvoiceTable invoices={[]} lang="en" />)

    expect(view.getByLabelText("Search invoices...")).toBeInTheDocument()
    expect(view.getByText("All status")).toBeInTheDocument()
    expect(view.getByRole("button", { name: /columns/i })).toBeInTheDocument()
    expect(view.getByText("Invoice #")).toBeInTheDocument()
    expect(view.getByText("Issued Date")).toBeInTheDocument()
    expect(view.getByText("Amount")).toBeInTheDocument()
    expect(view.getByText("Status")).toBeInTheDocument()
    expect(
      view.getByText("No invoices match your filters.")
    ).toBeInTheDocument()
  })

  it("renders invoice rows with data", () => {
    const view = render(<InvoiceTable invoices={sampleInvoices} lang="en" />)

    expect(view.getByText("Paid")).toBeInTheDocument()
    expect(view.getByText("Open")).toBeInTheDocument()
    expect(view.getByText("Overdue")).toBeInTheDocument()
    expect(view.getByText("Cancelled")).toBeInTheDocument()
  })

  it("renders invoice number as a link with correct href", () => {
    const view = render(<InvoiceTable invoices={sampleInvoices} lang="en" />)

    const link = view.getByRole("link", { name: "INV-2025-0001" })
    expect(link).toHaveAttribute(
      "href",
      "/en/console/billing/invoices/inv-001"
    )
  })

  it("renders formatted currency amounts", () => {
    const view = render(<InvoiceTable invoices={sampleInvoices} lang="en" />)

    // Amount column renders formatted IDR currency
    expect(view.getByText(/150/)).toBeInTheDocument()
    expect(view.getByText(/250/)).toBeInTheDocument()
    expect(view.getByText(/350/)).toBeInTheDocument()
  })

  it("shows N/A for invoices with null dates", () => {
    const view = render(<InvoiceTable invoices={sampleInvoices} lang="en" />)

    // The cancelled invoice (index 3) has null issuedAt/dueAt, so shows N/A
    const naElements = view.getAllByText("N/A")
    expect(naElements.length).toBeGreaterThanOrEqual(1)
  })

  it("renders custom empty message", () => {
    const view = render(
      <InvoiceTable
        invoices={[]}
        lang="en"
        emptyMessage="Custom empty message"
      />
    )

    expect(view.getByText("Custom empty message")).toBeInTheDocument()
  })
})
