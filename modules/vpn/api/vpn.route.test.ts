import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

// ─── Mocks ──────────────────────────────────────────────────────────────
//
// Per AGENTS.md: never mock a sibling service module. We mock only
// `@/lib/prisma` (a leaf dependency) and inject the `billing` dep
// (route-level abstraction). The default `VpnBillingService` inside
// the route is NOT constructed at module load — it is built lazily
// by the factory only when no `billing` dep is provided, so importing
// this file does not require a live DATABASE_URL.

const mockPrisma = {
  package: { findUnique: mock() },
  servicePlan: { findUnique: mock() },
  region: { findUnique: mock() },
  pricing: { findFirst: mock() },
  subscription: {
    findUnique: mock(),
    create: mock(),
    update: mock(),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { createVpnRoutes } from "./vpn.route"

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

type VpnAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

const validAuth: VpnAuthContext = {
  user: { id: "user-1", email: "test@example.com" },
  organizationId: "org_1",
  role: "owner",
  roles: ["owner"],
}

const mockBilling = {
  chargeMonthly: mock(),
}

const createRoute = (
  auth: VpnAuthContext = validAuth,
  billing = mockBilling,
) =>
  createVpnRoutes({
    authenticate: async () => auth,
    billing,
  })

const setupPrismaDefaults = () => {
  mockPrisma.package.findUnique.mockReset()
  mockPrisma.servicePlan.findUnique.mockReset()
  mockPrisma.region.findUnique.mockReset()
  mockPrisma.pricing.findFirst.mockReset()
  mockPrisma.subscription.findUnique.mockReset()
  mockPrisma.subscription.create.mockReset()
  mockPrisma.subscription.update.mockReset()
  mockPrisma.package.findUnique.mockResolvedValue({ id: "pkg_vpn" })
  mockPrisma.servicePlan.findUnique.mockResolvedValue({ id: "plan_standard" })
  mockPrisma.region.findUnique.mockResolvedValue({ id: "region_id" })
  mockPrisma.pricing.findFirst.mockResolvedValue({ id: "pricing_id" })
  // Default: no existing subscription (route will create)
  mockPrisma.subscription.findUnique.mockResolvedValue(null)
  mockPrisma.subscription.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: "sub_vpn_new",
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  )
  mockPrisma.subscription.update.mockImplementation(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: args.where.id,
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  )
}

beforeEach(() => {
  setupPrismaDefaults()
  mockBilling.chargeMonthly.mockReset()
  // Default: billing succeeds with a STANDARD Indonesia price (25,000 IDR)
  mockBilling.chargeMonthly.mockResolvedValue({
    billingAccountId: "ba_1",
    adjustmentId: "adj_vpn_1",
    balanceBefore: decimal("500.00"),
    balanceAfter: decimal("475.00"),
    amount: decimal("25.00"),
    currency: "IDR",
    alreadyProcessed: false,
  })
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe("POST /vpn/subscriptions", () => {
  it("provisions vpn after monthly charge succeeds and persists a Subscription record", async () => {
    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "INDONESIA",
          planCode: "STANDARD",
        }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.regionCode).toBe("INDONESIA")
    expect(body.planCode).toBe("STANDARD")
    expect(body.status).toBe("ACTIVE")
    expect(body.monthlyPrice).toBe("25000")
    expect(body.currency).toBe("IDR")
    expect(body.period).toMatch(/^\d{4}-\d{2}$/)
    expect(body.topupUrl).toBe("/console/billing/topup")
    // Subscription is persisted with a stable DB id; the renewal
    // worker (Task 3) uses this id to find and renew.
    expect(body.subscriptionId).toBe("sub_vpn_new")

    expect(mockBilling.chargeMonthly).toHaveBeenCalledTimes(1)
    expect(mockBilling.chargeMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        vpnSubscriptionId: "sub_vpn_new",
        regionCode: "INDONESIA",
        amount: decimal("25000"),
        period: expect.stringMatching(/^\d{4}-\d{2}$/),
      }),
    )

    expect(mockPrisma.subscription.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org_1",
          packageId: "pkg_vpn",
          planId: "plan_standard",
          pricingId: "pricing_id",
          type: "BUNDLE",
          billingMode: "PACKAGE",
          status: "ACTIVE",
          metadata: expect.objectContaining({
            regionCode: "INDONESIA",
            planCode: "STANDARD",
          }),
        }),
      }),
    )
  })

  it("reuses existing subscription record when one already exists (idempotent provision)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub_vpn_existing",
      organizationId: "org_1",
      packageId: "pkg_vpn",
      planId: "plan_standard",
      pricingId: "pricing_id",
      type: "BUNDLE",
      billingMode: "PACKAGE",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    })

    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "INDONESIA",
          planCode: "STANDARD",
        }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.subscriptionId).toBe("sub_vpn_existing")
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled()
    expect(mockBilling.chargeMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        vpnSubscriptionId: "sub_vpn_existing",
      }),
    )
  })

  it("returns 402 with topupUrl when balance is insufficient", async () => {
    mockBilling.chargeMonthly.mockRejectedValue(
      new Error("INSUFFICIENT_BALANCE"),
    )

    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "INDONESIA",
          planCode: "STANDARD",
        }),
      }),
    )

    expect(response.status).toBe(402)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INSUFFICIENT_BALANCE")
    expect(body.topupUrl).toBe("/console/billing/topup")
    expect(body.message).toMatch(/balance/i)
  })

  it("does not call any VPN provider logic when billing fails", async () => {
    mockBilling.chargeMonthly.mockRejectedValue(
      new Error("INSUFFICIENT_BALANCE"),
    )

    const app = createRoute()
    await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "INDONESIA",
          planCode: "STANDARD",
        }),
      }),
    )

    // No VPN provider code path exists in the route. The assertion here
    // is the negative: chargeMonthly was attempted exactly once and the
    // request short-circuited with 402 — no side effects, no provider
    // call (which does not exist yet).
    expect(mockBilling.chargeMonthly).toHaveBeenCalledTimes(1)
  })

  it("returns 401 when user is not authenticated", async () => {
    const app = createRoute({
      user: null,
      organizationId: null,
    })
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "INDONESIA",
          planCode: "STANDARD",
        }),
      }),
    )

    expect(response.status).toBe(401)
    expect(mockBilling.chargeMonthly).not.toHaveBeenCalled()
  })

  it("returns 403 when user has no active organization", async () => {
    const app = createRoute({
      user: { id: "user-1", email: "test@example.com" },
      organizationId: null,
    })
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "INDONESIA",
          planCode: "STANDARD",
        }),
      }),
    )

    expect(response.status).toBe(403)
    expect(mockBilling.chargeMonthly).not.toHaveBeenCalled()
  })

  it("returns 422 when regionCode is missing", async () => {
    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode: "STANDARD" }),
      }),
    )

    // Status 422 is the contract: the body shape (e.g. { error: "VALIDATION_ERROR" })
    // is shaped by the app-level `.onError` handler in `lib/api.ts` and is
    // covered by integration smoke tests, not this unit test.
    expect(response.status).toBe(422)
    expect(mockBilling.chargeMonthly).not.toHaveBeenCalled()
  })

  it("returns 422 when planCode is missing", async () => {
    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regionCode: "INDONESIA" }),
      }),
    )

    expect(response.status).toBe(422)
    expect(mockBilling.chargeMonthly).not.toHaveBeenCalled()
  })

  it("returns 422 with VPN_PRICE_NOT_CONFIGURED when pricing is missing", async () => {
    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "MARS",
          planCode: "STANDARD",
        }),
      }),
    )

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toBe("VPN_PRICE_NOT_CONFIGURED")
    expect(mockBilling.chargeMonthly).not.toHaveBeenCalled()
  })

  it("returns 422 with VPN_PRICE_NOT_CONFIGURED when seed refs are missing", async () => {
    // Plan exists in the static catalog but the DB Package row is gone.
    mockPrisma.package.findUnique.mockResolvedValue(null)

    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: "INDONESIA",
          planCode: "STANDARD",
        }),
      }),
    )

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toBe("VPN_PRICE_NOT_CONFIGURED")
    expect(mockBilling.chargeMonthly).not.toHaveBeenCalled()
  })
})
