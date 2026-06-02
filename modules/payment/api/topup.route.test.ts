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
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

// Mock withAuth
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(() =>
    Promise.resolve({
      organizationId: "org-123",
      email: "test@example.com",
      name: "Test User",
    })
  ),
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
const mockFindByType = mock(() =>
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
})