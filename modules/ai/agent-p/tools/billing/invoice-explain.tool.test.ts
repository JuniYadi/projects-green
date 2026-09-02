import { beforeEach, describe, expect, it, mock } from "bun:test"
import { invoiceExplainTool } from "./invoice-explain.tool"
import type { AgentPContext } from "../../types"

const mockPrisma = {
  billingInvoice: {
    findFirst: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("invoiceExplainTool", () => {
  beforeEach(() => {
    mockPrisma.billingInvoice.findFirst.mockReset()
  })

  it("has valid tool metadata", () => {
    expect(invoiceExplainTool.name).toBe("billing.invoice_explain")
  })

  it("explains an invoice with line items", async () => {
    mockPrisma.billingInvoice.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      invoiceNumber: "INV-2026-001",
      status: "PAID",
      currency: "IDR",
      subtotalAmount: 100000,
      taxAmount: 11000,
      discountAmount: 5000,
      totalAmount: 106000,
      lines: [{ id: "line-1" }, { id: "line-2" }],
    })

    const result = await invoiceExplainTool.execute(
      { invoiceId: "inv-1" },
      context
    )
    expect(result).toEqual({
      invoiceId: "inv-1",
      invoiceNumber: "INV-2026-001",
      status: "PAID",
      currency: "IDR",
      subtotal: 100000,
      tax: 11000,
      discount: 5000,
      total: 106000,
      lineCount: 2,
      explanation:
        "Invoice INV-2026-001 totals 106000 IDR across 2 line item(s).",
    })
  })

  it("throws when invoice is not found or not in org", async () => {
    mockPrisma.billingInvoice.findFirst.mockResolvedValueOnce(null)
    await expect(
      invoiceExplainTool.execute({ invoiceId: "inv-missing" }, context)
    ).rejects.toThrow("INVOICE_NOT_FOUND")
  })
})
