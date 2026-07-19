import { describe, expect, it } from "bun:test"

import { buildInvoicePdfBytes } from "@/modules/invoices/invoice-pdf"
import type { InvoiceDetail } from "@/modules/invoices/invoices.types"

const invoice: InvoiceDetail = {
  id: "inv_1",
  invoiceNumber: "INV-2026-0001",
  issuedAt: "2026-05-02T00:00:00.000Z",
  dueAt: "2026-05-17T00:00:00.000Z",
  totalAmount: 110,
  currency: "USD",
  status: "open",
  subtotalAmount: 100,
  taxAmount: 10,
  discountAmount: 0,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.000Z",
  paidAt: null,
  type: null,
  paymentMethod: null,
  lineItems: [
    {
      id: "line_1",
      description: "Pro Plan",
      quantity: 1,
      unitPrice: 100,
      amount: 100,
      currency: "USD",
    },
  ],
}

describe("invoice PDF", () => {
  it("generates non-empty PDF bytes with expected header", () => {
    const bytes = buildInvoicePdfBytes(invoice)
    const text = new TextDecoder().decode(bytes)

    expect(text.includes("INV-2026-0001")).toBe(true)
    expect(text.includes("INVOICE")).toBe(true)
    expect(text.includes("LINE ITEMS")).toBe(true)
    expect(text.includes("Open")).toBe(true)
    expect(text.includes("Subtotal:")).toBe(true)
    expect(text.includes("Total:")).toBe(true)
    expect(text.includes("Payment Method:")).toBe(true)
  })
})
