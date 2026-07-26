import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { InvoiceFlatLine, InvoiceGroupedLines } from "./invoice-grouped-lines"
import type { InvoiceLineItem } from "@/lib/billing-client"

const line = (overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem => ({
  description: "VPN Server",
  quantity: "1.00",
  unitPriceIdr: "25.00",
  amountIdr: "25.00",
  currency: "USD",
  category: "vpn",
  metadata: {},
  ...overrides,
})

describe("InvoiceGroupedLines", () => {
  it("InvoiceFlatLine renders line currency and amount", () => {
    const view = render(
      <InvoiceFlatLine
        currency="USD"
        lines={[
          {
            description: "Top-up",
            quantity: "2.00",
            unitPriceIdr: "6.25",
            amountIdr: "12.50",
            currency: "USD",
          },
        ]}
      />
    )

    expect(view.getByText("Description")).toBeInTheDocument()
    expect(view.getByText("Qty")).toBeInTheDocument()
    expect(view.getByText("Amount")).toBeInTheDocument()
    expect(view.getByText("Top-up")).toBeInTheDocument()
    expect(view.getByText("2")).toBeInTheDocument()
    expect(view.getByText("$12.50")).toBeInTheDocument()
  })

  it("InvoiceFlatLine falls back to parent currency and zero for invalid amounts", () => {
    const view = render(
      <InvoiceFlatLine
        currency="USD"
        lines={[
          {
            description: "Broken amount",
            quantity: "1.00",
            unitPriceIdr: "0.00",
            amountIdr: "not-a-number",
            currency: "",
          },
        ]}
      />
    )

    expect(view.getByText("$0.00")).toBeInTheDocument()
  })

  it("InvoiceGroupedLines groups by category and formats subtotal in invoice currency", () => {
    const view = render(
      <InvoiceGroupedLines
        currency="USD"
        periodLabel="May 2026"
        lines={[
          line({
            amountIdr: "80.00",
            metadata: { servers: ["vpn-1", "vpn-2"] },
          }),
          line({ amountIdr: "20.00" }),
        ]}
      />
    )

    expect(view.getByText("May 2026")).toBeInTheDocument()
    expect(view.getByText("VPN")).toBeInTheDocument()
    expect(view.getByText("(2)")).toBeInTheDocument()
    expect(view.getByText("$100.00")).toBeInTheDocument()
    expect(view.getByText(/vpn-1, vpn-2/)).toBeInTheDocument()
    expect(view.getByText("$80.00")).toBeInTheDocument()
    expect(view.getByText("$20.00")).toBeInTheDocument()
  })

  it("InvoiceGroupedLines falls back unknown categories to Other", () => {
    const view = render(
      <InvoiceGroupedLines
        currency="USD"
        lines={[
          line({
            description: "Misc",
            category: "custom",
            amountIdr: "15.00",
            metadata: { appName: "Green App" },
          }),
        ]}
      />
    )

    expect(view.getByText("Other")).toBeInTheDocument()
    expect(view.getByText(/Green App/)).toBeInTheDocument()
    expect(view.getAllByText("$15.00").length).toBeGreaterThan(0)
  })
})
