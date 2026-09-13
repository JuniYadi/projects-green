import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  $transaction: mock(),
  billingAccount: {
    findUnique: mock(),
  },
  billingInvoice: {
    update: mock(),
  },
  paymentAuditLog: {
    findFirst: mock(),
    create: mock(),
  },
}

const mockCreditBalance = mock()
class MockBillingTransactionService {
  creditBalance = mockCreditBalance
}

const mockSettleProductOrders = mock(async () => {})
const mockEmitBillingAudit = mock(() => {})

const mockDefaultRepo = {
  listByOrganization: mock<(...args: unknown[]) => Promise<unknown[]>>(
    async () => []
  ),
  findByIdForOrganization: mock<(...args: unknown[]) => Promise<unknown>>(
    async () => null
  ),
  updateStatusByIdForOrganization: mock<
    (...args: unknown[]) => Promise<unknown>
  >(async () => undefined),
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/modules/billing/billing-transaction.service", () => ({
  BillingTransactionService: MockBillingTransactionService,
}))
mock.module("@/modules/billing/orders/payment-settlement", () => ({
  settleProductOrdersForInvoice: mockSettleProductOrders,
}))
mock.module("@/modules/billing/audit/audit.service", () => ({
  emitBillingAudit: mockEmitBillingAudit,
}))
mock.module("@/modules/invoices/invoices.repository", () => ({
  createPrismaInvoiceRepository: () => mockDefaultRepo,
}))

import type { InvoiceDetailRecord } from "@/modules/invoices/invoices.repository"

import {
  createInvoiceService,
  InvoiceCancelNotAllowedError,
  InvoiceNotFoundError,
  toInvoiceDetail,
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
  beforeEach(() => {
    mockPrisma.$transaction.mockReset()
    mockPrisma.billingAccount.findUnique.mockReset()
    mockPrisma.billingInvoice.update.mockReset()
    mockPrisma.paymentAuditLog.findFirst.mockReset()
    mockPrisma.paymentAuditLog.create.mockReset()
    mockCreditBalance.mockReset()
    mockSettleProductOrders.mockReset()
    mockEmitBillingAudit.mockReset()
    mockDefaultRepo.listByOrganization.mockReset()
    mockDefaultRepo.findByIdForOrganization.mockReset()
    mockDefaultRepo.updateStatusByIdForOrganization.mockReset()

    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => unknown) => {
        return cb(mockPrisma)
      }
    )
    mockCreditBalance.mockResolvedValue({ alreadyProcessed: false })
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba_1",
      organizationId: "org_1",
    })
    mockPrisma.paymentAuditLog.findFirst.mockResolvedValue(null)
    mockPrisma.billingInvoice.update.mockResolvedValue({ id: "inv_1" })
    mockPrisma.paymentAuditLog.create.mockResolvedValue({ id: "pal_1" })
  })
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
    expect(toInvoiceStatus("ISSUED")).toBe("open")
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
  it("forwards organization and query and preserves an empty result", async () => {
    const calls: Array<{ organizationId?: string | null; query: unknown }> = []
    const service = createInvoiceService({
      repository: {
        listByOrganization: async (input) => {
          calls.push(input)
          return []
        },
        findByIdForOrganization: async () => null,
        updateStatusByIdForOrganization: async () => undefined,
      },
    })
    const query = { status: "paid" as const, page: 2, pageSize: 25 }
    await expect(
      service.listInvoices({ organizationId: "org_9", query })
    ).resolves.toEqual([])
    expect(calls).toEqual([{ organizationId: "org_9", query }])
  })

  describe("markInvoiceAsPaid", () => {
    it("successfully marks open invoice as paid and triggers settlements and audits", async () => {
      let currentStatus: "OPEN" | "PAID" = "OPEN"
      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => ({
            ...detailRecord,
            status: currentStatus,
            paidAt:
              currentStatus === "PAID"
                ? new Date("2026-05-18T00:00:00.000Z")
                : null,
          }),
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      // Simulate status change on re-fetch
      mockPrisma.billingInvoice.update.mockImplementation(async () => {
        currentStatus = "PAID"
        return { id: "inv_1" }
      })

      const result = await service.markInvoiceAsPaid({
        organizationId: "org_1",
        invoiceId: "inv_1",
        adminUserId: "admin_1",
        paymentMethod: "BANK_TRANSFER",
        referenceNumber: "REF-12345",
        notes: "Approved by manager",
      })

      expect(result.status).toBe("paid")
      expect(mockPrisma.paymentAuditLog.findFirst).toHaveBeenCalledWith({
        where: {
          action: "MANUAL_MARK_PAID",
          entityType: "Invoice",
          entityId: "inv_1",
        },
      })
      expect(mockCreditBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          source: "TOPUP",
          idempotencyKey: "manual:mark-paid:inv_1",
          invoiceId: "inv_1",
        })
      )
      expect(mockPrisma.billingInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv_1" },
          data: expect.objectContaining({ status: "PAID" }),
        })
      )
      expect(mockPrisma.paymentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "MANUAL_MARK_PAID",
            actorId: "admin_1",
          }),
        })
      )
      expect(mockSettleProductOrders).toHaveBeenCalledWith("inv_1")
      expect(mockEmitBillingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: "inv_1",
          action: "PAYMENT_CONFIRMED",
          actorId: "admin_1",
        })
      )
    })

    it("throws InvoiceNotFoundError when invoice does not exist", async () => {
      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => null,
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      await expect(
        service.markInvoiceAsPaid({
          organizationId: "org_1",
          invoiceId: "nonexistent",
          adminUserId: "admin_1",
        })
      ).rejects.toBeInstanceOf(InvoiceNotFoundError)
    })

    it("throws error when invoice is not in open status", async () => {
      const draftRecord = { ...detailRecord, status: "DRAFT" as const }
      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => draftRecord,
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      await expect(
        service.markInvoiceAsPaid({
          organizationId: "org_1",
          invoiceId: "inv_1",
          adminUserId: "admin_1",
        })
      ).rejects.toThrow("cannot be marked as paid from status draft")
    })

    it("throws INVOICE_ALREADY_MARKED_PAID when payment audit log already exists", async () => {
      mockPrisma.paymentAuditLog.findFirst.mockResolvedValueOnce({
        id: "existing_log",
      })

      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => detailRecord,
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      await expect(
        service.markInvoiceAsPaid({
          organizationId: "org_1",
          invoiceId: "inv_1",
          adminUserId: "admin_1",
        })
      ).rejects.toThrow("INVOICE_ALREADY_MARKED_PAID")
    })

    it("throws BILLING_ACCOUNT_NOT_FOUND when billing account has no organizationId", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValueOnce(null)

      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => detailRecord,
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      await expect(
        service.markInvoiceAsPaid({
          organizationId: "org_1",
          invoiceId: "inv_1",
          adminUserId: "admin_1",
        })
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")
    })

    it("throws INVOICE_ALREADY_MARKED_PAID when credit balance indicates already processed", async () => {
      mockCreditBalance.mockResolvedValueOnce({ alreadyProcessed: true })

      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => detailRecord,
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      await expect(
        service.markInvoiceAsPaid({
          organizationId: "org_1",
          invoiceId: "inv_1",
          adminUserId: "admin_1",
        })
      ).rejects.toThrow("INVOICE_ALREADY_MARKED_PAID")
    })

    it("throws InvoiceNotFoundError when re-fetch after transaction returns null", async () => {
      let callCount = 0
      const service = createInvoiceService({
        repository: {
          listByOrganization: async () => [],
          findByIdForOrganization: async () => {
            callCount++
            if (callCount === 1) return detailRecord
            return null
          },
          updateStatusByIdForOrganization: async () => undefined,
        },
      })

      await expect(
        service.markInvoiceAsPaid({
          organizationId: "org_1",
          invoiceId: "inv_1",
          adminUserId: "admin_1",
        })
      ).rejects.toBeInstanceOf(InvoiceNotFoundError)
    })
  })

  describe("toInvoiceDetail with orders", () => {
    it("maps orders with lines and without lines correctly", () => {
      const recordWithOrders = {
        ...detailRecord,
        orders: [
          {
            id: "ord_1",
            status: "PAID",
            billingInvoiceId: "inv_1",
            billingInvoice: { status: "PAID" },
            lines: [
              {
                pricingId: "pr_1",
                packageCode: "VPN_PRO",
                planCode: "ANNUAL",
                billingPeriod: "ANNUAL",
                unitPrice: 120,
                quantity: 1,
                currency: "USD",
                periodStart: new Date("2026-01-01T00:00:00Z"),
                periodEnd: new Date("2027-01-01T00:00:00Z"),
              },
            ],
          },
          {
            id: "ord_2",
            status: "PENDING",
            billingInvoiceId: null,
            billingInvoice: null,
            lines: [],
          },
        ],
      }

      const detail = toInvoiceDetail(
        recordWithOrders as unknown as InvoiceDetailRecord
      )
      expect(detail.orders).toBeDefined()
      expect(detail.orders).toHaveLength(2)
      expect(detail.orders?.[0]?.orderId).toBe("ord_1")
      expect(detail.orders?.[0]?.periodMonths).toBe(12)
      expect(detail.orders?.[0]?.invoiceStatus).toBe("paid")
      expect(detail.orders?.[0]?.periodPrice).toBe(120)

      expect(detail.orders?.[1]?.orderId).toBe("ord_2")
      expect(detail.orders?.[1]?.periodMonths).toBeNull()
      expect(detail.orders?.[1]?.invoiceStatus).toBe("open")
      expect(detail.orders?.[1]?.periodPrice).toBe(0)
    })
  })

  describe("createLazyDefaultRepository", () => {
    it("delegates to lazy-loaded repository methods", async () => {
      mockDefaultRepo.listByOrganization.mockResolvedValueOnce([baseInvoice])
      mockDefaultRepo.findByIdForOrganization.mockResolvedValueOnce(
        detailRecord
      )
      mockDefaultRepo.updateStatusByIdForOrganization.mockResolvedValueOnce(
        undefined
      )

      const service = createInvoiceService()

      const list = await service.listInvoices({
        organizationId: "org_1",
        query: {},
      })
      expect(list).toHaveLength(1)
      expect(mockDefaultRepo.listByOrganization).toHaveBeenCalled()

      const detail = await service.getInvoiceDetail({
        organizationId: "org_1",
        invoiceId: "inv_1",
      })
      expect(detail.invoiceNumber).toBe("INV-2026-0001")
      expect(mockDefaultRepo.findByIdForOrganization).toHaveBeenCalled()
    })
  })
})
