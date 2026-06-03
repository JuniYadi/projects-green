import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { InvoiceTable } from "./invoice-table"

describe("InvoiceTable", () => {
  it("renders table controls and empty row when there are no invoices", () => {
    const view = render(<InvoiceTable invoices={[]} lang="en" />)

    expect(view.getByLabelText("Search invoices...")).toBeInTheDocument()
    expect(view.getByText("All status")).toBeInTheDocument()
    expect(view.getByRole("button", { name: /columns/i })).toBeInTheDocument()
    expect(view.getByText("Invoice #")).toBeInTheDocument()
    expect(view.getByText("Period")).toBeInTheDocument()
    expect(view.getByText("Amount")).toBeInTheDocument()
    expect(view.getByText("Status")).toBeInTheDocument()
    expect(view.getByText("No invoices match your filters.")).toBeInTheDocument()
  })
})
