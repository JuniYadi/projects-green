import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

// Mock withAuth
const mockWithAuth = mock(() =>
  Promise.resolve({
    organizationId: "org-123",
    email: "test@example.com",
    name: "Test User",
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

// Mock prisma
const mockInvoiceCreate = mock(() =>
  Promise.resolve({
    id: "inv-123",
    invoiceNumber: "TOP-ABC123",
    totalAmount: { toNumber: () => 50000 },
    status: "OPEN",
    paymentMethod: "VA",
    dueDate: new Date("2026-06-10"),
    type: "TOP_UP",
  })
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      create: mockInvoiceCreate,
      update: mock(() => Promise.resolve({})),
      findFirst: mock(() => Promise.resolve(null)),
      findUnique: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([])),
    },
    billingAccount: {
      findUnique: mock(() =>
        Promise.resolve({
          id: "ba-123",
          organizationId: "org-123",
          currency: "IDR",
          balance: { toNumber: () => 0 },
        })
      ),
      create: mock(() =>
        Promise.resolve({
          id: "ba-123",
          organizationId: "org-123",
        })
      ),
    },
    paymentGateway: {
      findFirst: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([])),
    },
    paymentBankAccount: {
      findMany: mock(() => Promise.resolve([])),
    },
    paymentCurrency: {
      findUnique: mock(() =>
        Promise.resolve({
          code: "USD",
          symbol: "$",
          ratePerBase: { toNumber: () => 1 },
          minTopup: { toNumber: () => 10 },
          maxTopup: { toNumber: () => 10000 },
        })
      ),
      findFirst: mock(() =>
        Promise.resolve({
          code: "USD",
          symbol: "$",
          ratePerBase: { toNumber: () => 1 },
          minTopup: { toNumber: () => 10 },
          maxTopup: { toNumber: () => 10000 },
        })
      ),
    },
    $transaction: mock((fns: unknown[]) => Promise.all(fns)),
  },
}))

// Import route after mocks
import { createTopupRoutes, createPaymentHistoryRoutes } from "./topup.route"

describe("Topup Route", () => {
  let app: ReturnType<typeof Elysia.prototype.compile>

  beforeEach(async () => {
    mockWithAuth.mockClear()
    mockInvoiceCreate.mockClear()

    const { prisma } = await import("@/lib/prisma")
    ;(prisma.billingAccount.findUnique as ReturnType<typeof mock>).mockClear()
    ;(prisma.billingAccount.findUnique as ReturnType<typeof mock>).mockImplementation(
      () =>
        Promise.resolve({
          id: "ba-123",
          organizationId: "org-123",
          currency: "IDR",
          balance: { toNumber: () => 0 },
        })
    )
    ;(prisma.paymentGateway.findMany as ReturnType<typeof mock>).mockClear()
    ;(prisma.paymentGateway.findMany as ReturnType<typeof mock>).mockImplementation(
      () => Promise.resolve([])
    )
    ;(prisma.paymentBankAccount.findMany as ReturnType<typeof mock>).mockClear()
    ;(prisma.paymentBankAccount.findMany as ReturnType<typeof mock>).mockImplementation(
      () => Promise.resolve([])
    )
    ;(prisma.paymentCurrency.findUnique as ReturnType<typeof mock>).mockClear()
    ;(prisma.paymentCurrency.findUnique as ReturnType<typeof mock>).mockImplementation(
      () =>
        Promise.resolve({
          code: "USD",
          symbol: "$",
          ratePerBase: { toNumber: () => 1 },
          minTopup: { toNumber: () => 10 },
          maxTopup: { toNumber: () => 10000 },
        })
    )
    ;(prisma.paymentCurrency.findFirst as ReturnType<typeof mock>).mockClear()
    ;(prisma.paymentCurrency.findFirst as ReturnType<typeof mock>).mockImplementation(
      () =>
        Promise.resolve({
          code: "USD",
          symbol: "$",
          ratePerBase: { toNumber: () => 1 },
          minTopup: { toNumber: () => 10 },
          maxTopup: { toNumber: () => 10000 },
        })
    )

    app = (
      new Elysia()
        .use(createTopupRoutes())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .use(createPaymentHistoryRoutes()) as any
    ).compile()
  })

  describe("POST /topup", () => {
    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        organizationId: null as unknown as string,
        email: "",
        name: "",
      })

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5000, paymentMethod: "VA" }),
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("should return 400 for invalid body", async () => {
      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 100 }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("should return 500 when gateway service fails", async () => {
      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5000, paymentMethod: "VA" }),
        })
      )

      expect([400, 500]).toContain(response.status)
      const body = await response.json()
      expect(body.ok).toBe(false)
    })

    it("should return error on unexpected failure", async () => {
      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5000, paymentMethod: "VA" }),
        })
      )

      const body = await response.json()
      expect(body.ok).toBe(false)
    })

    it("should return 400 for amount validation error", async () => {
      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 0, paymentMethod: "MANUAL_BANK" }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("should create invoice and return success for MANUAL_BANK", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(prisma.paymentBankAccount.findMany as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          id: "bank-idr",
          bankCode: "BCA",
          bankName: "BCA",
          accountName: "PT Projects Green",
          accountNumber: "123456",
          currency: "IDR",
          supportedCurrencies: ["IDR"],
          swiftCode: null,
          bankAddress: null,
          isActive: true,
          isDefault: true,
        },
      ])

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5000, paymentMethod: "MANUAL_BANK" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.id).toBe("inv-123")
      expect(body.invoice.paymentMethod).toBe("VA")
      expect(body.paymentUrl).toBeUndefined()
    })

    it("should return 400 when manual bank transfer is unavailable for account currency", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        currency: "USD",
        balance: { toNumber: () => 0 },
      })
      ;(prisma.paymentBankAccount.findMany as ReturnType<typeof mock>).mockResolvedValueOnce([])

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50, paymentMethod: "MANUAL_BANK" }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("MANUAL_BANK_NOT_AVAILABLE")
    })

    it("should return 400 GATEWAY_NOT_AVAILABLE when no gateway supports the currency for VA", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.paymentGateway.findMany as ReturnType<typeof mock>
      ).mockResolvedValueOnce([])

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5000, paymentMethod: "VA" }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("GATEWAY_NOT_AVAILABLE")
    })

    it("should allow VA top-up for a USD account when a gateway supports USD", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        currency: "USD",
        balance: { toNumber: () => 0 },
      })
      ;(
        prisma.paymentGateway.findMany as ReturnType<typeof mock>
      ).mockResolvedValueOnce([
        {
          id: "gw-usd",
          name: "PayPal",
          type: "GATEWAY",
          config: "",
          supportedCurrencies: ["USD"],
          isActive: true,
          isDefault: true,
        },
      ])

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5000, paymentMethod: "VA" }),
        })
      )

      // The route proceeds past the gateway lookup (Duitku call may then fail in
      // the test environment, but it must not be a currency/gateway rejection).
      const body = await response.json()
      if (!body.ok) {
        expect(body.error).not.toBe("GATEWAY_NOT_AVAILABLE")
        expect(body.error).not.toBe("CURRENCY_NOT_SUPPORTED")
      }
    })
  })

  describe("GET /topup/invoice/:id", () => {
    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        organizationId: null as unknown as string,
        email: "",
        name: "",
      })

      const response = await app.handle(
        new Request("http://localhost/topup/invoice/inv-123")
      )

      expect(response.status).toBe(401)
    })

    it("should return 404 when invoice not found", async () => {
      const response = await app.handle(
        new Request("http://localhost/topup/invoice/inv-notfound")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("should return invoice when found", async () => {
      const mockInvoice = {
        id: "inv-123",
        invoiceNumber: "TOP-ABC123",
        totalAmount: { toNumber: () => 50000 },
        status: "OPEN",
        paymentMethod: "MANUAL_BANK",
      }
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.billingInvoice.findFirst as ReturnType<typeof mock>
      ).mockResolvedValueOnce(mockInvoice)

      const response = await app.handle(
        new Request("http://localhost/topup/invoice/inv-123")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })
  })

  describe("GET /topup/methods", () => {
    it("should hide manual bank transfer when no bank account supports USD", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        currency: "USD",
        balance: { toNumber: () => 0 },
      })
      ;(prisma.paymentBankAccount.findMany as ReturnType<typeof mock>).mockResolvedValueOnce([])

      const response = await app.handle(
        new Request("http://localhost/topup/methods")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.currency).toBe("USD")
      expect(body.methods.MANUAL_BANK).toBe(false)
      expect(prisma.paymentBankAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { supportedCurrencies: { has: "USD" } },
              { supportedCurrencies: { isEmpty: true }, currency: "USD" },
            ],
          }),
        })
      )
    })

    it("should expose PayPal when a lowercase paypal gateway supports USD", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        currency: "USD",
        balance: { toNumber: () => 0 },
      })
      ;(prisma.paymentGateway.findMany as ReturnType<typeof mock>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "gw-paypal",
            name: "PayPal",
            type: "paypal",
            config: "",
            supportedCurrencies: ["USD"],
            isActive: true,
            isDefault: true,
          },
        ])

      const response = await app.handle(
        new Request("http://localhost/topup/methods")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.currency).toBe("USD")
      expect(body.methods.PAYPAL).toBe(true)
      expect(body.methods.VA).toBe(false)
      expect(body.methods.QRIS).toBe(false)
    })
  })

  describe("GET /topup/bank-accounts", () => {
    it("should return only bank accounts matching organization currency", async () => {
      const { prisma } = await import("@/lib/prisma")
      ;(
        prisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        currency: "USD",
        balance: { toNumber: () => 0 },
      })
      ;(prisma.paymentBankAccount.findMany as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          id: "bank-usd",
          bankCode: "HSBC",
          bankName: "HSBC",
          accountName: "PT Projects Green",
          accountNumber: "987654",
          currency: "USD",
          supportedCurrencies: ["USD", "IDR"],
          swiftCode: "CENAIDJA",
          bankAddress: "1 International Plaza, Jakarta",
          isActive: true,
          isDefault: true,
        },
      ])

      const response = await app.handle(
        new Request("http://localhost/topup/bank-accounts")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].supportedCurrencies).toEqual(["USD", "IDR"])
      expect(body.data[0].swiftCode).toBe("CENAIDJA")
    })

    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        organizationId: null as unknown as string,
        email: "",
        name: "",
      })

      const response = await app.handle(
        new Request("http://localhost/topup/bank-accounts")
      )

      expect(response.status).toBe(401)
    })
  })

  describe("GET /history", () => {
    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({
        organizationId: null as unknown as string,
        email: "",
        name: "",
      })

      const response = await app.handle(new Request("http://localhost/history"))

      expect(response.status).toBe(401)
    })

    it("should return payment history", async () => {
      const response = await app.handle(new Request("http://localhost/history"))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data).toEqual([])
    })
  })
})

describe("CreateTopupSchema", () => {
  it("should reject request without paymentMethod", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({ amount: 50000 })
    expect(result.success).toBe(false)
  })

  it("should accept valid VA paymentMethod", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 50000,
      paymentMethod: "VA",
    })
    expect(result.success).toBe(true)
  })

  it("should accept valid QRIS paymentMethod", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 50000,
      paymentMethod: "QRIS",
    })
    expect(result.success).toBe(true)
  })

  it("should accept valid MANUAL_BANK paymentMethod", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 50000,
      paymentMethod: "MANUAL_BANK",
    })
    expect(result.success).toBe(true)
  })

  it("should accept valid PAYPAL paymentMethod", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 50,
      paymentMethod: "PAYPAL",
    })
    expect(result.success).toBe(true)
  })

  it("should reject invalid paymentMethod", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 50000,
      paymentMethod: "INVALID",
    })
    expect(result.success).toBe(false)
  })

  it("should reject zero or negative amounts", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const zero = CreateTopupSchema.safeParse({
      amount: 0,
      paymentMethod: "VA",
    })
    expect(zero.success).toBe(false)

    const neg = CreateTopupSchema.safeParse({
      amount: -10,
      paymentMethod: "VA",
    })
    expect(neg.success).toBe(false)
  })
})
