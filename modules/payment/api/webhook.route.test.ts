import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

// Mock prisma
const mockPaymentAuditLog = {
  findFirst: mock<() => Promise<Record<string, unknown> | null>>(() =>
    Promise.resolve(null)
  ),
  create: mock(() => Promise.resolve({})),
}

const mockBillingInvoice = {
  findUnique: mock(() =>
    Promise.resolve({ id: "inv-123", billingAccountId: "ba-123" })
  ),
  update: mock(() => Promise.resolve({})),
}

const mockBillingAccount = {
  findUnique: mock(() =>
    Promise.resolve({ id: "ba-123", organizationId: "org-123" })
  ),
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    paymentAuditLog: mockPaymentAuditLog,
    billingInvoice: mockBillingInvoice,
    billingAccount: mockBillingAccount,
  },
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
    mockPaymentAuditLog.findFirst.mockClear()
    mockPaymentAuditLog.create.mockClear()
    mockBillingInvoice.findUnique.mockClear()
    mockBillingInvoice.update.mockClear()
    mockBillingAccount.findUnique.mockClear()
    mockCreditBalance.mockClear()
    mockMarkInvoiceAsPaid.mockClear()
    mockSendInvoicePaidEmail.mockClear()
    mockVerifyCallback.mockClear()
  })

  it("credits balance and logs on successful callback (resultCode 00)", async () => {
    const res = await postCallback(DEFAULT_BODY)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockVerifyCallback).toHaveBeenCalledTimes(1)
    expect(mockPaymentAuditLog.findFirst).toHaveBeenCalledWith({
      where: { entityId: "inv-123", action: "DUITKU_CALLBACK_RECEIVED" },
    })
    expect(mockPaymentAuditLog.create).toHaveBeenCalledTimes(2)
    expect(mockCreditBalance).toHaveBeenCalledWith("org-123", 50000, "inv-123")
    expect(mockMarkInvoiceAsPaid).toHaveBeenCalledWith("inv-123")
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
      entityId: "inv-123",
      action: "DUITKU_CALLBACK_RECEIVED",
    })

    const res = await postCallback(DEFAULT_BODY)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, message: "Already processed" })
    expect(mockCreditBalance).not.toHaveBeenCalled()
  })

  it("does not credit balance when resultCode is not 00", async () => {
    const res = await postCallback({ ...DEFAULT_BODY, resultCode: "01" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockCreditBalance).not.toHaveBeenCalled()
  })
})
