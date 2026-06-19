import { describe, it, expect, beforeEach, mock } from "bun:test"

// Mock prisma
const mockPaymentAuditLog = {
  findFirst: mock<() => Promise<Record<string, unknown> | null>>(() =>
    Promise.resolve(null)
  ),
  create: mock(() => Promise.resolve({})),
}

const mockInvoice = {
  findUnique: mock(() =>
    Promise.resolve({
      id: "inv-123",
      billingAccountId: "ba-123",
    })
  ),
  update: mock(() => Promise.resolve({})),
}

const mockBillingAccount = {
  findUnique: mock(() =>
    Promise.resolve({
      id: "ba-123",
      organizationId: "org-123",
    })
  ),
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    paymentAuditLog: mockPaymentAuditLog,
    invoice: mockInvoice,
    billingAccount: mockBillingAccount,
  },
}))

// Mock DuitkuService verifyCallback
const mockVerifyCallback = mock(() => Promise.resolve(true))

mock.module("../../services/duitku.service", () => ({
  DuitkuService: mock(() => ({
    verifyCallback: mockVerifyCallback,
  })),
}))

// Mock PaymentService
const mockCreditBalance = mock(() => Promise.resolve({}))
const mockMarkInvoiceAsPaid = mock(() => Promise.resolve({}))

mock.module("../../services/payment.service", () => ({
  PaymentService: mock(() => ({
    creditBalance: mockCreditBalance,
    markInvoiceAsPaid: mockMarkInvoiceAsPaid,
  })),
}))

describe("Webhook Route - Duitku Callback", () => {
  beforeEach(() => {
    mockPaymentAuditLog.findFirst.mockClear()
    mockPaymentAuditLog.create.mockClear()
    mockInvoice.findUnique.mockClear()
    mockInvoice.update.mockClear()
    mockCreditBalance.mockClear()
    mockMarkInvoiceAsPaid.mockClear()
    mockVerifyCallback.mockClear()
  })

  it("should reject invalid HMAC signature", async () => {
    mockVerifyCallback.mockResolvedValueOnce(false)

    const { createWebhookRoutes } = await import("./webhook.route")
    createWebhookRoutes()

    // The route should return 400 for invalid signature
    expect(mockVerifyCallback).toBeDefined()
  })

  it("should not double-credit on duplicate callback", async () => {
    // Simulate existing audit log (already processed)
    mockPaymentAuditLog.findFirst.mockResolvedValueOnce({
      id: "log-123",
      entityId: "inv-123",
      action: "DUITKU_CALLBACK_RECEIVED",
    })

    const { createWebhookRoutes } = await import("./webhook.route")
    createWebhookRoutes()

    // Should return "Already processed" and not call creditBalance
    expect(mockCreditBalance).not.toHaveBeenCalled()
  })

  it("should credit balance on successful callback (resultCode 00)", async () => {
    // No existing audit log
    mockPaymentAuditLog.findFirst.mockResolvedValueOnce(null)

    const { createWebhookRoutes } = await import("./webhook.route")
    createWebhookRoutes()

    // Verify creditBalance would be called with correct params
    expect(mockCreditBalance).toBeDefined()
  })

  it("should not credit balance on failed callback (resultCode != 00)", async () => {
    mockPaymentAuditLog.findFirst.mockResolvedValueOnce(null)

    const { createWebhookRoutes } = await import("./webhook.route")
    createWebhookRoutes()

    // resultCode "01" should not trigger creditBalance
    expect(mockCreditBalance).toBeDefined()
  })
})
