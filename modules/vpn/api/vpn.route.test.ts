import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

// ─── Mocks ──────────────────────────────────────────────────────────────
//
// Per AGENTS.md: never mock a sibling service module. We mock only the
// `vpnBilling` dep (injected via the route factory) so the test stays
// free of cross-file mock pollution. The default `VpnBillingService`
// inside the route is NOT constructed at module load — it is built
// lazily by the factory only when no `billing` dep is provided, so
// importing this file does not require a live DATABASE_URL.

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

beforeEach(() => {
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
  it("provisions vpn after monthly charge succeeds", async () => {
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
    // A subscription id is returned but the route does not persist
    // anything in MVP — that is the renewal worker's job (Task 3).
    expect(typeof body.subscriptionId).toBe("string")
    expect(body.subscriptionId.startsWith("vpn_sub_")).toBe(true)

    expect(mockBilling.chargeMonthly).toHaveBeenCalledTimes(1)
    expect(mockBilling.chargeMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        regionCode: "INDONESIA",
        amount: decimal("25000"),
        period: expect.stringMatching(/^\d{4}-\d{2}$/),
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
})
