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
    createPromotion: () => Promise.resolve({ id: "v_1", code: "TEST1234" }),
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

    it("passes organizationId to listVouchers when provided in query", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.listVouchers = mock(async () => ({
        vouchers: [],
        total: 0,
      }))

      const res = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal?organizationId=org_1")
      )

      expect(res.status).toBe(200)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listVouchersArgs = (deps.service.listVouchers as any).mock
        .calls[0]?.[0]
      expect(listVouchersArgs?.organizationId).toBe("org_1")
    })

    it("passes kind to listVouchers for server-side type filtering", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.listVouchers = mock(async () => ({
        vouchers: [],
        total: 0,
      }))

      const response = await toApp(deps).handle(
        new Request("http://localhost/vouchers/portal?kind=PRODUCT_PROMOTION")
      )

      expect(response.status).toBe(200)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listVouchersArgs = (deps.service.listVouchers as any).mock
        .calls[0]?.[0]
      expect(listVouchersArgs?.kind).toBe("PRODUCT_PROMOTION")
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
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(typeof body.message).toBe("string")
      expect(body.message.length).toBeGreaterThan(0)
      expect(Object.keys(body.fieldErrors)).toContain("amount")
      expect(Object.keys(body.fieldErrors)).toContain("maxClaims")
      expect(Object.keys(body.fieldErrors)).toContain("expiresAt")
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
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(Array.isArray(body.fieldErrors.maxClaims)).toBe(true)
      expect(body.fieldErrors.maxClaims.length).toBeGreaterThan(0)
    })

    it("dispatches product promotions with their initial status", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      deps.service.createVoucher = mock(() => {
        throw new Error("balance-credit dispatcher should not be called")
      })
      deps.service.createPromotion = mock(() =>
        Promise.resolve({
          id: "promotion_1",
          code: "PROMO123",
          prefix: null,
          status: "DISABLED",
          kind: "PRODUCT_PROMOTION",
          maxClaims: 10,
          claimedCount: 0,
          expiresAt: new Date(Date.now() + 86400000),
          amount: { toFixed: () => "0.00" },
          currency: "IDR",
          discountType: "PERCENTAGE",
          discountValue: { toString: () => "15" },
          discountCurrency: null,
          currencyPolicy: "MATCH_CURRENCY_ONLY",
          firstCheckoutOnly: false,
          allowUpgrade: false,
          stackable: false,
          minimumOrderAmount: null,
          maximumDiscountAmount: null,
          allowedPackageCodes: ["VPN"],
          allowedPlanCodes: ["VPN_PRO"],
          allowedBillingPeriods: ["MONTHLY"],
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
            kind: "PRODUCT_PROMOTION",
            status: "DISABLED",
            maxClaims: 10,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            discountType: "PERCENTAGE",
            discountValue: 15,
            currencyPolicy: "MATCH_CURRENCY_ONLY",
            allowedPackageCodes: ["VPN"],
            allowedPlanCodes: ["VPN_PRO"],
            allowedBillingPeriods: ["MONTHLY"],
          }),
        })
      )

      expect(res.status).toBe(201)
      expect(deps.service.createVoucher).not.toHaveBeenCalled()
      expect(deps.service.createPromotion).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "PRODUCT_PROMOTION",
          status: "DISABLED",
          allowedPackageCodes: ["VPN"],
          allowedPlanCodes: ["VPN_PRO"],
          allowedBillingPeriods: ["MONTHLY"],
          createdByWorkosUserId: "user_1",
        })
      )
      const body = await res.json()
      expect(body.data.kind).toBe("PRODUCT_PROMOTION")
      expect(body.data.status).toBe("DISABLED")
    })

    it("maps product eligibility and expiry failures to fields", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "PRODUCT_PROMOTION",
            maxClaims: 1,
            expiresAt: new Date(Date.now() - 86400000).toISOString(),
            discountType: "PERCENTAGE",
            discountValue: 15,
            currencyPolicy: "MATCH_CURRENCY_ONLY",
            allowedPackageCodes: [],
            allowedBillingPeriods: [],
          }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.fieldErrors.expiresAt).toBeDefined()
      expect(body.fieldErrors.allowedPackageCodes).toBeDefined()
      expect(body.fieldErrors.allowedBillingPeriods).toBeDefined()
    })

    it("rejects incompatible product fallback fields", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "PRODUCT_PROMOTION",
            maxClaims: 1,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            discountType: "PERCENTAGE",
            discountValue: 15,
            currencyPolicy: "MATCH_CURRENCY_ONLY",
            allowedPackageCodes: ["VPN"],
            allowedBillingPeriods: ["MONTHLY"],
            amount: 10,
            currency: "IDR",
          }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.fieldErrors.amount).toBeDefined()
      expect(body.fieldErrors.currency).toBeDefined()
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

  describe("PATCH /vouchers/portal/:id", () => {
    it("updates voucher properties successfully", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deps = createDeps() as any
      const updateDate = new Date(Date.now() + 172800000)
      deps.service.updateVoucher = mock(() =>
        Promise.resolve({
          id: "v_1",
          code: "TEST1234",
          prefix: null,
          status: "ACTIVE",
          maxClaims: 20,
          claimedCount: 2,
          expiresAt: updateDate,
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
        new Request("http://localhost/vouchers/portal/v_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxClaims: 20,
            expiresAt: updateDate.toISOString(),
          }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.maxClaims).toBe(20)
      expect(deps.service.updateVoucher).toHaveBeenCalledWith(
        "v_1",
        expect.objectContaining({ maxClaims: 20 })
      )
    })

    it("returns 422 for invalid patch payload", async () => {
      const res = await toApp(createDeps()).handle(
        new Request("http://localhost/vouchers/portal/v_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxClaims: -5,
          }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })
  })
})
