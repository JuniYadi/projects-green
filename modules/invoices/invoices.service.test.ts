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

  it("allows cancellation for draft invoices", async () => {
    const draftRecord = { ...detailRecord, status: "DRAFT" as const }
    let updated = false

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => {
          if (updated) return { ...draftRecord, status: "VOID" as const }
          return draftRecord
        },
        updateStatusByIdForOrganization: async () => {
          updated = true
        },
      },
    })

    const result = await service.cancelInvoice({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })
    expect(result.status).toBe("canceled")
  })

  it("throws not found when getPaymentInfo invoice does not exist", async () => {
    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => null,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    await expect(
      service.getPaymentInfo({
        organizationId: "org_1",
        invoiceId: "missing",
      })
    ).rejects.toBeInstanceOf(InvoiceNotFoundError)
  })

  it("returns payment info when invoice has payment data", async () => {
    const recordWithPayment = {
      ...detailRecord,
      paymentMethod: "MANUAL_BANK",
      gateway: null,
      paymentConfirmations: [],
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => recordWithPayment,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const payment = await service.getPaymentInfo({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(payment).not.toBeNull()
    expect(payment?.method).toBe("MANUAL_BANK")
  })

  it("returns null payment info when no payment data", async () => {
    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => detailRecord,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const payment = await service.getPaymentInfo({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(payment).toBeNull()
  })

  it("handles detail with dueDate field instead of dueAt", async () => {
    const recordWithDueDate = {
      ...detailRecord,
      dueAt: undefined as unknown as Date,
      dueDate: new Date("2026-06-15T00:00:00.000Z"),
      lines: [],
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [recordWithDueDate],
        findByIdForOrganization: async () => recordWithDueDate,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const list = await service.listInvoices({
      organizationId: "org_1",
      query: {},
    })

    expect(list[0]?.dueAt).toBe("2026-06-15T00:00:00.000Z")
  })

  it("handles detail with all line types", async () => {
    const recordWithAllLines = {
      ...detailRecord,
      lines: [
        {
          ...detailRecord.lines[0]!,
          lineType: "SUBSCRIPTION" as const,
          description: "Pro plan",
        },
        {
          ...detailRecord.lines[0]!,
          id: "line_2",
          lineType: "METERED" as const,
          description: "API calls",
        },
        {
          ...detailRecord.lines[0]!,
          id: "line_3",
          lineType: "ADJUSTMENT" as const,
          description: "Credit",
        },
        {
          ...detailRecord.lines[0]!,
          id: "line_4",
          lineType: "TAX" as const,
          description: "",
        },
        {
          ...detailRecord.lines[0]!,
          id: "line_5",
          lineType: "CREDIT" as const,
          description: "",
        },
      ],
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => recordWithAllLines,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const detail = await service.getInvoiceDetail({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(detail.lineItems).toHaveLength(5)
    expect(detail.lineItems[0]?.description).toBe("Pro plan")
    expect(detail.lineItems[1]?.description).toBe("API calls")
    expect(detail.lineItems[2]?.description).toBe("Credit")
    expect(detail.lineItems[3]?.description).toBe("Tax")
    expect(detail.lineItems[4]?.description).toBe("Credit")
  })

  it("handles detail with type and paymentMethod set", async () => {
    const recordWithExtra = {
      ...detailRecord,
      type: "SUBSCRIPTION",
      paymentMethod: "MANUAL_BANK",
      paidAt: new Date("2026-06-01T00:00:00.000Z"),
      lines: [],
    }

    const service = createInvoiceService({
      repository: {
        listByOrganization: async () => [],
        findByIdForOrganization: async () => recordWithExtra,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })

    const detail = await service.getInvoiceDetail({
      organizationId: "org_1",
      invoiceId: "inv_1",
    })

    expect(detail.type).toBe("SUBSCRIPTION")
    expect(detail.paymentMethod).toBe("MANUAL_BANK")
    expect(detail.paidAt).toBe("2026-06-01T00:00:00.000Z")
  })
})
