import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { createCatalogAdminRoutes } from "./catalog-admin.route"
import {
  CatalogPackageNotFoundError,
  CatalogPlanNotFoundError,
  CatalogPlanReferencedError,
  CatalogRegionNotFoundError,
} from "./catalog-admin.service"
import type {
  AdminActorContext,
  AdminApiError,
  RouteSet,
} from "@/modules/admin/api/admin.guards"

const guard = mock<
  (set: RouteSet) => Promise<AdminActorContext | AdminApiError>
>(async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))

const service = {
  getProduct: mock(async () => ({
    currency: "IDR",
    product: {
      code: "VPN",
      name: "VPN",
      description: null,
      isActive: true,
      plans: [],
    },
  })),
  getCatalogPlan: mock<() => Promise<unknown>>(async () => null),
  deleteCatalogPlan: mock<() => Promise<void>>(async () => {}),
  listCatalogPlans: mock<() => Promise<unknown[]>>(async () => []),
  listAllPackages: mock<() => Promise<unknown[]>>(async () => []),
  upsertPackage: mock(async () => ({
    id: "pkg-1",
    code: "VPN",
    name: "VPN",
  })),
  upsertPlan: mock(async () => ({
    id: "plan-1",
    code: "VPN_BASIC",
    name: "Basic Plan",
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
  exportCatalog: mock(async (catalogCode: string) => ({
    schemaVersion: "2026-08.1",
    catalogCode,
    catalogName: "Test Catalog",
    exportedAt: new Date().toISOString(),
    sourceEnv: "development",
    products: [],
    addons: [],
  })),
  importCatalog: mock(async () => ({
    ok: true,
    catalogCode: "WHATSAPP",
    dryRun: false,
    summary: {
      productsToCreate: 1,
      productsToUpdate: 0,
      productsUnchanged: 0,
      addonsToCreate: 0,
      addonsToUpdate: 0,
      addonsUnchanged: 0,
      totalProcessed: 1,
    },
    diffs: { products: [], addons: [] },
    warnings: [],
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
    service.getProduct.mockResolvedValue({
      currency: "IDR",
      product: {
        code: "VPN",
        name: "VPN",
        description: null,
        isActive: true,
        plans: [],
      },
    })
  })

  describe("GET /admin/catalog/products", () => {
    it("returns all admin catalog packages", async () => {
      service.listAllPackages.mockResolvedValueOnce([
        {
          code: "WHATSAPP",
          name: "WhatsApp",
          description: null,
          isActive: true,
          plans: [],
        },
      ])

      const response = await app().handle(
        new Request("http://localhost/admin/catalog/products")
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        ok: true,
        products: [{ code: "WHATSAPP" }],
      })
      expect(service.listAllPackages).toHaveBeenCalled()
    })
  })

  describe("GET /admin/catalog/products/:code", () => {
    it("returns an admin product including plans without offers", async () => {
      const response = await app().handle(
        new Request("http://localhost/admin/catalog/products/VPN")
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        ok: true,
        currency: "IDR",
        product: { code: "VPN" },
      })
      expect(service.getProduct).toHaveBeenCalledWith("VPN")
    })

    it("returns 404 when the product does not exist", async () => {
      service.getProduct.mockResolvedValueOnce(null as never)

      const response = await app().handle(
        new Request("http://localhost/admin/catalog/products/MISSING")
      )

      expect(response.status).toBe(404)
      expect((await response.json()).error).toBe("NOT_FOUND")
    })
  })

  describe("GET /admin/catalog/:catalogCode/products", () => {
    it("returns list of products under a catalog category", async () => {
      service.listCatalogPlans.mockResolvedValueOnce([
        {
          id: "plan-1",
          code: "STARTER",
          name: "Starter",
          resources: { cpu: 1, memory: 2048 },
          billingStrategy: "FIXED_CYCLE",
          stockControl: "TRACKED",
          stockCount: 5,
          allowBackorder: false,
          isActive: true,
          offers: [],
        },
      ])

      const response = await app().handle(
        new Request("http://localhost/admin/catalog/APP_HOSTING/products")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.products).toHaveLength(1)
      expect(body.products[0].code).toBe("STARTER")
      expect(service.listCatalogPlans).toHaveBeenCalledWith("APP_HOSTING")
    })
  })

  describe("GET /admin/catalog/:catalogCode/products/:productCode", () => {
    it("returns detail for a specific product", async () => {
      service.getCatalogPlan.mockResolvedValueOnce({
        id: "plan-1",
        code: "STARTER",
        name: "Starter",
        resources: { cpu: 1, memory: 2048 },
        billingStrategy: "FIXED_CYCLE",
        stockControl: "TRACKED",
        stockCount: 5,
        allowBackorder: false,
        isActive: true,
        offers: [],
      })

      const response = await app().handle(
        new Request(
          "http://localhost/admin/catalog/APP_HOSTING/products/STARTER"
        )
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.product.code).toBe("STARTER")
      expect(service.getCatalogPlan).toHaveBeenCalledWith(
        "APP_HOSTING",
        "STARTER"
      )
    })

    it("returns 404 when product is not found", async () => {
      service.getCatalogPlan.mockResolvedValueOnce(null)

      const response = await app().handle(
        new Request(
          "http://localhost/admin/catalog/APP_HOSTING/products/NONEXISTENT"
        )
      )

      expect(response.status).toBe(404)
      expect((await response.json()).error).toBe("NOT_FOUND")
    })
  })

  describe("POST /admin/catalog/:catalogCode/products/:productCode", () => {
    it("upserts product successfully", async () => {
      service.upsertPlan.mockResolvedValueOnce({
        id: "plan-1",
        code: "STARTER",
        name: "Starter Plan",
      })

      const response = await app().handle(
        json("http://localhost/admin/catalog/APP_HOSTING/products/STARTER", {
          name: "Starter Plan",
          billingStrategy: "FIXED_CYCLE",
          stockControl: "TRACKED",
          stockCount: 10,
          allowBackorder: false,
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.code).toBe("STARTER")
      expect(service.upsertPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          packageCode: "APP_HOSTING",
          code: "STARTER",
          name: "Starter Plan",
        })
      )
    })

    it("rejects invalid input schema", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/APP_HOSTING/products/STARTER", {
          name: "",
        })
      )

      expect(response.status).toBe(422)
      expect(service.upsertPlan).not.toHaveBeenCalled()
    })
  })

  describe("DELETE /admin/catalog/:catalogCode/products/:productCode", () => {
    it("deletes unreferenced product successfully", async () => {
      service.deleteCatalogPlan.mockResolvedValueOnce(undefined)

      const response = await app().handle(
        new Request("http://localhost/admin/catalog/VPN/products/BASIC", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(service.deleteCatalogPlan).toHaveBeenCalledWith("VPN", "BASIC")
    })

    it("returns 409 conflict when product has subscription references", async () => {
      service.deleteCatalogPlan.mockRejectedValueOnce(
        new CatalogPlanReferencedError("BASIC", 2)
      )

      const response = await app().handle(
        new Request("http://localhost/admin/catalog/VPN/products/BASIC", {
          method: "DELETE",
        })
      )
      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CANNOT_DELETE_REFERENCED_PRODUCT")
    })
  })

  // ─── Auth guards ────────────────────────────────────────────────────

  it("rejects unauthenticated requests", async () => {
    guard.mockImplementationOnce(async (set) => {
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
    guard.mockImplementationOnce(async (set) => {
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

    it("rejects a pricing range that ends on its start date", async () => {
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
            effectiveTo: "2026-01-01T00:00:00.000Z",
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

    it("rejects an addon pricing range that ends before it starts", async () => {
      const response = await app().handle(
        json("http://localhost/admin/catalog/addons/addon-1/pricing", {
          billingPeriod: "MONTHLY",
          currency: "IDR",
          amount: 25000,
          effectiveFrom: "2026-02-01T00:00:00.000Z",
          effectiveTo: "2026-01-01T00:00:00.000Z",
        })
      )

      expect(response.status).toBe(422)
      expect(service.upsertAddonPricing).not.toHaveBeenCalled()
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

    it("leaves an omitted offer region for the service to resolve", async () => {
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
      expect(service.publishProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          plans: [
            expect.objectContaining({
              offers: [expect.objectContaining({ regionId: undefined })],
            }),
          ],
        })
      )
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

    it("rejects a published offer with an invalid effective date range", async () => {
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
                  billingPeriod: "MONTHLY",
                  chargeUnit: "SUBSCRIPTION",
                  periodPrice: 150000,
                  currency: "IDR",
                  effectiveFrom: "2026-02-01T00:00:00.000Z",
                  effectiveTo: "2026-01-01T00:00:00.000Z",
                },
              ],
            },
          ],
        })
      )

      expect(response.status).toBe(422)
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

    it("returns 422 when no active region can price an offer", async () => {
      service.publishProduct.mockRejectedValueOnce(
        new CatalogRegionNotFoundError()
      )

      const response = await app().handle(
        json("http://localhost/admin/catalog/products/VPN/publish", {
          code: "VPN",
          name: "VPN",
          plans: [],
        })
      )

      expect(response.status).toBe(422)
      expect((await response.json()).message).toContain("No region available")
    })
  })

  describe("GET /admin/catalog/:catalogCode/export", () => {
    it("returns exported catalog configuration", async () => {
      const response = await app().handle(
        new Request("http://localhost/admin/catalog/WHATSAPP/export")
      )
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.catalogCode).toBe("WHATSAPP")
      expect(service.exportCatalog).toHaveBeenCalledWith("WHATSAPP")
    })
  })

  describe("POST /admin/catalog/:catalogCode/import", () => {
    it("validates payload and imports catalog", async () => {
      const payload = {
        schemaVersion: "2026-08.1",
        catalogCode: "WHATSAPP",
        catalogName: "WhatsApp",
        exportedAt: new Date().toISOString(),
        sourceEnv: "development",
        products: [
          {
            code: "WA_PRO",
            name: "Pro",
            resources: {},
            billingStrategy: "FIXED_CYCLE",
            stockControl: "UNLIMITED",
            allowBackorder: false,
            isActive: true,
            offers: [
              {
                billingPeriod: "MONTHLY",
                chargeUnit: "SUBSCRIPTION",
                periodPrice: 100000,
                currency: "IDR",
                isActive: true,
              },
            ],
          },
        ],
        addons: [],
      }

      const response = await app().handle(
        json("http://localhost/admin/catalog/WHATSAPP/import", {
          payload,
          options: { dryRun: true },
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(service.importCatalog).toHaveBeenCalled()
    })
  })
})
