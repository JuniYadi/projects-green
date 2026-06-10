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
  billingAccount: {
    findUnique: mock(),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => validAuth),
}))

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

const mockOpenVpn = {
  createClient: mock(),
  fetchConfig: mock(),
}

const mockVpnClients = {
  createActiveClient: mock(),
  createProvisioningFailure: mock(),
}

const createRoute = (
  auth: VpnAuthContext = validAuth,
  billing = mockBilling,
) =>
  createVpnRoutes({
    authenticate: async () => auth,
    billing,
    openVpn: mockOpenVpn,
    vpnClients: mockVpnClients,
  })

const setupPrismaDefaults = () => {
  mockPrisma.package.findUnique.mockReset()
  mockPrisma.servicePlan.findUnique.mockReset()
  mockPrisma.region.findUnique.mockReset()
  mockPrisma.pricing.findFirst.mockReset()
  mockPrisma.subscription.findUnique.mockReset()
  mockPrisma.subscription.create.mockReset()
  mockPrisma.subscription.update.mockReset()
  mockPrisma.billingAccount.findUnique.mockReset()

  mockPrisma.package.findUnique.mockResolvedValue({ id: "pkg_vpn" })
  mockPrisma.servicePlan.findUnique.mockResolvedValue({ id: "plan_standard" })
  mockPrisma.region.findUnique.mockResolvedValue({ id: "region_id" })
  mockPrisma.pricing.findFirst.mockResolvedValue({ id: "pricing_id" })
  mockPrisma.billingAccount.findUnique.mockResolvedValue({
    id: "ba_1",
    organizationId: "org_1",
    currency: "IDR",
    balance: decimal("500.00"),
  })

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
  mockOpenVpn.createClient.mockReset()
  mockOpenVpn.fetchConfig.mockReset()
  mockVpnClients.createActiveClient.mockReset()
  mockVpnClients.createProvisioningFailure.mockReset()
  mockOpenVpn.createClient.mockResolvedValue(undefined)
  mockOpenVpn.fetchConfig.mockResolvedValue("client\nsecret\n")
  mockVpnClients.createActiveClient.mockResolvedValue({ id: "vpn_client_1" })
  mockVpnClients.createProvisioningFailure.mockResolvedValue({
    id: "vpn_client_failed",
    status: "PROVISIONING_FAILED",
  })
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
  it("default route factory uses WorkOS auth instead of anonymous auth", async () => {
    const app = createVpnRoutes({
      billing: mockBilling,
      openVpn: mockOpenVpn,
      vpnClients: mockVpnClients,
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

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.organizationId).toBe("org_1")
  })

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
    expect(body.monthlyPrice).toBe("25000.00") // Issue 8: consistent decimal formatting
    expect(body.monthlyPriceMinor).toBe(25000)
    expect(body.currency).toBe("IDR")
    expect(body.period).toMatch(/^\d{4}-\d{2}$/)
    expect(body.topupUrl).toBe("/console/billing/topup")
    expect(body.subscriptionId).toBe("sub_vpn_new")
    expect(body.vpnClientId).toBe("vpn_client_1")

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

    // Issue 1: subscription created first as SUSPENDED (acting as pending payment)
    expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org_1",
          packageId: "pkg_vpn",
          planId: "plan_standard",
          pricingId: "pricing_id",
          type: "BUNDLE",
          billingMode: "PACKAGE",
          status: "SUSPENDED",
        }),
      }),
    )

    expect(mockOpenVpn.createClient).toHaveBeenCalledWith("org_org_1_sub_vpn_new")
    expect(mockOpenVpn.fetchConfig).toHaveBeenCalledWith("org_org_1_sub_vpn_new")
    expect(mockVpnClients.createActiveClient).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        subscriptionId: "sub_vpn_new",
        clientName: "org_org_1_sub_vpn_new",
        createdBy: "user-1",
        ovpnConfig: "client\nsecret\n",
      }),
    )

    // Issue 1: updated to ACTIVE after charge and provisioning succeed
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub_vpn_new" },
        data: { status: "ACTIVE" },
      }),
    )
  })

  it("reuses existing ACTIVE subscription record", async () => {
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
    // It shouldn't update status because it was already ACTIVE
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled()
  })

  it("resets SUSPENDED subscription to SUSPENDED and retries charge (Issue 6)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub_vpn_suspended",
      organizationId: "org_1",
      packageId: "pkg_vpn",
      planId: "plan_standard",
      pricingId: "pricing_id",
      type: "BUNDLE",
      billingMode: "PACKAGE",
      status: "SUSPENDED",
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
    expect(body.subscriptionId).toBe("sub_vpn_suspended")
    
    // Resets/updates period first (keeping status: SUSPENDED during charge)
    expect(mockPrisma.subscription.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "sub_vpn_suspended" },
        data: expect.objectContaining({ status: "SUSPENDED" }),
      }),
    )

    // Activates to ACTIVE after charge
    expect(mockPrisma.subscription.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "sub_vpn_suspended" },
        data: { status: "ACTIVE" },
      }),
    )
  })

  it("suspends PENDING subscription when upfront charge fails with 402 (Issue 1)", async () => {
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
    expect(mockOpenVpn.createClient).not.toHaveBeenCalled()
    expect(mockOpenVpn.fetchConfig).not.toHaveBeenCalled()
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INSUFFICIENT_BALANCE")

    // Subscription created first as SUSPENDED
    expect(mockPrisma.subscription.create).toHaveBeenCalledTimes(1)
    // Subscription updated/left as SUSPENDED on failed charge
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub_vpn_new" },
        data: expect.objectContaining({ status: "SUSPENDED" }),
      }),
    )
  })

  it("records provisioning failure after billing succeeds when adapter fails", async () => {
    mockOpenVpn.createClient.mockRejectedValue(new Error("ssh failed"))

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

    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VPN_PROVISIONING_FAILED")
    expect(body.message).not.toContain("ssh failed")
    expect(mockBilling.chargeMonthly).toHaveBeenCalledTimes(1)
    expect(mockVpnClients.createProvisioningFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        subscriptionId: "sub_vpn_new",
        clientName: "org_org_1_sub_vpn_new",
        createdBy: "user-1",
        reason: "ssh failed",
      }),
    )
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

  it("uses the account currency when resolving price (Issue 5)", async () => {
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba_1",
      organizationId: "org_1",
      currency: "USD",
      balance: decimal("100.00"),
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
    // 25000 / 16000 = 1.5625
    expect(body.monthlyPrice).toBe("1.5625")
    expect(body.monthlyPriceMinor).toBe(156)
    expect(body.currency).toBe("USD")

    expect(mockPrisma.billingAccount.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
    })
  })
})
