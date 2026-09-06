mock.module("server-only", () => ({}))

import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

const mockRequireSuperAdmin = mock()

const mockBasePriceFindMany = mock()
const mockBasePriceUpdateMany = mock()
const mockBasePriceCreate = mock()

const mockQuotaRateFindMany = mock()
const mockQuotaRateUpdateMany = mock()
const mockQuotaRateCreate = mock()

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappBasePrice: {
      findMany: mockBasePriceFindMany,
      updateMany: mockBasePriceUpdateMany,
      create: mockBasePriceCreate,
    },
    whatsappQuotaCreditRate: {
      findMany: mockQuotaRateFindMany,
      updateMany: mockQuotaRateUpdateMany,
      create: mockQuotaRateCreate,
    },
  },
}))

// Dynamic import required so mock.module takes effect before module evaluation in Bun
const { adminWhatsappPricingRoutes } = await import("./admin-pricing.route")

describe("adminWhatsappPricingRoutes", () => {
  let app: { handle: (request: Request) => Promise<Response> }
  beforeEach(() => {
    app = new Elysia().use(adminWhatsappPricingRoutes)
    mockRequireSuperAdmin.mockReset()
    mockBasePriceFindMany.mockReset()
    mockBasePriceUpdateMany.mockReset()
    mockBasePriceCreate.mockReset()
    mockQuotaRateFindMany.mockReset()
    mockQuotaRateUpdateMany.mockReset()
    mockQuotaRateCreate.mockReset()

    mockRequireSuperAdmin.mockResolvedValue({
      ok: true,
      userId: "admin_user_1",
    })
  })

  describe("Guards", () => {
    it("returns 403 when user is not super admin", async () => {
      mockRequireSuperAdmin.mockImplementation(
        async (set: { status?: number }) => {
          set.status = 403
          return {
            ok: false,
            error: "FORBIDDEN",
            message: "Super admin required",
          }
        }
      )

      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/pricing/rates")
      )
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data).toEqual({
        ok: false,
        error: "FORBIDDEN",
        message: "Super admin required",
      })
    })
  })

  describe("GET /rates", () => {
    it("returns mapped quota rates and base prices", async () => {
      const now = new Date("2026-09-01T00:00:00.000Z")
      mockQuotaRateFindMany.mockResolvedValueOnce([
        {
          id: "qr_1",
          category: "MARKETING",
          country: "ID",
          quotaCredit: new Prisma.Decimal("1.5"),
          description: "Marketing rate",
          effectiveFrom: now,
          effectiveTo: null,
          isActive: true,
          createdAt: now,
        },
      ])
      mockBasePriceFindMany.mockResolvedValueOnce([
        {
          id: "bp_1",
          category: "MARKETING",
          country: "ID",
          basePrice: new Prisma.Decimal("450.00"),
          metaCost: new Prisma.Decimal("400.00"),
          currency: "IDR",
          effectiveFrom: now,
          effectiveTo: null,
          isActive: true,
          createdAt: now,
        },
      ])

      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/pricing/rates")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.quotaRates.length).toBe(1)
      expect(data.quotaRates[0].quotaCredit).toBe("1.5")
      expect(data.basePrices.length).toBe(1)
      expect(data.basePrices[0].basePrice).toBe("450")
    })
  })

  describe("POST /base-price", () => {
    it("returns 400 on invalid effectiveFrom date", async () => {
      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/pricing/base-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "MARKETING",
            country: "ID",
            basePrice: 500,
            effectiveFrom: "not-a-valid-date",
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ ok: false, error: "Invalid effectiveFrom date" })
    })

    it("updates previous active price and creates new base price", async () => {
      const now = new Date("2026-09-01T00:00:00.000Z")
      mockBasePriceUpdateMany.mockResolvedValueOnce({ count: 1 })
      mockBasePriceCreate.mockResolvedValueOnce({
        id: "bp_new",
        category: "UTILITY",
        country: "ID",
        basePrice: new Prisma.Decimal("200"),
        effectiveFrom: now,
      })

      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/pricing/base-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "UTILITY",
            country: "ID",
            basePrice: 200,
            effectiveFrom: "2026-09-01T00:00:00.000Z",
          }),
        })
      )
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockBasePriceUpdateMany).toHaveBeenCalledTimes(1)
      expect(mockBasePriceCreate).toHaveBeenCalledTimes(1)
    })
  })

  describe("POST /quota-rate", () => {
    it("returns 400 on invalid effectiveFrom date", async () => {
      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/pricing/quota-rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "MARKETING",
            country: "ID",
            quotaCredit: 2,
            effectiveFrom: "invalid-date",
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ ok: false, error: "Invalid effectiveFrom date" })
    })

    it("updates previous quota rate and creates new quota rate", async () => {
      mockQuotaRateUpdateMany.mockResolvedValueOnce({ count: 1 })
      mockQuotaRateCreate.mockResolvedValueOnce({
        id: "qr_new",
        category: "AUTHENTICATION",
        country: "ID",
        quotaCredit: new Prisma.Decimal("1.0"),
        isActive: true,
      })

      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/pricing/quota-rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "AUTHENTICATION",
            country: "ID",
            quotaCredit: 1.0,
            effectiveFrom: "2026-09-01T00:00:00.000Z",
          }),
        })
      )
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockQuotaRateUpdateMany).toHaveBeenCalledTimes(1)
      expect(mockQuotaRateCreate).toHaveBeenCalledTimes(1)
    })
  })
})
