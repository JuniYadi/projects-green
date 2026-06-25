import { describe, expect, it } from "bun:test"

import {
  createInvoiceService,
  InvoiceCancelNotAllowedError,
  InvoiceNotFoundError,
  toInvoiceStatus,
} from "@/modules/invoices/invoices.service"

const baseInvoice = {
  id: "inv_1",
  billingAccountId: "ba_1",
  subscriptionId: null,
  billingRunId: null,
  invoiceNumber: "INV-2026-0001",
  periodStart: new Date("2026-05-01T00:00:00.000Z"),
  periodEnd: new Date("2026-05-31T23:59:59.000Z"),
  currency: "USD",
  status: "OPEN" as const,
  subtotalAmount: 100,
  taxAmount: 10,
  discountAmount: 0,
  totalAmount: 110,
  issuedAt: new Date("2026-05-02T00:00:00.000Z"),
  dueAt: new Date("2026-05-17T00:00:00.000Z"),
  paidAt: null,
  type: null,
  paymentMethod: null,
  gatewayId: null,
  metadataJson: null,
  metadata: null,
  createdAt: new Date("2026-05-02T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
}

const detailRecord = {
  ...baseInvoice,
  gateway: null,
  paymentConfirmations: [],
  lines: [
    {
      id: "line_1",
      invoiceId: "inv_1",
      lineType: "SUBSCRIPTION" as const,
      description: "Pro plan",
      quantity: 1,
      unitPrice: 100,
      amount: 100,
      currency: "USD",
      periodStart: null,
      periodEnd: null,
      metadataJson: null,
      createdAt: new Date("2026-05-02T00:00:00.000Z"),
      updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    },
  ],
}

describe("invoice service", () => {
  it("maps list and detail records to UI contracts", async () => {
    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [baseInvoice],
        findByIdForOrganization: async () => detailRecord,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const list = await service.listInvoices({
      organizationId: "org_1",
      query: {},
    })

    expect(list).toEqual([
      {
        id: "inv_1",
        invoiceNumber: "INV-2026-0001",
        issuedAt: "2026-05-02T00:00:00.000Z",
        dueAt: "2026-05-17T00:00:00.000Z",
        totalAmount: 110,
        currency: "USD",
        status: "open",
      },
    ])

    const detail = await service.getInvoiceDetail({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(detail.invoiceNumber).toBe("INV-2026-0001")
    expect(detail.status).toBe("open")
    expect(detail.lineItems[0]?.description).toBe("Pro plan")
  })

  it("rejects cancellation for paid and canceled invoices", async () => {
    const paidRecord = {
      ...detailRecord,
      status: "PAID" as const,
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => paidRecord,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    await expect(
      service.cancelInvoice({ organizationId: "org_1", invoiceId: "inv_1" })
    ).rejects.toBeInstanceOf(InvoiceCancelNotAllowedError)
  })

  it("throws not found when invoice does not exist", async () => {
    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => null,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    await expect(
      service.getInvoiceDetail({
        organizationId: "org_1",
        invoiceId: "missing",
      })
    ).rejects.toBeInstanceOf(InvoiceNotFoundError)
  })

  it("maps all Prisma status values to app status", () => {
    expect(toInvoiceStatus("DRAFT")).toBe("draft")
    expect(toInvoiceStatus("OPEN")).toBe("open")
    expect(toInvoiceStatus("PAID")).toBe("paid")
    expect(toInvoiceStatus("VOID")).toBe("canceled")
    expect(toInvoiceStatus("UNCOLLECTIBLE")).toBe("uncollectible")
  })

  it("returns payment method options", () => {
    const service = createInvoiceService({})
    const options = service.getPaymentMethodOptions()

    expect(options).toHaveLength(2)
    expect(options[0]?.type).toBe("card")
    expect(options[1]?.type).toBe("bank_transfer")
  })

  it("handles null and undefined in list response", async () => {
    const nullDatesRecord = {
      id: "inv_null",
      billingAccountId: "ba_1",
      subscriptionId: null,
      billingRunId: null,
      invoiceNumber: "INV-NULL",
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-31T23:59:59.000Z"),
      currency: "USD",
      status: "OPEN" as const,
      subtotalAmount: 100,
      taxAmount: 10,
      discountAmount: 0,
      totalAmount: null as unknown as number,
      issuedAt: null,
      dueAt: null,
      paidAt: null,
      type: null,
      paymentMethod: null,
      gatewayId: null,
      metadataJson: null,
      metadata: null,
      createdAt: new Date("2026-05-02T00:00:00.000Z"),
      updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [nullDatesRecord],
        findByIdForOrganization: async () => null,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const list = await service.listInvoices({
      organizationId: "org_1",
      query: {},
    })

    expect(list[0]?.issuedAt).toBe(nullDatesRecord.createdAt.toISOString())
    expect(list[0]?.dueAt).toBeNull()
    expect(list[0]?.totalAmount).toBe(0)
  })

  it("handles detail line item with fallback description", async () => {
    const detailWithEmptyLine = {
      ...detailRecord,
      lines: [
        {
          id: "line_empty",
          invoiceId: "inv_1",
          lineType: "METERED" as const,
          description: "   ",
          quantity: null,
          unitPrice: undefined,
          amount: null,
          currency: "USD",
          periodStart: null,
          periodEnd: null,
          metadataJson: null,
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          updatedAt: new Date("2026-05-02T00:00:00.000Z"),
        },
      ],
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => detailWithEmptyLine,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const detail = await service.getInvoiceDetail({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(detail.lineItems[0]?.description).toBe("Metered usage")
    expect(detail.lineItems[0]?.quantity).toBe(0)
    expect(detail.lineItems[0]?.unitPrice).toBe(0)
    expect(detail.lineItems[0]?.amount).toBe(0)
  })

  it("uses fallback description for all line types when trimmed description is empty", async () => {
    const allLines = [
      { lineType: "SUBSCRIPTION" as const, expected: "Subscription charge" },
      { lineType: "METERED" as const, expected: "Metered usage" },
      { lineType: "ADJUSTMENT" as const, expected: "Adjustment" },
      { lineType: "TAX" as const, expected: "Tax" },
      { lineType: "CREDIT" as const, expected: "Credit" },
    ]

    for (const { lineType, expected } of allLines) {
      const record = {
        ...detailRecord,
        lines: [
          {
            id: `line_${lineType}`,
            invoiceId: "inv_1",
            lineType,
            description: "",
            quantity: 1,
            unitPrice: 10,
            amount: 10,
            currency: "USD",
            periodStart: null,
            periodEnd: null,
            metadataJson: null,
            createdAt: new Date("2026-05-02T00:00:00.000Z"),
            updatedAt: new Date("2026-05-02T00:00:00.000Z"),
          },
        ],
      }

      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => record,
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      const detail = await service.getInvoiceDetail({
        organizationId: "org_1",
        invoiceId: "inv_1",
      })

      expect(detail.lineItems[0]?.description).toBe(expected)
    }
  })

  it("cancels invoice successfully", async () => {
    let currentStatus: "OPEN" | "VOID" = "OPEN"

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => {
          const record = {
            ...detailRecord,
            status: currentStatus,
          }
          return record
        },
        updateStatusByIdForOrganization: async () => {
          currentStatus = "VOID"
        },
      },
    })

    const result = await service.cancelInvoice({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(result.status).toBe("canceled")
  })

  it("throws not found when cancel re-fetch returns null after update", async () => {
    let callCount = 0

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => {
          callCount++
          if (callCount === 1) {
            return detailRecord
          }
          return null
        },
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    await expect(
      service.cancelInvoice({ organizationId: "org_1", invoiceId: "inv_1" })
    ).rejects.toBeInstanceOf(InvoiceNotFoundError)
  })
})
