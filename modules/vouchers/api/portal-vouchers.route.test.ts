import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { VoucherNotFoundError } from "../vouchers.errors"
import { createPortalVoucherRoutes } from "./portal-vouchers.route"

// Plain service object — tests override specific methods with mock()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDefaultService(): any {
  return {
    listVouchers: () => Promise.resolve({ vouchers: [], total: 0 }),
    getVoucherById: () => {
      throw new VoucherNotFoundError("v_1")
    },
    createVoucher: () => Promise.resolve({ id: "v_1", code: "TEST1234" }),
    updateVoucher: () => Promise.resolve({ id: "v_1" }),
    disableVoucher: () => Promise.resolve({ id: "v_1", status: "DISABLED" }),
    getVoucherClaims: () => Promise.resolve([]),
  }
}

function createDeps() {
  return {
    authenticate: () =>
      Promise.resolve({
        user: { id: "user_1", email: "admin@test.com" },
        organizationId: "org_1",
        role: "admin",
        roles: ["admin"],
      }),
    getPlatformRole: () => Promise.resolve("super_admin" as const),
    service: createDefaultService(),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toApp = (deps: any) => new Elysia().use(createPortalVoucherRoutes(deps))

describe("Portal Voucher Routes", () => {
  describe("GET /vouchers/portal", () => {
    it("returns 401 when unauthenticated", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.authenticate = mock(() =>
        Promise.resolve({
          user: null,
          organizationId: null,
          role: null,
          roles: null,
        })
      )

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal")
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 for non-admin users", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.getPlatformRole = mock(() => Promise.resolve("none" as const))
      deps.authenticate = mock(() =>
        Promise.resolve({
          user: { id: "user_1", email: "user@test.com" },
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
        })
      )

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal")
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns paginated voucher list for admins", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.listVouchers = mock(() =>
        Promise.resolve({
          vouchers: [
            {
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
            },
          ],
          total: 1,
        })
      )

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.total).toBe(1)
    })
  })

  describe("POST /vouchers/portal", () => {
    it("creates voucher with valid data", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.createVoucher = mock(() =>
        Promise.resolve({
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
        })
      )

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
        })
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
        })
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
        })
      )

      expect(res.status).toBe(422)
    })
  })

  describe("GET /vouchers/portal/:id", () => {
    it("returns voucher detail with claims", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.getVoucherById = mock(() =>
        Promise.resolve({
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
        })
      )

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal/v_1")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("returns 404 for nonexistent voucher", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/portal/nonexistent")
      )

      expect(res.status).toBe(404)
    })
  })

  describe("POST /vouchers/portal/:id/disable", () => {
    it("disables a voucher", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.disableVoucher = mock(() =>
        Promise.resolve({
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
          metadataJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      )

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal/v_1/disable", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.status).toBe("DISABLED")
    })
  })

  describe("GET /vouchers/portal/:id/claims", () => {
    it("returns claim history", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.getVoucherClaims = mock(() =>
        Promise.resolve([
          {
            id: "claim_1",
            voucherId: "v_1",
            workosUserId: "user_1",
            organizationId: "org_1",
            billingAdjustmentId: null,
            metadataJson: null,
            claimedAt: new Date(),
          },
        ])
      )

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal/v_1/claims")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })
})
