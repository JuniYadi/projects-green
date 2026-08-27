import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { createAdminPromotionsRoutes } from "./promotions.route"
import { VoucherNotFoundError } from "@/modules/vouchers/vouchers.errors"

const mockRequireSuperAdmin = mock(async () => ({
  userId: "admin-1",
  role: "super_admin",
}))

const mockCreatePromotion = mock(() => Promise.resolve({}))
const mockListPromotions = mock(() =>
  Promise.resolve({ vouchers: [], total: 0 })
)
const mockGetVoucherById = mock(() => Promise.resolve(null))
const mockUpdatePromotion = mock(() => Promise.resolve({}))
const mockPublishVoucher = mock(() => Promise.resolve({}))
const mockDisablePromotionVoucher = mock(() => Promise.resolve({}))
const mockGetPromotionClaims = mock(() => Promise.resolve([]))

const mockService = {
  createPromotion: mockCreatePromotion,
  listPromotions: mockListPromotions,
  getVoucherById: mockGetVoucherById,
  updatePromotion: mockUpdatePromotion,
  publishVoucher: mockPublishVoucher,
  disablePromotionVoucher: mockDisablePromotionVoucher,
  getPromotionClaims: mockGetPromotionClaims,
} as unknown as never

const sampleVoucher = {
  id: "promo-1",
  code: "PROMO50",
  name: "50% Off",
  description: "Summer deal",
  discountType: "PERCENTAGE",
  discountValue: 50,
  amount: 0,
  currency: "IDR",
  discountCurrency: "IDR",
  currencyPolicy: "MATCH_CURRENCY_ONLY",
  firstCheckoutOnly: false,
  allowUpgrade: true,
  stackable: false,
  minimumOrderAmount: null,
  maximumDiscountAmount: null,
  allowedPackageCodes: ["APP_HOSTING"],
  allowedPlanCodes: null,
  allowedBillingPeriods: ["MONTHLY"],
  targetWorkosUserId: null,
  kind: "PROMOTION",
  status: "DRAFT",
  claimedCount: 0,
  maxClaims: 100,
  maxClaimsPerUser: 1,
  prefix: null,
  minOrderAmount: null,
  maxDiscountAmount: null,
  applicableProductCodes: [],
  startsAt: null,
  expiresAt: new Date("2029-12-31T00:00:00.000Z"),
  publishedAt: null,
  disabledAt: null,
  createdByWorkosUserId: "usr-admin",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
}

describe("admin promotions.route", () => {
  let app: Elysia

  beforeEach(() => {
    mockRequireSuperAdmin.mockClear()
    mockCreatePromotion.mockClear()
    mockListPromotions.mockClear()
    mockGetVoucherById.mockClear()
    mockUpdatePromotion.mockClear()
    mockPublishVoucher.mockClear()
    mockDisablePromotionVoucher.mockClear()
    mockGetPromotionClaims.mockClear()

    app = new Elysia().use(
      createAdminPromotionsRoutes({
        requireSuperAdmin: mockRequireSuperAdmin as unknown as never,
        service: mockService,
      })
    )
  })

  describe("GET /admin/promotions", () => {
    it("lists promotions with valid query parameters", async () => {
      mockListPromotions.mockResolvedValueOnce({
        vouchers: [sampleVoucher],
        total: 1,
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/admin/promotions")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.total).toBe(1)
    })
  })

  describe("GET /admin/promotions/:id", () => {
    it("returns 404 when promotion not found", async () => {
      mockGetVoucherById.mockRejectedValueOnce(
        new VoucherNotFoundError("promo-404")
      )

      const res = await app.handle(
        new Request("http://localhost/admin/promotions/promo-404")
      )

      expect(res.status).toBe(404)
    })

    it("returns promotion when found", async () => {
      mockGetVoucherById.mockResolvedValueOnce(
        sampleVoucher as unknown as never
      )

      const res = await app.handle(
        new Request("http://localhost/admin/promotions/promo-1")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.id).toBe("promo-1")
    })
  })

  describe("POST /admin/promotions", () => {
    it("creates a new promotion", async () => {
      mockCreatePromotion.mockResolvedValueOnce(
        sampleVoucher as unknown as never
      )

      const res = await app.handle(
        new Request("http://localhost/admin/promotions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: "PROMO50",
            kind: "PRODUCT_PROMOTION",
            currencyPolicy: "MATCH_CURRENCY_ONLY",
            discountCurrency: "IDR",
            discountType: "PERCENTAGE",
            discountValue: 50,
            maxClaims: 100,
            allowedPackageCodes: ["APP_HOSTING"],
            allowedBillingPeriods: ["MONTHLY"],
            expiresAt: "2029-12-31T00:00:00.000Z",
          }),
        })
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.id).toBe("promo-1")
    })
  })

  describe("PATCH /admin/promotions/:id", () => {
    it("updates promotion", async () => {
      mockUpdatePromotion.mockResolvedValueOnce({
        ...sampleVoucher,
        maxClaims: 200,
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/admin/promotions/promo-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            maxClaims: 200,
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("POST /admin/promotions/:id/publish", () => {
    it("publishes promotion", async () => {
      mockPublishVoucher.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PUBLISHED",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/admin/promotions/promo-1/publish", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("POST /admin/promotions/:id/disable", () => {
    it("disables promotion", async () => {
      mockDisablePromotionVoucher.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "DISABLED",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/admin/promotions/promo-1/disable", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("GET /admin/promotions/:id/claims", () => {
    it("lists claims for a promotion voucher", async () => {
      mockGetPromotionClaims.mockResolvedValueOnce([
        {
          id: "claim-1",
          voucherId: "promo-1",
          workosUserId: "usr-1",
          claimedAt: new Date(),
          voucher: sampleVoucher,
        },
      ] as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/admin/promotions/promo-1/claims")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data).toHaveLength(1)
    })
  })
})
