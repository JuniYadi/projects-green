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
  it("generates a valid PDF buffer", async () => {
    const buffer = await buildInvoicePdfBytes(invoice)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.byteLength).toBeGreaterThan(200)
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  })

  it("generates valid PDF with bank accounts for MANUAL_BANK", async () => {
    const manualBankInvoice: InvoiceDetail = {
      ...invoice,
      paymentMethod: "MANUAL_BANK",
    }
    const bankAccounts = [
      {
        bankName: "Bank Central Asia",
        bankCode: "BCA",
        accountName: "PFNApp Technologies",
        accountNumber: "1234567890",
        swiftCode: null,
      },
    ]
    const buffer = await buildInvoicePdfBytes(
      manualBankInvoice,
      null,
      bankAccounts
    )
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.byteLength).toBeGreaterThan(200)
  })

  it("generates valid PDF for each status ribbon", async () => {
    const statuses = ["open", "paid", "canceled", "draft"] as const
    for (const status of statuses) {
      const statusInvoice: InvoiceDetail = { ...invoice, status }
      const buffer = await buildInvoicePdfBytes(statusInvoice)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.byteLength).toBeGreaterThan(200)
    }
  })
})
