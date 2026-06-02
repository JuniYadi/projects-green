import { describe, it, expect, beforeEach, mock } from "bun:test"

// Mock prisma before any imports
const mockPrisma = {
  invoice: {
    create: mock(() =>
      Promise.resolve({
        id: "inv-123",
        invoiceNumber: "TOP-ABC123",
        totalAmount: { toNumber: () => 50000 },
        status: "OPEN",
        paymentMethod: "VA",
        dueDate: new Date("2026-06-10"),
        type: "TOP_UP",
      })
    ),
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
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// Mock withAuth
const mockWithAuth = mock<() => Promise<{ organizationId: string | null; email?: string; name?: string }>>(() =>
  Promise.resolve({
    organizationId: "org-123",
    email: "test@example.com",
    name: "Test User",
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

// Mock DuitkuService
const mockCreatePayment = mock(() =>
  Promise.resolve({
    paymentUrl: "https://app.duitku.com/payment/abc",
    vaNumber: "1234567890",
    reference: "ref-123",
  })
)

mock.module("../../services/duitku.service", () => ({
  DuitkuService: mock(() => ({
    createPayment: mockCreatePayment,
  })),
}))

// Mock GatewayService
const mockFindByType = mock<() => Promise<{ id: string; name: string; type: string; isActive: boolean; isDefault: boolean; config: { merchantCode: string; apiKey: string; sandboxUrl: string; productionUrl: string } } | null>>(() =>
  Promise.resolve({
    id: "gw-123",
    name: "Duitku",
    type: "GATEWAY",
    isActive: true,
    isDefault: true,
    config: {
      merchantCode: "M001",
      apiKey: "key",
      sandboxUrl: "https://sandbox.duitku.com",
      productionUrl: "https://app.duitku.com",
    },
  })
)

mock.module("../../services/gateway.service", () => ({
  GatewayService: mock(() => ({
    findByType: mockFindByType,
  })),
}))

describe("Topup Route", () => {
  beforeEach(() => {
    mockPrisma.invoice.create.mockClear()
    mockPrisma.invoice.update.mockClear()
    mockPrisma.$transaction.mockClear()
    mockWithAuth.mockClear()
    mockCreatePayment.mockClear()
    mockFindByType.mockClear()
  })

  it("should create invoice with paymentMethod VA and return paymentUrl", async () => {
    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()
    expect(routes).toBeDefined()
  })

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

  it("should return 401 when no organizationId", async () => {
    mockWithAuth.mockResolvedValueOnce({ organizationId: null })

    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({ body: { amount: 50000, paymentMethod: "VA" }, set })
      expect(set.status).toBe(401)
      expect(result.ok).toBe(false)
      expect(result.error).toBe("UNAUTHORIZED")
    }
  })

  it("should return 400 for invalid body", async () => {
    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({ body: { amount: 100 }, set })
      expect(set.status).toBe(400)
      expect(result.ok).toBe(false)
      expect(result.error).toBe("VALIDATION_ERROR")
    }
  })

  it("should return 400 when gateway not configured for VA", async () => {
    mockFindByType.mockResolvedValueOnce(null)

    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({
        body: { amount: 50000, paymentMethod: "VA" },
        set,
      })
      expect(set.status).toBe(400)
      expect(result.ok).toBe(false)
      expect(result.error).toBe("GATEWAY_NOT_CONFIGURED")
    }
  })

  it("should create invoice and return paymentUrl for VA", async () => {
    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({
        body: { amount: 50000, paymentMethod: "VA" },
        set,
      })
      expect(result.ok).toBe(true)
      expect(result.paymentUrl).toBe("https://app.duitku.com/payment/abc")
      expect((result.invoice as Record<string, unknown>).gateway).toBe("duitku")
      expect(mockCreatePayment).toHaveBeenCalled()
    }
  })

  it("should create invoice and return paymentUrl for QRIS", async () => {
    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({
        body: { amount: 50000, paymentMethod: "QRIS" },
        set,
      })
      expect(result.ok).toBe(true)
      expect(result.paymentUrl).toBe("https://app.duitku.com/payment/abc")
      expect((result.invoice as Record<string, unknown>).gateway).toBe("duitku")
    }
  })

  it("should create invoice without gateway for MANUAL_BANK", async () => {
    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({
        body: { amount: 50000, paymentMethod: "MANUAL_BANK" },
        set,
      })
      expect(result.ok).toBe(true)
      expect(result.paymentUrl).toBeUndefined()
      expect((result.invoice as Record<string, unknown>).paymentMethod).toBe("MANUAL_BANK")
      expect(mockCreatePayment).not.toHaveBeenCalled()
    }
  })

  it("should return 500 on server error", async () => {
    mockPrisma.invoice.create.mockRejectedValueOnce(new Error("Database error"))

    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({
        body: { amount: 50000, paymentMethod: "MANUAL_BANK" },
        set,
      })
      expect(set.status).toBe(500)
      expect(result.ok).toBe(false)
      expect(result.error).toBe("INTERNAL_ERROR")
    }
  })

  it("should return 400 for minimum amount error", async () => {
    mockPrisma.invoice.create.mockRejectedValueOnce(
      new Error("Minimum top-up amount is 10000")
    )

    const { createTopupRoutes } = await import("./topup.route")
    const routes = createTopupRoutes()

    const handler = (routes as unknown as { handlers: Array<{ method?: string; path?: string; (ctx: unknown): Promise<unknown> }> }).handlers?.find(
      (h: { method?: string; path?: string }) => h.method === "POST" && h.path === "/"
    )

    if (handler) {
      const set = { status: 200 }
      const result = await (handler as (ctx: unknown) => Promise<Record<string, unknown>>)({
        body: { amount: 50000, paymentMethod: "MANUAL_BANK" },
        set,
      })
      expect(set.status).toBe(400)
      expect(result.ok).toBe(false)
    }
  })
})
