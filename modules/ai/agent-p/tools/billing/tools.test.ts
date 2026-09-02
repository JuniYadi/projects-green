import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const prismaMock = {
  billingRatedUsage: { findMany: mock() },
  billingInvoice: { findFirst: mock() },
}
mock.module("@/lib/prisma", () => ({ prisma: prismaMock }))

import { billingBurnRateTool } from "./billing-burn-rate.tool"
import { invoiceExplainTool } from "./invoice-explain.tool"
import type { AgentPContext } from "../../types"

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("Billing Agent P tools", () => {
  beforeEach(() => {
    prismaMock.billingRatedUsage.findMany.mockReset()
    prismaMock.billingInvoice.findFirst.mockReset()
  })

  it("calculates burn rate from scoped rated usage", async () => {
    prismaMock.billingRatedUsage.findMany.mockResolvedValueOnce([
      { amount: "12.50", currency: "USD" },
      { amount: 7.5, currency: "USD" },
    ])

    await expect(
      billingBurnRateTool.execute({ days: 10 }, context)
    ).resolves.toEqual({
      days: 10,
      total: 20,
      averagePerDay: 2,
      currency: "USD",
    })
    expect(prismaMock.billingRatedUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          billingAccount: { organizationId: "org-1" },
        }),
        select: { amount: true, currency: true },
      })
    )
  })

  it("defaults burn rate currency when usage is empty", async () => {
    prismaMock.billingRatedUsage.findMany.mockResolvedValueOnce([])
    await expect(
      billingBurnRateTool.execute({ days: 30 }, context)
    ).resolves.toEqual({
      days: 30,
      total: 0,
      averagePerDay: 0,
      currency: "USD",
    })
  })

  it("explains a scoped invoice and counts its lines", async () => {
    prismaMock.billingInvoice.findFirst.mockResolvedValueOnce({
      id: "invoice-1",
      invoiceNumber: "INV-001",
      status: "PAID",
      currency: "USD",
      subtotalAmount: "100",
      taxAmount: "10",
      discountAmount: "5",
      totalAmount: "105",
      lines: [{ id: "line-1" }, { id: "line-2" }],
    })

    await expect(
      invoiceExplainTool.execute({ invoiceId: "invoice-1" }, context)
    ).resolves.toEqual({
      invoiceId: "invoice-1",
      invoiceNumber: "INV-001",
      status: "PAID",
      currency: "USD",
      subtotal: 100,
      tax: 10,
      discount: 5,
      total: 105,
      lineCount: 2,
      explanation: "Invoice INV-001 totals 105 USD across 2 line item(s).",
    })
    expect(prismaMock.billingInvoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invoice-1", billingAccount: { organizationId: "org-1" } },
      })
    )
  })

  it("rejects an invoice that is not visible to the organization", async () => {
    prismaMock.billingInvoice.findFirst.mockResolvedValueOnce(null)
    await expect(
      invoiceExplainTool.execute({ invoiceId: "missing" }, context)
    ).rejects.toThrow("INVOICE_NOT_FOUND")
  })
})
