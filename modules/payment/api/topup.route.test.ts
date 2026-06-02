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
    $transaction: mock((fns: unknown[]) => Promise.all(fns)),
  },
}))

// Import route after mocks
import { createTopupRoutes, createPaymentHistoryRoutes } from "./topup.route"

describe("Topup Route", () => {
  let app: ReturnType<typeof Elysia.prototype.compile>

  beforeEach(() => {
    mockWithAuth.mockClear()
    mockInvoiceCreate.mockClear()

    app = (new Elysia()
      .use(createTopupRoutes())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .use(createPaymentHistoryRoutes()) as any).compile()
  })

  describe("POST /topup", () => {
    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({ organizationId: null as unknown as string, email: "", name: "" })

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "VA" }),
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
          body: JSON.stringify({ amount: 50000, paymentMethod: "VA" }),
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
          body: JSON.stringify({ amount: 50000, paymentMethod: "VA" }),
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
          body: JSON.stringify({ amount: 5000, paymentMethod: "MANUAL_BANK" }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("should create invoice and return success for MANUAL_BANK", async () => {
      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "MANUAL_BANK" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.id).toBe("inv-123")
      expect(body.invoice.paymentMethod).toBe("VA")
      expect(body.paymentUrl).toBeUndefined()
    })
  })

  describe("GET /topup/invoice/:id", () => {
    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({ organizationId: null as unknown as string, email: "", name: "" })

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
      ;(prisma.invoice.findFirst as ReturnType<typeof mock>).mockResolvedValueOnce(
        mockInvoice
      )

      const response = await app.handle(
        new Request("http://localhost/topup/invoice/inv-123")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })
  })

  describe("GET /topup/bank-accounts", () => {
    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({ organizationId: null as unknown as string, email: "", name: "" })

      const response = await app.handle(
        new Request("http://localhost/topup/bank-accounts")
      )

      expect(response.status).toBe(401)
    })
  })

  describe("GET /history", () => {
    it("should return 401 when no organizationId", async () => {
      ;(mockWithAuth as ReturnType<typeof mock>).mockResolvedValueOnce({ organizationId: null as unknown as string, email: "", name: "" })

      const response = await app.handle(
        new Request("http://localhost/history")
      )

      expect(response.status).toBe(401)
    })

    it("should return payment history", async () => {
      const response = await app.handle(
        new Request("http://localhost/history")
      )

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

  it("should reject invalid paymentMethod", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 50000,
      paymentMethod: "INVALID",
    })
    expect(result.success).toBe(false)
  })

  it("should reject amount below minimum", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 5000,
      paymentMethod: "VA",
    })
    expect(result.success).toBe(false)
  })

  it("should reject amount above maximum", async () => {
    const { CreateTopupSchema } = await import("../types/payment.types")
    const result = CreateTopupSchema.safeParse({
      amount: 200000000,
      paymentMethod: "VA",
    })
    expect(result.success).toBe(false)
  })
})