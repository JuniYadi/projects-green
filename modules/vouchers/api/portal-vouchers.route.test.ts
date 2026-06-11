import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { VoucherNotFoundError } from "../vouchers.errors"
import { createPortalVoucherRoutes } from "./portal-vouchers.route"

function createDeps() {
  return {
    authenticate: mock(() => ({
      user: { id: "user_1", email: "admin@test.com" },
      organizationId: "org_1",
      role: "admin",
      roles: ["admin"],
    })),
    getPlatformRole: mock(() => "super_admin" as const),
    service: {
      listVouchers: mock(() => ({ vouchers: [], total: 0 })),
      getVoucherById: mock(() => {
        throw new VoucherNotFoundError("v_1")
      }),
      createVoucher: mock(() => ({ id: "v_1", code: "TEST1234" })),
      updateVoucher: mock(() => ({ id: "v_1" })),
      disableVoucher: mock(() => ({ id: "v_1", status: "DISABLED" })),
      getVoucherClaims: mock(() => []),
    },
  }
}

const toApp = (deps: ReturnType<typeof createDeps>) =>
  new Elysia().use(createPortalVoucherRoutes(deps))

describe("Portal Voucher Routes", () => {
  describe("GET /vouchers/portal", () => {
    it("returns 401 when unauthenticated", async () => {
      const deps = createDeps()
      deps.authenticate = mock(() => ({ user: null }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal"),
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 for non-admin users", async () => {
      const deps = createDeps()
      deps.getPlatformRole = mock(() => "none" as const)
      deps.authenticate = mock(() => ({
        user: { id: "user_1", email: "user@test.com" },
        organizationId: "org_1",
        role: "member",
        roles: ["member"],
      }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal"),
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns paginated voucher list for admins", async () => {
      const deps = createDeps()
      deps.service.listVouchers = mock(() => ({
        vouchers: [{
          id: "v_1",
          code: "TEST1234",
          prefix: null,
          status: "ACTIVE",
          maxClaims: 10,
          claimedCount: 0,
          expiresAt: new Date(Date.now() + 86400000),
          amount: { toFixed: () => "50000" },
          currency: "IDR",
          targetWorkosUserId: null,
          targetOrganizationId: null,
          createdByWorkosUserId: "user_1",
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
        total: 1,
      }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal"),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.total).toBe(1)
    })
  })

  describe("POST /vouchers/portal", () => {
    it("creates voucher with valid data", async () => {
      const deps = createDeps()
      deps.service.createVoucher = mock(() => ({
        id: "v_1",
        code: "TEST1234",
        prefix: null,
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
        createdByWorkosUserId: "user_1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxClaims: 10,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            amount: 50000,
            currency: "IDR",
          }),
        }),
      )

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.code).toBe("TEST1234")
    })

    it("rejects missing required fields", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("rejects non-positive maxClaims", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxClaims: 0,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            amount: 50000,
          }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("GET /vouchers/portal/:id", () => {
    it("returns voucher detail with claims", async () => {
      const deps = createDeps()
      deps.service.getVoucherById = mock(() => ({
        id: "v_1",
        code: "TEST1234",
        prefix: null,
        status: "ACTIVE",
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
        createdByWorkosUserId: "user_1",
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        claims: [],
      }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal/v_1"),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("returns 404 for nonexistent voucher", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/portal/nonexistent"),
      )

      expect(res.status).toBe(404)
    })
  })

  describe("POST /vouchers/portal/:id/disable", () => {
    it("disables a voucher", async () => {
      const deps = createDeps()
      deps.service.disableVoucher = mock(() => ({
        id: "v_1",
        code: "TEST1234",
        status: "DISABLED",
        prefix: null,
        maxClaims: 10,
        claimedCount: 0,
        expiresAt: new Date(),
        amount: { toFixed: () => "50000" },
        currency: "IDR",
        targetWorkosUserId: null,
        targetOrganizationId: null,
        createdByWorkosUserId: "user_1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal/v_1/disable", {
          method: "POST",
        }),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.status).toBe("DISABLED")
    })
  })

  describe("GET /vouchers/portal/:id/claims", () => {
    it("returns claim history", async () => {
      const deps = createDeps()
      deps.service.getVoucherClaims = mock(() => [
        {
          id: "claim_1",
          voucherId: "v_1",
          workosUserId: "user_1",
          organizationId: "org_1",
          billingAdjustmentId: null,
          claimedAt: new Date(),
        },
      ])

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal/v_1/claims"),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })
})
