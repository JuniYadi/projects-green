import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

import {
  CatalogAdminService,
  CatalogPackageNotFoundError,
  CatalogPlanNotFoundError,
  CatalogRegionNotFoundError,
} from "./catalog-admin.service"

type MockFunction = (...args: unknown[]) => unknown

const mockCurrency = mock<() => Promise<unknown>>(async () => ({
  isActive: true,
  code: "IDR",
  ratePerBase: new Prisma.Decimal("16000"),
}))
const mockConvert = mock(
  async (amount: number | Prisma.Decimal, _from: string, _to: string) =>
    new Prisma.Decimal(amount.toString())
)

const db = {
  servicePackage: {
    findFirst: mock<MockFunction>(() => null),
    create: mock<MockFunction>(() => ({
      id: "pkg-1",
      code: "VPN",
      name: "VPN",
    })),
    update: mock<MockFunction>(() => ({
      id: "pkg-1",
      code: "VPN",
      name: "VPN Updated",
    })),
  },
  servicePlan: {
    findFirst: mock<MockFunction>(() => null),
    create: mock<MockFunction>(() => ({
      id: "plan-1",
      code: "VPN_BASIC",
      name: "Basic",
    })),
    update: mock<MockFunction>(() => ({
      id: "plan-1",
      code: "VPN_BASIC",
      name: "Basic Updated",
    })),
  },
  servicePricing: {
    findFirst: mock<MockFunction>(() => null),
    create: mock<MockFunction>(() => ({
      id: "pricing-1",
      planId: "plan-1",
      regionId: "region-1",
    })),
    update: mock<MockFunction>(() => ({
      id: "pricing-1",
      planId: "plan-1",
      regionId: "region-1",
    })),
  },
  serviceAddon: {
    findFirst: mock<MockFunction>(() => null),
    create: mock<MockFunction>(() => ({
      id: "addon-1",
      code: "EXTRA_IP",
      name: "Extra IP",
    })),
    update: mock<MockFunction>(() => ({
      id: "addon-1",
      code: "EXTRA_IP",
      name: "Extra IP Updated",
    })),
  },
  serviceAddonPricing: {
    findFirst: mock<MockFunction>(() => null),
    create: mock<MockFunction>(() => ({ id: "ap-1", addonId: "addon-1" })),
    update: mock<MockFunction>(() => ({ id: "ap-1", addonId: "addon-1" })),
  },
  servicePlanAddon: {
    findFirst: mock<MockFunction>(() => null),
    create: mock<MockFunction>(() => ({
      id: "spa-1",
      planId: "plan-1",
      addonId: "addon-1",
    })),
    update: mock<MockFunction>(() => ({
      id: "spa-1",
      planId: "plan-1",
      addonId: "addon-1",
    })),
  },
  serviceRegion: {
    findFirst: mock<MockFunction>(() => ({
      id: "region-1",
      code: "ID",
      isActive: true,
    })),
  },
  $transaction: mock(async (fn: (tx: typeof db) => unknown) => fn(db)),
}

function createService() {
  return new CatalogAdminService({
    prisma: db as never,
    currencyService: {
      getByCode: mockCurrency,
      convert: mockConvert,
    } as never,
  })
}

describe("CatalogAdminService", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockCurrency.mockResolvedValue({
      isActive: true,
      code: "IDR",
      ratePerBase: new Prisma.Decimal("16000"),
    })
    mockConvert.mockImplementation(
      async (amount: number | Prisma.Decimal) =>
        new Prisma.Decimal(amount.toString())
    )
    db.servicePackage.findFirst.mockReturnValue(null)
    db.servicePlan.findFirst.mockReturnValue(null)
    db.servicePricing.findFirst.mockReturnValue(null)
    db.serviceAddon.findFirst.mockReturnValue(null)
    db.serviceAddonPricing.findFirst.mockReturnValue(null)
    db.servicePlanAddon.findFirst.mockReturnValue(null)
    db.serviceRegion.findFirst.mockReturnValue({
      id: "region-1",
      code: "ID",
      isActive: true,
    })
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn(db)
    )
  })

  describe("getProduct", () => {
    it("returns active plans even when a plan has no offers", async () => {
      db.servicePackage.findFirst.mockReturnValueOnce({
        id: "pkg-1",
        code: "VPN",
        name: "VPN",
        description: "VPN product",
        isActive: true,
        plans: [
          {
            id: "plan-1",
            code: "VPN_PACKAGE_1",
            name: "Business VPN",
            resources: {},
            pricings: [],
          },
        ],
      })

      const result = await createService().getProduct("VPN")

      expect(result).toMatchObject({
        currency: "IDR",
        product: {
          code: "VPN",
          plans: [
            expect.objectContaining({
              id: "plan-1",
              code: "VPN_PACKAGE_1",
              offers: [],
            }),
          ],
        },
      })
    })
  })

  // ─── upsertPackage ──────────────────────────────────────────────────

  describe("upsertPackage", () => {
    it("creates a new package when none exists", async () => {
      db.servicePackage.create.mockReturnValue({
        id: "pkg-1",
        code: "VPN",
        name: "VPN Service",
      })

      const service = createService()
      const result = await service.upsertPackage({
        code: "VPN",
        name: "VPN Service",
      })

      expect(result.code).toBe("VPN")
      expect(db.servicePackage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: "VPN", name: "VPN Service" }),
        })
      )
    })

    it("updates an existing package", async () => {
      db.servicePackage.findFirst.mockReturnValue({
        id: "pkg-1",
        code: "VPN",
        name: "VPN Old",
        description: "old desc",
        isActive: true,
      })
      db.servicePackage.update.mockReturnValue({
        id: "pkg-1",
        code: "VPN",
        name: "VPN New",
      })

      const service = createService()
      const result = await service.upsertPackage({
        code: "VPN",
        name: "VPN New",
      })

      expect(result.name).toBe("VPN New")
      expect(db.servicePackage.update).toHaveBeenCalled()
      expect(db.servicePackage.create).not.toHaveBeenCalled()
    })
  })

  // ─── upsertPlan ─────────────────────────────────────────────────────

  describe("upsertPlan", () => {
    it("creates a new plan under an existing package", async () => {
      db.servicePackage.findFirst.mockReturnValue({ id: "pkg-1" })
      db.servicePlan.create.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "Basic",
      })

      const service = createService()
      const result = await service.upsertPlan({
        packageCode: "VPN",
        code: "VPN_BASIC",
        name: "Basic",
      })

      expect(result.code).toBe("VPN_BASIC")
      expect(db.servicePlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            packageId: "pkg-1",
            code: "VPN_BASIC",
          }),
        })
      )
    })

    it("throws CatalogPackageNotFoundError when package is missing", async () => {
      db.servicePackage.findFirst.mockReturnValue(null)

      const service = createService()
      await expect(
        service.upsertPlan({
          packageCode: "MISSING",
          code: "PLAN_A",
          name: "Plan A",
        })
      ).rejects.toThrow(CatalogPackageNotFoundError)
    })

    it("updates an existing plan", async () => {
      db.servicePackage.findFirst.mockReturnValue({ id: "pkg-1" })
      db.servicePlan.findFirst.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "Old Name",
        resources: {},
        isActive: true,
      })
      db.servicePlan.update.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "New Name",
      })

      const service = createService()
      const result = await service.upsertPlan({
        packageCode: "VPN",
        code: "VPN_BASIC",
        name: "New Name",
      })

      expect(result.name).toBe("New Name")
      expect(db.servicePlan.update).toHaveBeenCalled()
      expect(db.servicePlan.create).not.toHaveBeenCalled()
    })
  })

  // ─── upsertPlanPricing ──────────────────────────────────────────────

  describe("upsertPlanPricing", () => {
    it("creates new pricing with IDR (no conversion needed)", async () => {
      db.servicePricing.create.mockReturnValue({
        id: "pricing-1",
        basePriceIdr: new Prisma.Decimal("150000"),
      })

      const service = createService()
      await service.upsertPlanPricing({
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: 150000,
        currency: "IDR",
        effectiveFrom: new Date("2026-01-01"),
      })

      expect(mockConvert).not.toHaveBeenCalled()
      expect(db.servicePricing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            basePriceIdr: new Prisma.Decimal("150000"),
            periodPrice: new Prisma.Decimal("150000"),
            currency: "IDR",
          }),
        })
      )
    })

    it("converts USD to IDR for basePriceIdr", async () => {
      mockConvert.mockResolvedValueOnce(new Prisma.Decimal("160000"))
      db.servicePricing.create.mockReturnValue({
        id: "pricing-1",
        basePriceIdr: new Prisma.Decimal("160000"),
      })

      const service = createService()
      await service.upsertPlanPricing({
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: 10,
        currency: "USD",
        effectiveFrom: new Date("2026-01-01"),
      })

      expect(mockConvert).toHaveBeenCalledWith(10, "USD", "IDR")
      expect(db.servicePricing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            basePriceIdr: new Prisma.Decimal("160000"),
            periodPrice: new Prisma.Decimal("10"),
            currency: "USD",
          }),
        })
      )
    })

    it("updates existing pricing at the same identity", async () => {
      db.servicePricing.findFirst.mockReturnValue({
        id: "pricing-1",
        planId: "plan-1",
        regionId: "region-1",
      })
      db.servicePricing.update.mockReturnValue({ id: "pricing-1" })

      const service = createService()
      await service.upsertPlanPricing({
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: 200000,
        currency: "IDR",
        effectiveFrom: new Date("2026-01-01"),
      })

      expect(db.servicePricing.update).toHaveBeenCalled()
      expect(db.servicePricing.create).not.toHaveBeenCalled()
    })

    it("rejects inactive currency", async () => {
      mockCurrency.mockResolvedValueOnce({ isActive: false, code: "XYZ" })

      const service = createService()
      await expect(
        service.upsertPlanPricing({
          planId: "plan-1",
          regionId: "region-1",
          billingPeriod: "MONTHLY",
          chargeUnit: "SUBSCRIPTION",
          periodPrice: 100,
          currency: "XYZ",
          effectiveFrom: new Date("2026-01-01"),
        })
      ).rejects.toThrow("Currency XYZ is inactive")
    })
  })

  // ─── upsertAddon ───────────────────────────────────────────────────

  describe("upsertAddon", () => {
    it("creates a new addon", async () => {
      db.serviceAddon.create.mockReturnValue({
        id: "addon-1",
        code: "EXTRA_IP",
        name: "Extra IP",
      })

      const service = createService()
      const result = await service.upsertAddon({
        code: "EXTRA_IP",
        name: "Extra IP",
        billingMode: "RECURRING",
      })

      expect(result.code).toBe("EXTRA_IP")
      expect(db.serviceAddon.create).toHaveBeenCalled()
    })

    it("updates an existing addon", async () => {
      db.serviceAddon.findFirst.mockReturnValue({
        id: "addon-1",
        code: "EXTRA_IP",
        name: "Old Name",
        description: null,
        billingMode: "RECURRING",
        isActive: true,
      })
      db.serviceAddon.update.mockReturnValue({
        id: "addon-1",
        code: "EXTRA_IP",
        name: "New Name",
      })

      const service = createService()
      const result = await service.upsertAddon({
        code: "EXTRA_IP",
        name: "New Name",
      })

      expect(result.name).toBe("New Name")
      expect(db.serviceAddon.update).toHaveBeenCalled()
    })
  })

  // ─── upsertAddonPricing ────────────────────────────────────────────

  describe("upsertAddonPricing", () => {
    it("creates addon pricing", async () => {
      db.serviceAddonPricing.create.mockReturnValue({
        id: "ap-1",
        amount: new Prisma.Decimal("25000"),
      })

      const service = createService()
      await service.upsertAddonPricing({
        addonId: "addon-1",
        billingPeriod: "MONTHLY",
        currency: "IDR",
        amount: 25000,
        effectiveFrom: new Date("2026-01-01"),
      })

      expect(db.serviceAddonPricing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            addonId: "addon-1",
            amount: new Prisma.Decimal("25000"),
          }),
        })
      )
    })

    it("updates existing addon pricing", async () => {
      db.serviceAddonPricing.findFirst.mockReturnValue({
        id: "ap-1",
        addonId: "addon-1",
      })
      db.serviceAddonPricing.update.mockReturnValue({ id: "ap-1" })

      const service = createService()
      await service.upsertAddonPricing({
        addonId: "addon-1",
        billingPeriod: "MONTHLY",
        currency: "IDR",
        amount: 30000,
        effectiveFrom: new Date("2026-01-01"),
      })

      expect(db.serviceAddonPricing.update).toHaveBeenCalled()
      expect(db.serviceAddonPricing.create).not.toHaveBeenCalled()
    })
  })

  // ─── upsertPlanAddonAttachment ─────────────────────────────────────

  describe("upsertPlanAddonAttachment", () => {
    it("creates a new plan-addon attachment", async () => {
      db.servicePlanAddon.create.mockReturnValue({
        id: "spa-1",
        planId: "plan-1",
        addonId: "addon-1",
      })

      const service = createService()
      await service.upsertPlanAddonAttachment({
        planId: "plan-1",
        addonId: "addon-1",
        label: "Extra IP",
        isRequired: false,
      })

      expect(db.servicePlanAddon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planId: "plan-1",
            addonId: "addon-1",
            label: "Extra IP",
          }),
        })
      )
    })

    it("updates an existing attachment", async () => {
      db.servicePlanAddon.findFirst.mockReturnValue({
        id: "spa-1",
        planId: "plan-1",
        addonId: "addon-1",
        label: "Old",
        description: null,
        isRequired: false,
        displayOrder: 0,
        enabledTerms: null,
        isActive: true,
      })
      db.servicePlanAddon.update.mockReturnValue({
        id: "spa-1",
        label: "New Label",
      })

      const service = createService()
      await service.upsertPlanAddonAttachment({
        planId: "plan-1",
        addonId: "addon-1",
        label: "New Label",
      })

      expect(db.servicePlanAddon.update).toHaveBeenCalled()
      expect(db.servicePlanAddon.create).not.toHaveBeenCalled()
    })
  })

  // ─── publishProduct ────────────────────────────────────────────────

  describe("publishProduct", () => {
    it("creates package, plan, and pricing in a transaction", async () => {
      // First findFirst for upsertPackage returns null (create path)
      // Second findFirst for upsertPlan must return the package
      db.servicePackage.findFirst
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ id: "pkg-1", code: "VPN" })
      db.servicePackage.create.mockReturnValue({
        id: "pkg-1",
        code: "VPN",
        name: "VPN",
      })
      db.servicePlan.create.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "Basic",
      })
      db.servicePricing.create.mockReturnValue({
        id: "pricing-1",
        planId: "plan-1",
      })

      const service = createService()
      const result = await service.publishProduct({
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
                effectiveFrom: new Date("2026-01-01"),
              },
            ],
          },
        ],
      })

      expect(result.id).toBe("pkg-1")
      expect(db.servicePackage.create).toHaveBeenCalled()
      expect(db.servicePlan.create).toHaveBeenCalled()
      expect(db.servicePricing.create).toHaveBeenCalled()
    })

    it("creates addons with pricing and plan attachments", async () => {
      // Package: first call null (create), second call returns pkg (for plan)
      db.servicePackage.findFirst
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ id: "pkg-1", code: "VPN" })
      db.servicePackage.create.mockReturnValue({
        id: "pkg-1",
        code: "VPN",
        name: "VPN",
      })
      db.servicePlan.create.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "Basic",
      })
      db.servicePricing.create.mockReturnValue({ id: "pricing-1" })
      db.serviceAddon.create.mockReturnValue({
        id: "addon-1",
        code: "EXTRA_IP",
        name: "Extra IP",
      })
      db.serviceAddonPricing.create.mockReturnValue({ id: "ap-1" })
      db.servicePlanAddon.create.mockReturnValue({ id: "spa-1" })
      // Plan lookup for addon attachment (via tx.servicePlan.findFirst)
      // Third call to servicePlan.findFirst (after upsertPlan used it once)
      db.servicePlan.findFirst
        .mockReturnValueOnce(null) // upsertPlan: no existing plan → create
        .mockReturnValueOnce({ id: "plan-1", code: "VPN_BASIC" }) // attachment lookup

      const service = createService()
      await service.publishProduct({
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
                effectiveFrom: new Date("2026-01-01"),
              },
            ],
          },
        ],
        addons: [
          {
            code: "EXTRA_IP",
            name: "Extra IP",
            billingMode: "RECURRING",
            prices: [
              {
                billingPeriod: "MONTHLY",
                currency: "IDR",
                amount: 25000,
                effectiveFrom: new Date("2026-01-01"),
              },
            ],
            planAttachments: [
              {
                planCode: "VPN_BASIC",
                label: "Extra IP",
                isRequired: false,
              },
            ],
          },
        ],
      })

      expect(db.serviceAddon.create).toHaveBeenCalled()
      expect(db.serviceAddonPricing.create).toHaveBeenCalled()
      expect(db.servicePlanAddon.create).toHaveBeenCalled()
    })

    it("throws CatalogPlanNotFoundError for invalid plan attachment reference", async () => {
      db.servicePackage.findFirst
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ id: "pkg-1", code: "VPN" })
      db.servicePackage.create.mockReturnValue({
        id: "pkg-1",
        code: "VPN",
        name: "VPN",
      })
      db.servicePlan.findFirst
        .mockReturnValueOnce(null) // upsertPlan: no existing → create
        .mockReturnValueOnce(null) // attachment lookup: not found
      db.servicePlan.create.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "Basic",
      })
      db.servicePricing.create.mockReturnValue({ id: "pricing-1" })
      db.serviceAddon.create.mockReturnValue({
        id: "addon-1",
        code: "EXTRA_IP",
        name: "Extra IP",
      })
      db.serviceAddonPricing.create.mockReturnValue({ id: "ap-1" })

      const service = createService()
      await expect(
        service.publishProduct({
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
                  effectiveFrom: new Date("2026-01-01"),
                },
              ],
            },
          ],
          addons: [
            {
              code: "EXTRA_IP",
              name: "Extra IP",
              prices: [
                {
                  billingPeriod: "MONTHLY",
                  currency: "IDR",
                  amount: 25000,
                  effectiveFrom: new Date("2026-01-01"),
                },
              ],
              planAttachments: [{ planCode: "NONEXISTENT", label: "test" }],
            },
          ],
        })
      ).rejects.toThrow(CatalogPlanNotFoundError)
    })

    it("throws CatalogRegionNotFoundError without an offer region or default", async () => {
      db.servicePackage.findFirst
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ id: "pkg-1", code: "VPN" })
      db.servicePlan.create.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "Basic",
      })
      db.serviceRegion.findFirst.mockReturnValue(null)

      const service = createService()
      await expect(
        service.publishProduct({
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
                  effectiveFrom: new Date("2026-01-01"),
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(CatalogRegionNotFoundError)
    })

    it("uses default region when offer has no regionId", async () => {
      db.servicePackage.findFirst
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ id: "pkg-1", code: "VPN" })
      db.servicePackage.create.mockReturnValue({
        id: "pkg-1",
        code: "VPN",
        name: "VPN",
      })
      db.servicePlan.create.mockReturnValue({
        id: "plan-1",
        code: "VPN_BASIC",
        name: "Basic",
      })
      db.servicePricing.create.mockReturnValue({ id: "pricing-1" })
      db.serviceRegion.findFirst.mockReturnValue({
        id: "default-region",
        code: "ID",
        isActive: true,
      })

      const service = createService()
      await service.publishProduct({
        code: "VPN",
        name: "VPN",
        plans: [
          {
            code: "VPN_BASIC",
            name: "Basic",
            offers: [
              {
                regionId: undefined as unknown as string,
                billingPeriod: "MONTHLY",
                chargeUnit: "SUBSCRIPTION",
                periodPrice: 150000,
                currency: "IDR",
                effectiveFrom: new Date("2026-01-01"),
              },
            ],
          },
        ],
      })

      expect(db.servicePricing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            regionId: "default-region",
          }),
        })
      )
    })
  })
})
