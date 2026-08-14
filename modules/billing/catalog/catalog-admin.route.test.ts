import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

import { createCatalogAdminRoutes } from "./catalog-admin.route"
import {
  CatalogPackageNotFoundError,
  CatalogPlanNotFoundError,
} from "./catalog-admin.service"

const guard = mock(async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))

const service = {
  upsertPackage: mock(async () => ({
    id: "pkg-1",
    code: "VPN",
    name: "VPN",
  })),
  upsertPlan: mock(async () => ({
    id: "plan-1",
    code: "VPN_BASIC",
    name: "Basic",
  })),
  upsertPlanPricing: mock(async () => ({
    id: "pricing-1",
    planId: "plan-1",
  })),
  upsertAddon: mock(async () => ({
    id: "addon-1",
    code: "EXTRA_IP",
    name: "Extra IP",
  })),
  upsertAddonPricing: mock(async () => ({
    id: "ap-1",
    addonId: "addon-1",
  })),
  upsertPlanAddonAttachment: mock(async () => ({
    id: "spa-1",
  })),
  publishProduct: mock(async () => ({
    id: "pkg-1",
    code: "VPN",
    name: "VPN",
  })),
}

function app() {
  return new Elysia()
    .use(
      createCatalogAdminRoutes({
        requireSuperAdmin: guard,
        service: service as never,
      })
    )
    .compile()
}

function json(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("catalog admin routes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    guard.mockResolvedValue({
      ok: true as const,
      userId: "admin-1",
      platformRole: "super_admin" as const,
    })
    service.upsertPackage.mockResolvedValue({
      id: "pkg-1",
      code: "VPN",
      name: "VPN",
    })
    service.upsertPlan.mockResolvedValue({
      id: "plan-1",
      code: "VPN_BASIC",
      name: "Basic",
    })
    service.upsertPlanPricing.mockResolvedValue({
      id: "pricing-1",
      planId: "plan-1",
    })
    service.upsertAddon.mockResolvedValue({
      id: "addon-1",
      code: "EXTRA_IP",
      name: "Extra IP",
    })
    service.upsertAddonPricing.mockResolvedValue({
      id: "ap-1",
      addonId: "addon-1",
    })
    service.publishProduct.mockResolvedValue({
      id: "pkg-1",
      code: "VPN",
      name: "VPN",
    })
  })

  // ─── Auth guards ────────────────────────────────────────────────────

  it("rejects unauthenticated requests", async () => {
    guard.mockImplementationOnce(async (set: { status?: number | string }) => {
      set.status = 401
      return {
        ok: false,
        error: "UNAUTHORIZED",
        message: "You must be signed in to perform this action.",
      } as never
    })

    const response = await app().handle(
      json("http://localhost/admin/catalog/products", {
        code: "VPN",
        name: "VPN",
      })
    )

    expect(response.status).toBe(401)
    expect(service.upsertPackage).not.toHaveBeenCalled()
  })

  it("rejects non-super-admin requests", async () => {
    guard.mockImplementationOnce(async (set: { status?: number | string }) => {
      set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "This action requires super admin access.",
      } as never
    })

    const response = await app().handle(
      json("http://localhost/admin/catalog/products", {
        code: "VPN",
        name: "VPN",
      })
    )

    expect(response.status).toBe(403)
    expect(service.upsertPackage).not.toHaveBeenCalled()
  })

  // ─── POST /admin/catalog/products ───────────────────────────────────

  describe("POST /admin/catalog/products", () => {
    it("upserts a product successfully", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/products", {
          code: "VPN",
          name: "VPN Service",
          description: "Virtual Private Network",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.code).toBe("VPN")
      expect(service.upsertPackage).toHaveBeenCalledWith(
        expect.objectContaining({ code: "VPN", name: "VPN Service" })
      )
    })

    it("rejects invalid input (missing name)", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/products", {
          code: "VPN",
        })
      )

      expect(response.status).toBe(422)
      expect(service.upsertPackage).not.toHaveBeenCalled()
    })
  })

  // ─── POST /admin/catalog/products/:code/plans ───────────────────────

  describe("POST /admin/catalog/products/:code/plans", () => {
    it("upserts a plan successfully", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/products/VPN/plans", {
          code: "VPN_BASIC",
          name: "Basic Plan",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(service.upsertPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          packageCode: "VPN",
          code: "VPN_BASIC",
        })
      )
    })

    it("returns 404 when package not found", async () => {
      service.upsertPlan.mockRejectedValueOnce(
        new CatalogPackageNotFoundError("MISSING")
      )

      const response = await app().handle(
        json("http://localhost/admin/catalog/products/MISSING/plans", {
          code: "PLAN_A",
          name: "Plan A",
        })
      )

      expect(response.status).toBe(404)
      expect((await response.json()).error).toBe("NOT_FOUND")
    })
  })

  // ─── POST /admin/catalog/products/:code/plans/:planId/pricing ───────

  describe("POST /admin/catalog/products/:code/plans/:planId/pricing", () => {
    it("upserts pricing successfully", async () => {
      const response = await app().handle(
        json(
          "http://localhost/admin/catalog/products/VPN/plans/plan-1/pricing",
          {
            regionId: "region-1",
            billingPeriod: "MONTHLY",
            chargeUnit: "SUBSCRIPTION",
            periodPrice: 150000,
            currency: "IDR",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
          }
        )
      )

      expect(response.status).toBe(200)
      expect(service.upsertPlanPricing).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: "plan-1",
          regionId: "region-1",
          currency: "IDR",
        })
      )
    })

    it("rejects invalid billing period", async () => {
      const response = await app().handle(
        json(
          "http://localhost/admin/catalog/products/VPN/plans/plan-1/pricing",
          {
            regionId: "region-1",
            billingPeriod: "WEEKLY",
            chargeUnit: "SUBSCRIPTION",
            periodPrice: 150000,
            currency: "IDR",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
          }
        )
      )

      expect(response.status).toBe(422)
      expect(service.upsertPlanPricing).not.toHaveBeenCalled()
    })

    it("returns 422 for inactive currency", async () => {
      service.upsertPlanPricing.mockRejectedValueOnce(
        new Error("Currency XYZ is inactive.")
      )

      const response = await app().handle(
        json(
          "http://localhost/admin/catalog/products/VPN/plans/plan-1/pricing",
          {
            regionId: "region-1",
            billingPeriod: "MONTHLY",
            chargeUnit: "SUBSCRIPTION",
            periodPrice: 100,
            currency: "XYZ",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
          }
        )
      )

      expect(response.status).toBe(422)
      expect((await response.json()).message).toContain("inactive")
    })
  })

  // ─── POST /admin/catalog/addons ─────────────────────────────────────

  describe("POST /admin/catalog/addons", () => {
    it("upserts an addon", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/addons", {
          code: "EXTRA_IP",
          name: "Extra IP",
          billingMode: "RECURRING",
        })
      )

      expect(response.status).toBe(200)
      expect(service.upsertAddon).toHaveBeenCalledWith(
        expect.objectContaining({ code: "EXTRA_IP" })
      )
    })
  })

  // ─── POST /admin/catalog/addons/:addonId/pricing ────────────────────

  describe("POST /admin/catalog/addons/:addonId/pricing", () => {
    it("upserts addon pricing", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/addons/addon-1/pricing", {
          billingPeriod: "MONTHLY",
          currency: "IDR",
          amount: 25000,
          effectiveFrom: "2026-01-01T00:00:00.000Z",
        })
      )

      expect(response.status).toBe(200)
      expect(service.upsertAddonPricing).toHaveBeenCalledWith(
        expect.objectContaining({
          addonId: "addon-1",
          currency: "IDR",
          amount: 25000,
        })
      )
    })
  })

  // ─── POST /admin/catalog/products/:code/publish ─────────────────────

  describe("POST /admin/catalog/products/:code/publish", () => {
    it("publishes a full product atomically", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/products/VPN/publish", {
          code: "VPN",
          name: "VPN Service",
          plans: [
            {
              code: "VPN_BASIC",
              name: "Basic",
              offers: [
                {
                  regionId: "region-1",
                  billingPeriod: "MONTHLY",
                  chargeUnit: "SUBSCRIPTION",
                  periodPrice: 150000,
                  currency: "IDR",
                  effectiveFrom: "2026-01-01T00:00:00.000Z",
                },
              ],
            },
          ],
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(service.publishProduct).toHaveBeenCalled()
    })

    it("rejects when body code mismatches URL param", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/products/VPN/publish", {
          code: "WHATSAPP",
          name: "WhatsApp",
          plans: [],
        })
      )

      expect(response.status).toBe(422)
      expect((await response.json()).message).toContain(
        "Body code must match URL param code"
      )
      expect(service.publishProduct).not.toHaveBeenCalled()
    })

    it("returns 404 when plan reference is invalid during publish", async () => {
      service.publishProduct.mockRejectedValueOnce(
        new CatalogPlanNotFoundError("NONEXISTENT")
      )

      const response = await app().handle(
        json("http://localhost/admin/catalog/products/VPN/publish", {
          code: "VPN",
          name: "VPN",
          plans: [
            {
              code: "VPN_BASIC",
              name: "Basic",
              offers: [
                {
                  regionId: "region-1",
                  billingPeriod: "MONTHLY",
                  chargeUnit: "SUBSCRIPTION",
                  periodPrice: 150000,
                  currency: "IDR",
                  effectiveFrom: "2026-01-01T00:00:00.000Z",
                },
              ],
            },
          ],
          addons: [
            {
              code: "EXTRA",
              name: "Extra",
              prices: [],
              planAttachments: [{ planCode: "NONEXISTENT" }],
            },
          ],
        })
      )

      expect(response.status).toBe(404)
      expect((await response.json()).error).toBe("NOT_FOUND")
    })

    it("returns 500 on unexpected error", async () => {
      service.publishProduct.mockRejectedValueOnce(new Error("database down"))

      const response = await app().handle(
        json("http://localhost/admin/catalog/products/VPN/publish", {
          code: "VPN",
          name: "VPN",
          plans: [],
        })
      )

      expect(response.status).toBe(500)
      expect((await response.json()).error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
