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
  servicePackage: { findUnique: mock() },
  servicePlan: { findUnique: mock() },
  serviceRegion: { findUnique: mock() },
  servicePricing: { findFirst: mock() },
  serviceSubscription: {
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
  revokeClient: mock(),
  healthCheck: mock(),
}

const mockVpnClients = {
  createActiveClient: mock(),
  createProvisioningFailure: mock(),
  getActiveClientsForOrganization: mock(),
  getDownloadForOrganization: mock(),
  markRevoked: mock(),
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
  mockPrisma.servicePackage.findUnique.mockReset()
  mockPrisma.servicePlan.findUnique.mockReset()
  mockPrisma.serviceRegion.findUnique.mockReset()
  mockPrisma.servicePricing.findFirst.mockReset()
  mockPrisma.serviceSubscription.findUnique.mockReset()
  mockPrisma.serviceSubscription.create.mockReset()
  mockPrisma.serviceSubscription.update.mockReset()
  mockPrisma.billingAccount.findUnique.mockReset()

  mockPrisma.servicePackage.findUnique.mockResolvedValue({ id: "pkg_vpn" })
  mockPrisma.servicePlan.findUnique.mockResolvedValue({ id: "plan_standard" })
  mockPrisma.serviceRegion.findUnique.mockResolvedValue({ id: "region_id" })
  mockPrisma.servicePricing.findFirst.mockResolvedValue({ id: "pricing_id" })
  mockPrisma.billingAccount.findUnique.mockResolvedValue({
    id: "ba_1",
    organizationId: "org_1",
    currency: "IDR",
    balance: decimal("500.00"),
  })

  // Default: no existing subscription (route will create)
  mockPrisma.serviceSubscription.findUnique.mockResolvedValue(null)
  mockPrisma.serviceSubscription.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: "sub_vpn_new",
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  )
  mockPrisma.serviceSubscription.update.mockImplementation(
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
  mockOpenVpn.revokeClient.mockReset()
  mockOpenVpn.healthCheck.mockReset()
  mockVpnClients.createActiveClient.mockReset()
  mockVpnClients.createProvisioningFailure.mockReset()
  mockVpnClients.getActiveClientsForOrganization.mockReset()
  mockVpnClients.getDownloadForOrganization.mockReset()
  mockVpnClients.markRevoked.mockReset()
  mockOpenVpn.createClient.mockResolvedValue(undefined)
  mockOpenVpn.fetchConfig.mockResolvedValue("client\nsecret\n")
  mockOpenVpn.revokeClient.mockResolvedValue(undefined)
  mockOpenVpn.healthCheck.mockResolvedValue({ ok: true, output: "active" })
  mockVpnClients.createActiveClient.mockResolvedValue({ id: "vpn_client_1" })
  mockVpnClients.getActiveClientsForOrganization.mockResolvedValue([
    {
      id: "vpn_client_1",
      organizationId: "org_1",
      clientName: "org_org_1_sub_vpn_new",
      status: "ACTIVE",
      regionCode: "INDONESIA",
      currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
    },
  ])
  mockVpnClients.getDownloadForOrganization.mockResolvedValue({
    fileName: "org_org_1_sub_vpn_new.ovpn",
    content: "client\nsecret\n",
  })
  mockVpnClients.markRevoked.mockResolvedValue({
    id: "vpn_client_1",
    clientName: "org_org_1_sub_vpn_new",
    status: "REVOKED",
  })
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

describe("GET /vpn/status", () => {
  it("returns active VPN clients for the authenticated organization without config content", async () => {
    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/status"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      ok: true,
      clients: [
        {
          id: "vpn_client_1",
          clientName: "org_org_1_sub_vpn_new",
          status: "ACTIVE",
          regionCode: "INDONESIA",
          currentPeriodStart: "2026-06-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        },
      ],
    })
    expect(JSON.stringify(body)).not.toContain("secret")
    expect(mockVpnClients.getActiveClientsForOrganization).toHaveBeenCalledWith(
      "org_1",
    )
  })
})

describe("GET /vpn/clients/:clientId/download", () => {
  it("returns ovpn as an attachment for the owning organization", async () => {
    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/clients/vpn_client_1/download"),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/x-openvpn-profile")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="org_org_1_sub_vpn_new.ovpn"',
    )
    expect(await response.text()).toBe("client\nsecret\n")
    expect(mockVpnClients.getDownloadForOrganization).toHaveBeenCalledWith({
      organizationId: "org_1",
      clientId: "vpn_client_1",
    })
  })
})

describe("POST /vpn/clients/:clientId/revoke", () => {
  it("revokes the OpenVPN client and marks metadata revoked", async () => {
    const app = createRoute()
    const response = await app.handle(
      new Request("http://localhost/clients/vpn_client_1/revoke", {
        method: "POST",
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true, clientId: "vpn_client_1", status: "REVOKED" })
    expect(mockOpenVpn.revokeClient).toHaveBeenCalledWith("org_org_1_sub_vpn_new")
    expect(mockVpnClients.markRevoked).toHaveBeenCalledWith({
      organizationId: "org_1",
      clientId: "vpn_client_1",
    })
  })
})

describe("GET /vpn/admin/health", () => {
  it("returns OpenVPN server health for portal admins", async () => {
    const app = createRoute({ ...validAuth, role: "admin", roles: ["admin"] })
    const response = await app.handle(new Request("http://localhost/admin/health"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, health: { ok: true, output: "active" } })
    expect(mockOpenVpn.healthCheck).toHaveBeenCalledTimes(1)
  })

  it("forbids non-admin health checks", async () => {
    const app = createRoute({ ...validAuth, role: "member", roles: ["member"] })
    const response = await app.handle(new Request("http://localhost/admin/health"))

    expect(response.status).toBe(403)
    expect(mockOpenVpn.healthCheck).not.toHaveBeenCalled()
  })
})

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
    expect(mockPrisma.serviceSubscription.create).toHaveBeenCalledWith(
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
    expect(mockPrisma.serviceSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub_vpn_new" },
        data: { status: "ACTIVE" },
      }),
    )
  })

  it("reuses existing ACTIVE subscription record", async () => {
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
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
    expect(mockPrisma.serviceSubscription.create).not.toHaveBeenCalled()
    // It shouldn't update status because it was already ACTIVE
    expect(mockPrisma.serviceSubscription.update).not.toHaveBeenCalled()
  })

  it("resets SUSPENDED subscription to SUSPENDED and retries charge (Issue 6)", async () => {
    mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
      id: "sub_vpn_suspended",
      organizationId: "org_1",
      packageId: "pkg_vpn",
      planId: "plan_standard",
      pricingId: "pricing_id",
      type: "BUNDLE",
      billingMode: "PACKAGE",
      status: "SUSPENDED",
      currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-30T00:00:00.000Z"),
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

    // Stale period triggers update with new dates only (no status change since already SUSPENDED)
    const updateCall = mockPrisma.serviceSubscription.update.mock.calls[0]?.[0]
    expect(updateCall).toMatchObject({
      where: { id: "sub_vpn_suspended" },
    })
    // data should contain currentPeriodStart but NOT status
    expect(updateCall.data.status).toBeUndefined()
    expect(updateCall.data.currentPeriodStart).toBeDefined()

    // Activates to ACTIVE after charge
    expect(mockPrisma.serviceSubscription.update).toHaveBeenNthCalledWith(
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
    expect(mockPrisma.serviceSubscription.create).toHaveBeenCalledTimes(1)
    // Subscription updated/left as SUSPENDED on failed charge
    expect(mockPrisma.serviceSubscription.update).toHaveBeenCalledWith(
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
    mockPrisma.servicePackage.findUnique.mockResolvedValue(null)

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
