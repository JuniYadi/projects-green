import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

// Mock prisma
const mockPaymentAuditLog = {
  findFirst: mock<() => Promise<Record<string, unknown> | null>>(() =>
    Promise.resolve(null)
  ),
  create: mock(() => Promise.resolve({})),
}

const mockBillingInvoice = {
  findUnique: mock<() => Promise<Record<string, unknown> | null>>(() =>
    Promise.resolve({ id: "inv-123", billingAccountId: "ba-123" })
  ),
  update: mock(() => Promise.resolve({})),
}

const mockBillingAccount = {
  findUnique: mock(() =>
    Promise.resolve({ id: "ba-123", organizationId: "org-123" })
  ),
}

const mockBillingInvoicePaymentAllocation = {
  create: mock(() => Promise.resolve({})),
  update: mock(() => Promise.resolve({})),
  upsert: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
}

const prismaMock: Record<string, unknown> = {
  $queryRaw: mock(async () => []),
  paymentAuditLog: mockPaymentAuditLog,
  billingInvoice: mockBillingInvoice,
  billingAccount: mockBillingAccount,
  billingInvoicePaymentAllocation: mockBillingInvoicePaymentAllocation,
  $transaction: mock(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  ),
}

mock.module("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

// Mock DuitkuService
const mockVerifyCallback = mock(() => Promise.resolve(true))

// Route imports from "../services/duitku.service" (relative to api/)
mock.module("../services/duitku.service", () => ({
  DuitkuService: mock(() => ({
    verifyCallback: mockVerifyCallback,
  })),
}))

// Mock PaymentService
const mockCreditBalance = mock(() => Promise.resolve({}))
const mockMarkInvoiceAsPaid = mock(() => Promise.resolve({}))
const mockSendInvoicePaidEmail = mock(() => Promise.resolve({}))

mock.module("../services/payment.service", () => ({
  PaymentService: mock(() => ({
    creditBalance: mockCreditBalance,
    markInvoiceAsPaid: mockMarkInvoiceAsPaid,
    sendInvoicePaidEmail: mockSendInvoicePaidEmail,
  })),
}))

const CALLBACK_URL = "http://localhost/duitku/callback"
const DEFAULT_BODY = {
  merchantCode: "M123",
  amount: "50000",
  merchantOrderId: "inv-123",
  signature: "valid-sig",
  resultCode: "00",
  reference: "REF001",
}

async function postCallback(body: Record<string, string>) {
  const { createWebhookRoutes } = await import("./webhook.route")
  const app = new Elysia().use(createWebhookRoutes())
  return app.handle(
    new Request(CALLBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("Webhook Route - Duitku Callback", () => {
  beforeEach(() => {
    mockPaymentAuditLog.findFirst.mockReset()
    mockPaymentAuditLog.findFirst.mockResolvedValue(null)
    mockPaymentAuditLog.create.mockReset()
    mockPaymentAuditLog.create.mockResolvedValue({})
    mockBillingInvoice.findUnique.mockReset()
    mockBillingInvoice.findUnique.mockResolvedValue({
      id: "inv-123",
      billingAccountId: "ba-123",
    })
    mockBillingInvoice.update.mockReset()
    mockBillingInvoice.update.mockResolvedValue({})
    mockBillingAccount.findUnique.mockReset()
    mockBillingAccount.findUnique.mockResolvedValue({
      id: "ba-123",
      organizationId: "org-123",
    })
    mockBillingInvoicePaymentAllocation.create.mockReset()
    mockBillingInvoicePaymentAllocation.create.mockResolvedValue({})
    mockBillingInvoicePaymentAllocation.update.mockReset()
    mockBillingInvoicePaymentAllocation.update.mockResolvedValue({})
    mockBillingInvoicePaymentAllocation.upsert.mockReset()
    mockBillingInvoicePaymentAllocation.upsert.mockResolvedValue({})
    mockBillingInvoicePaymentAllocation.findMany.mockReset()
    mockBillingInvoicePaymentAllocation.findMany.mockResolvedValue([])
    mockCreditBalance.mockReset()
    mockCreditBalance.mockResolvedValue({})
    mockMarkInvoiceAsPaid.mockReset()
    mockMarkInvoiceAsPaid.mockResolvedValue({})
    mockSendInvoicePaidEmail.mockReset()
    mockSendInvoicePaidEmail.mockResolvedValue({})
    mockVerifyCallback.mockReset()
    mockVerifyCallback.mockResolvedValue(true)
  })

  it("credits balance and logs on successful callback (resultCode 00)", async () => {
    const res = await postCallback(DEFAULT_BODY)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockVerifyCallback).toHaveBeenCalledTimes(1)
    expect(mockPaymentAuditLog.findFirst).toHaveBeenCalledWith({
      where: { entityId: "inv-123:REF001", action: "DUITKU_PAYMENT_COMPLETED" },
    })
    expect(mockPaymentAuditLog.create).toHaveBeenCalledTimes(1)
    expect(mockCreditBalance).toHaveBeenCalledWith("org-123", 50000, "inv-123")
    expect(mockMarkInvoiceAsPaid).toHaveBeenCalledWith("inv-123")
    expect(mockBillingInvoicePaymentAllocation.upsert).toHaveBeenCalledWith({
      where: { idempotencyKey: "alloc:topup:inv-123:REF001" },
      update: {},
      create: expect.objectContaining({
        invoiceId: "inv-123",
        source: "GATEWAY_DUITKU",
        status: "COMPLETED",
        referenceId: "REF001",
        idempotencyKey: "alloc:topup:inv-123:REF001",
      }),
    })
    expect(mockSendInvoicePaidEmail).toHaveBeenCalledWith({}, "org-123")
  })

  it("returns 400 for invalid signature", async () => {
    mockVerifyCallback.mockResolvedValueOnce(false)

    const res = await postCallback(DEFAULT_BODY)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ ok: false, error: "INVALID_SIGNATURE" })
    expect(mockCreditBalance).not.toHaveBeenCalled()
  })

  it("skips processing on duplicate callback", async () => {
    mockPaymentAuditLog.findFirst.mockResolvedValueOnce({
      id: "log-123",
      entityId: "inv-123:REF001",
      action: "DUITKU_PAYMENT_COMPLETED",
    })

    const res = await postCallback(DEFAULT_BODY)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, message: "Already processed" })
    expect(mockCreditBalance).not.toHaveBeenCalled()
  })

  it("allows subsequent attempts for the same invoice to process when reference differs", async () => {
    mockPaymentAuditLog.findFirst.mockResolvedValueOnce(null)

    const res = await postCallback({
      ...DEFAULT_BODY,
      reference: "REF002",
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockPaymentAuditLog.findFirst).toHaveBeenCalledWith({
      where: { entityId: "inv-123:REF002", action: "DUITKU_PAYMENT_COMPLETED" },
    })
  })

  it("processes a successful attempt after a previously failed attempt for the same invoice", async () => {
    // 1. First attempt fails (resultCode "01")
    mockPaymentAuditLog.findFirst.mockResolvedValueOnce(null)
    const failedRes = await postCallback({
      ...DEFAULT_BODY,
      reference: "REF-FAILED-1",
      resultCode: "01",
    })
    expect(failedRes.status).toBe(200)
    expect(mockCreditBalance).not.toHaveBeenCalled()
    expect(mockPaymentAuditLog.findFirst).toHaveBeenCalledWith({
      where: {
        entityId: "inv-123:REF-FAILED-1",
        action: "DUITKU_PAYMENT_COMPLETED",
      },
    })
    expect(mockPaymentAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DUITKU_PAYMENT_FAILED",
        entityId: "inv-123:REF-FAILED-1",
      }),
    })

    // 2. Later attempt succeeds (resultCode "00") with new reference
    mockPaymentAuditLog.findFirst.mockResolvedValueOnce(null)
    const successRes = await postCallback({
      ...DEFAULT_BODY,
      reference: "REF-SUCCESS-2",
      resultCode: "00",
    })
    expect(successRes.status).toBe(200)
    expect(mockPaymentAuditLog.findFirst).toHaveBeenCalledWith({
      where: {
        entityId: "inv-123:REF-SUCCESS-2",
        action: "DUITKU_PAYMENT_COMPLETED",
      },
    })
    expect(mockCreditBalance).toHaveBeenCalledWith("org-123", 50000, "inv-123")
    expect(mockMarkInvoiceAsPaid).toHaveBeenCalledWith("inv-123")
  })

  it("does not complete payment when service invoice allocation processing fails", async () => {
    const serviceInvoice = {
      id: "inv-service-1",
      billingAccountId: "ba-123",
      type: "SERVICE",
      allocations: [
        {
          id: "alloc-1",
          status: "PENDING",
          amount: new Decimal(50000),
          referenceId: "REF-OTHER",
        },
      ],
    }
    mockBillingInvoice.findUnique
      .mockResolvedValueOnce(serviceInvoice)
      .mockResolvedValueOnce(serviceInvoice)

    const res = await postCallback({
      ...DEFAULT_BODY,
      merchantOrderId: "inv-service-1",
      reference: "REF-SERVICE-ERR",
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(mockCreditBalance).not.toHaveBeenCalled()

    // No completion log is written, so a gateway retry is still accepted
    expect(mockPaymentAuditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPaymentAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DUITKU_PAYMENT_FAILED",
        entityId: "inv-service-1:REF-SERVICE-ERR",
        details: expect.objectContaining({
          error: "PENDING_ALLOCATION_NOT_FOUND",
        }),
      }),
    })
  })

  it("settles a service invoice allocation and logs completion after processing", async () => {
    // The route and the allocation service each read the invoice
    const serviceInvoice = {
      id: "inv-service-2",
      invoiceNumber: "INV-SVC-2",
      billingAccountId: "ba-123",
      type: "SERVICE",
      currency: "IDR",
      totalAmount: new Decimal(50000),
      allocations: [
        {
          id: "alloc-2",
          status: "PENDING",
          source: "GATEWAY_DUITKU",
          amount: new Decimal(50000),
          referenceId: "REF-SERVICE-OK",
        },
      ],
    }
    mockBillingInvoice.findUnique
      .mockResolvedValueOnce(serviceInvoice)
      .mockResolvedValueOnce(serviceInvoice)

    const res = await postCallback({
      ...DEFAULT_BODY,
      merchantOrderId: "inv-service-2",
      reference: "REF-SERVICE-OK",
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockCreditBalance).not.toHaveBeenCalled()
    expect(mockBillingInvoicePaymentAllocation.update).toHaveBeenCalledWith({
      where: { id: "alloc-2" },
      data: expect.objectContaining({ status: "COMPLETED" }),
    })
    // Completion is logged only after the allocation is settled
    expect(mockPaymentAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DUITKU_PAYMENT_COMPLETED",
        entityId: "inv-service-2:REF-SERVICE-OK",
      }),
    })
    expect(
      mockBillingInvoicePaymentAllocation.update.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockPaymentAuditLog.create.mock.invocationCallOrder[0] as number
    )
  })

  it("rejects a service callback whose amount differs from the pending allocation", async () => {
    const serviceInvoice = {
      id: "inv-service-3",
      billingAccountId: "ba-123",
      type: "SERVICE",
      currency: "IDR",
      totalAmount: new Decimal(100000),
      allocations: [
        {
          id: "alloc-3",
          status: "PENDING",
          source: "GATEWAY_DUITKU",
          amount: new Decimal(100000),
          referenceId: "REF-SERVICE-AMT",
        },
      ],
    }
    mockBillingInvoice.findUnique
      .mockResolvedValueOnce(serviceInvoice)
      .mockResolvedValueOnce(serviceInvoice)

    const res = await postCallback({
      ...DEFAULT_BODY,
      merchantOrderId: "inv-service-3",
      reference: "REF-SERVICE-AMT",
      amount: "50000",
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ ok: false, error: "AMOUNT_MISMATCH" })
    expect(mockBillingInvoicePaymentAllocation.update).not.toHaveBeenCalled()
    expect(mockPaymentAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DUITKU_PAYMENT_FAILED",
        details: expect.objectContaining({ error: "AMOUNT_MISMATCH" }),
      }),
    })
  })

  it("does not credit balance when resultCode is not 00", async () => {
    const res = await postCallback({ ...DEFAULT_BODY, resultCode: "01" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockCreditBalance).not.toHaveBeenCalled()
  })
})
