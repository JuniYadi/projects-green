import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

const mockWithAuth = mock(() =>
  Promise.resolve({
    user: { id: "user-1" },
    organizationId: "org-123",
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockGetPlatformRole = mock(() => Promise.resolve("super_admin"))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRole,
}))

const baseCurrency = {
  id: "cur_usd",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  isBase: true,
  ratePerBase: { toNumber: () => 1 },
  minTopup: { toNumber: () => 5 },
  maxTopup: { toNumber: () => 10000 },
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCurrency = {
  findMany: mock(() => Promise.resolve([baseCurrency])),
  findUnique: mock(() => Promise.resolve(baseCurrency)),
  findFirst: mock(() => Promise.resolve(baseCurrency)),
  create: mock(() => Promise.resolve(baseCurrency)),
  update: mock(() => Promise.resolve(baseCurrency)),
  updateMany: mock(() => Promise.resolve({ count: 0 })),
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    currency: mockCurrency,
    $transaction: mock((cb: (tx: unknown) => unknown) =>
      cb({ currency: mockCurrency })
    ),
  },
}))

const { createAdminCurrencyRoutes } = await import("./admin-currency.route")

describe("Admin Currency Route", () => {
  let app: ReturnType<typeof Elysia.prototype.compile>

  beforeEach(() => {
    mockWithAuth.mockClear()
    mockGetPlatformRole.mockClear()
    mockGetPlatformRole.mockResolvedValue("super_admin")
    mockCurrency.findMany.mockClear()
    mockCurrency.findUnique.mockClear()
    mockCurrency.create.mockClear()
    mockCurrency.update.mockClear()

    app = (new Elysia().use(createAdminCurrencyRoutes()) as unknown as {
      compile: () => ReturnType<typeof Elysia.prototype.compile>
    }).compile()
  })

  it("lists currencies for super admin", async () => {
    const response = await app.handle(new Request("http://localhost/currencies"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data[0].code).toBe("USD")
    expect(body.data[0].ratePerBase).toBe(1)
  })

  it("returns 403 for non super admin", async () => {
    mockGetPlatformRole.mockResolvedValueOnce("member")
    const response = await app.handle(new Request("http://localhost/currencies"))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("FORBIDDEN")
  })

  it("rejects invalid create payload", async () => {
    const response = await app.handle(
      new Request("http://localhost/currencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "X" }),
      })
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("creates a currency with valid payload", async () => {
    const response = await app.handle(
      new Request("http://localhost/currencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "IDR",
          name: "Indonesian Rupiah",
          symbol: "Rp",
          ratePerBase: 18000,
          minTopup: 90000,
          maxTopup: 180000000,
        }),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(mockCurrency.create).toHaveBeenCalled()
  })

  it("updates a currency", async () => {
    const response = await app.handle(
      new Request("http://localhost/currencies/cur_usd", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "United States Dollar" }),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(mockCurrency.update).toHaveBeenCalled()
  })
})
