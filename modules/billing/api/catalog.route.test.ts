import { describe, it, expect, vi, beforeEach } from "bun:test"

import { createCatalogRoutes } from "./catalog.route"

// ─── Prisma mock ──────────────────────────────────────────────────

const mockFindUnique = vi.fn()
const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()

const mockPrisma = {
  billingAccount: {
    findUnique: mockFindUnique,
  },
  servicePackage: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// ─── Helpers ──────────────────────────────────────────────────────

function makeApp(deps: {
  authenticate?: () => Promise<{
    organizationId?: string | null
    user: { id: string; email?: string | null } | null
  }>
  catalogService?: {
    getCatalog: (
      currency: string
    ) => Promise<{ products: unknown[]; currency: string }>
    getProduct: (currency: string, code: string) => Promise<unknown | null>
  }
}) {
  const catalogService = deps.catalogService ?? {
    getCatalog: vi.fn().mockResolvedValue({ products: [], currency: "USD" }),
    getProduct: vi.fn().mockResolvedValue(null),
  }

  return createCatalogRoutes({
    authenticate:
      deps.authenticate ??
      (() => Promise.resolve({ user: null, organizationId: null })),
    catalogService: catalogService as never,
  })
}

function mockAuth(
  overrides: {
    organizationId?: string | null
    user?: { id: string; email?: string | null } | null
  } = {}
) {
  return {
    user: { id: "user-1", email: "test@example.com" },
    organizationId: "org-1",
    ...overrides,
  }
}

describe("GET /billing/catalog", () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockFindMany.mockReset()
    mockFindFirst.mockReset()
  })

  it("returns 401 when user is not authenticated", async () => {
    const app = makeApp({
      authenticate: async () => ({ user: null, organizationId: null }),
    })

    const response = await app.handle(new Request("http://localhost/catalog"))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when no active organization", async () => {
    const app = makeApp({
      authenticate: async () => ({
        user: { id: "user-1", email: "test@example.com" },
        organizationId: null,
      }),
    })

    const response = await app.handle(new Request("http://localhost/catalog"))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NO_ORGANIZATION")
  })

  it("returns 500 when billing account lookup fails", async () => {
    mockFindUnique.mockRejectedValueOnce(new Error("DB_ERROR"))

    const app = makeApp({
      authenticate: async () => mockAuth(),
    })

    const response = await app.handle(new Request("http://localhost/catalog"))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })

  it("returns 403 when no billing account exists for org", async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const app = makeApp({
      authenticate: async () => mockAuth(),
    })

    const response = await app.handle(new Request("http://localhost/catalog"))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NO_BILLING_ACCOUNT")
  })

  it("returns catalog with only matching-currency prices", async () => {
    const mockPackages = [
      {
        id: "pkg-1",
        code: "APP_HOSTING",
        name: "App Hosting",
        description: "Hosted apps",
        isActive: true,
        plans: [
          {
            id: "plan-1",
            packageId: "pkg-1",
            code: "STARTER",
            name: "Starter",
            resources: { cpu: 1, memory: 512 },
            isActive: true,
            pricings: [
              {
                id: "price-1",
                planId: "plan-1",
                regionId: "reg-1",
                type: "BUNDLE",
                billingMode: "PACKAGE",
                billingPeriod: "MONTHLY",
                currency: "USD",
                periodPrice: "10.00",
                effectiveFrom: new Date("2025-01-01"),
                effectiveTo: null,
                chargeUnit: "SUBSCRIPTION",
                isActive: true,
                servicePlan: {
                  id: "plan-1",
                  packageId: "pkg-1",
                  code: "STARTER",
                  name: "Starter",
                  resources: { cpu: 1, memory: 512 },
                  isActive: true,
                  package: {
                    id: "pkg-1",
                    code: "APP_HOSTING",
                    name: "App Hosting",
                    description: "Hosted apps",
                    isActive: true,
                  },
                },
                region: {
                  id: "reg-1",
                  code: "US_EAST",
                  name: "US East",
                  country: "US",
                  isActive: true,
                },
              },
              // Wrong currency — must be excluded
              {
                id: "price-2",
                planId: "plan-1",
                regionId: "reg-1",
                type: "BUNDLE",
                billingMode: "PACKAGE",
                billingPeriod: "MONTHLY",
                currency: "IDR",
                periodPrice: "150000",
                effectiveFrom: new Date("2025-01-01"),
                effectiveTo: null,
                chargeUnit: "SUBSCRIPTION",
                isActive: true,
                servicePlan: {
                  id: "plan-1",
                  packageId: "pkg-1",
                  code: "STARTER",
                  name: "Starter",
                  resources: { cpu: 1, memory: 512 },
                  isActive: true,
                  package: {
                    id: "pkg-1",
                    code: "APP_HOSTING",
                    name: "App Hosting",
                    description: "Hosted apps",
                    isActive: true,
                  },
                },
                region: {
                  id: "reg-1",
                  code: "US_EAST",
                  name: "US East",
                  country: "US",
                  isActive: true,
                },
              },
            ],
          },
        ],
      },
    ]

    mockFindUnique.mockResolvedValueOnce({ currency: "USD" })
    mockFindMany.mockResolvedValueOnce(mockPackages)

    const catalogService = {
      getCatalog: vi.fn().mockResolvedValue({
        products: [
          {
            code: "APP_HOSTING",
            name: "App Hosting",
            description: "Hosted apps",
            plans: [
              {
                id: "plan-1",
                code: "STARTER",
                name: "Starter",
                resources: { cpu: 1, memory: 512 },
                offers: [
                  {
                    id: "price-1",
                    billingPeriod: "MONTHLY",
                    periodMonths: 1,
                    periodPrice: "10.00",
                    currency: "USD",
                    chargeUnit: "SUBSCRIPTION",
                    effectiveFrom: "2025-01-01T00:00:00.000Z",
                    effectiveTo: null,
                  },
                ],
              },
            ],
          },
        ],
        currency: "USD",
      }),
      getProduct: vi.fn(),
    }

    const app = makeApp({
      authenticate: async () => mockAuth(),
      catalogService,
    })

    const response = await app.handle(new Request("http://localhost/catalog"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.currency).toBe("USD")
    expect(body.products).toHaveLength(1)
    expect(body.products[0].code).toBe("APP_HOSTING")
    expect(body.products[0].plans[0].offers).toHaveLength(1)
    expect(body.products[0].plans[0].offers[0].currency).toBe("USD")
  })

  it("returns empty products when no matching currency prices exist", async () => {
    mockFindUnique.mockResolvedValueOnce({ currency: "USD" })
    mockFindMany.mockResolvedValueOnce([])

    const catalogService = {
      getCatalog: vi.fn().mockResolvedValue({ products: [], currency: "USD" }),
      getProduct: vi.fn(),
    }

    const app = makeApp({
      authenticate: async () => mockAuth(),
      catalogService,
    })

    const response = await app.handle(new Request("http://localhost/catalog"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.products).toHaveLength(0)
  })

  it("returns 500 when catalog service throws", async () => {
    mockFindUnique.mockResolvedValueOnce({ currency: "USD" })

    const catalogService = {
      getCatalog: vi.fn().mockRejectedValue(new Error("SERVICE_ERROR")),
      getProduct: vi.fn(),
    }

    const app = makeApp({
      authenticate: async () => mockAuth(),
      catalogService,
    })

    const response = await app.handle(new Request("http://localhost/catalog"))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })
})

describe("GET /billing/catalog/:code", () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockFindFirst.mockReset()
  })

  it("returns 401 when user is not authenticated", async () => {
    const app = makeApp({
      authenticate: async () => ({ user: null, organizationId: null }),
    })

    const response = await app.handle(
      new Request("http://localhost/catalog/APP_HOSTING")
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when no active organization", async () => {
    const app = makeApp({
      authenticate: async () => ({
        user: { id: "user-1", email: "test@example.com" },
        organizationId: null,
      }),
    })

    const response = await app.handle(
      new Request("http://localhost/catalog/APP_HOSTING")
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NO_ORGANIZATION")
  })

  it("returns 404 when product not found for currency", async () => {
    mockFindUnique.mockResolvedValueOnce({ currency: "USD" })
    mockFindFirst.mockResolvedValueOnce(null)

    const catalogService = {
      getCatalog: vi.fn(),
      getProduct: vi.fn().mockResolvedValue(null),
    }

    const app = makeApp({
      authenticate: async () => mockAuth(),
      catalogService,
    })

    const response = await app.handle(
      new Request("http://localhost/catalog/APP_HOSTING")
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("PRODUCT_NOT_FOUND")
  })

  it("returns 404 when product has no offers in currency", async () => {
    mockFindUnique.mockResolvedValueOnce({ currency: "USD" })
    mockFindFirst.mockResolvedValueOnce({
      id: "pkg-1",
      code: "VPN",
      name: "VPN",
      description: "VPN service",
      isActive: true,
      plans: [
        {
          id: "plan-1",
          packageId: "pkg-1",
          code: "STANDARD",
          name: "Standard",
          resources: {},
          isActive: true,
          pricings: [],
        },
      ],
    })

    const catalogService = {
      getCatalog: vi.fn(),
      getProduct: vi.fn().mockResolvedValue(null),
    }

    const app = makeApp({
      authenticate: async () => mockAuth(),
      catalogService,
    })

    const response = await app.handle(
      new Request("http://localhost/catalog/VPN")
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("PRODUCT_NOT_FOUND")
  })

  it("returns 500 when catalog service throws", async () => {
    mockFindUnique.mockResolvedValueOnce({ currency: "USD" })

    const catalogService = {
      getCatalog: vi.fn(),
      getProduct: vi.fn().mockRejectedValue(new Error("SERVICE_ERROR")),
    }

    const app = makeApp({
      authenticate: async () => mockAuth(),
      catalogService,
    })

    const response = await app.handle(
      new Request("http://localhost/catalog/APP_HOSTING")
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_ERROR")
  })
})
