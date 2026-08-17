import { beforeEach, describe, expect, it, mock } from "bun:test"

// ── Prisma mock ────────────────────────────────────────────────────────────
// Mocks must be set up before the module import below.

const serviceRegionFindUnique = mock(async (_args?: unknown) => null as unknown)
const serviceRegionCreate = mock(async (args: { data: unknown }) => args.data)
const serviceRegionUpdate = mock(async (args: { data: unknown }) => args.data)

const servicePackageFindUnique = mock(
  async (_args?: unknown) => null as unknown
)
const servicePackageCreate = mock(async (args: { data: unknown }) => args.data)
const servicePackageUpdate = mock(async (args: { data: unknown }) => args.data)

const servicePlanFindFirst = mock(async (_args?: unknown) => null as unknown)
const servicePlanCreate = mock(async (args: { data: unknown }) => args.data)
const servicePlanUpdate = mock(async (args: { data: unknown }) => args.data)

const pricingCreateCalls: Record<string, unknown>[] = []
const servicePricingFindFirst = mock(async () => null)
const servicePricingCreate = mock(
  async (args: { data: Record<string, unknown> }) => {
    pricingCreateCalls.push(args.data)
    return args.data
  }
)
const servicePricingUpdate = mock(
  async (args: { data: Record<string, unknown> }) => args.data
)

const billingAccountFindMany = mock(async () => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    serviceRegion: {
      findUnique: serviceRegionFindUnique,
      create: serviceRegionCreate,
      update: serviceRegionUpdate,
    },
    servicePackage: {
      findUnique: servicePackageFindUnique,
      create: servicePackageCreate,
      update: servicePackageUpdate,
    },
    servicePlan: {
      findFirst: servicePlanFindFirst,
      create: servicePlanCreate,
      update: servicePlanUpdate,
    },
    servicePricing: {
      findFirst: servicePricingFindFirst,
      create: servicePricingCreate,
      update: servicePricingUpdate,
    },
    billingAccount: {
      findMany: billingAccountFindMany,
      findFirst: mock(async () => null),
      create: mock(async (args: { data: unknown }) => args.data),
    },
  },
}))

// Dynamic import required so mock.module() intercepts the prisma dependency
// before the module is evaluated — this is the standard Bun mock pattern.
const { BillingSeeder } = await import("./billing.seeder")

// ── Helpers ────────────────────────────────────────────────────────────────

function makePackage(code: string) {
  return { id: `pkg-${code}`, code, name: code, isActive: true }
}

function makePlan(code: string) {
  return { id: `plan-${code}`, code }
}

function makeRegion(code: string) {
  return { id: `region-${code}`, code }
}

function resetMocks() {
  pricingCreateCalls.length = 0

  serviceRegionFindUnique.mockClear()
  serviceRegionCreate.mockClear()
  serviceRegionUpdate.mockClear()
  servicePackageFindUnique.mockClear()
  servicePackageCreate.mockClear()
  servicePackageUpdate.mockClear()
  servicePlanFindFirst.mockClear()
  servicePlanCreate.mockClear()
  servicePricingFindFirst.mockClear()
  servicePricingCreate.mockClear()
  billingAccountFindMany.mockClear()

  // regions and packages already exist → update path
  serviceRegionFindUnique.mockImplementation(async (args: unknown) => {
    const { where } = args as { where: { code: string } }
    return makeRegion(where.code)
  })
  servicePackageFindUnique.mockImplementation(async (args: unknown) => {
    const { where } = args as { where: { code: string } }
    return makePackage(where.code)
  })
  servicePlanFindFirst.mockImplementation(async (args: unknown) => {
    const { where } = args as { where: { code: string } }
    return makePlan(where.code)
  })
  servicePricingFindFirst.mockResolvedValue(null) // always create pricings
  billingAccountFindMany.mockResolvedValue([])
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("BillingSeeder", () => {
  describe("metadata", () => {
    it("is classified as system", () => {
      expect(BillingSeeder.classification).toBe("system")
    })

    it("runs at order 20", () => {
      expect(BillingSeeder.runOrder).toBe(20)
    })
  })

  describe("seedRegions and seedPackages", () => {
    beforeEach(() => {
      resetMocks()
      // Nothing exists → create path
      serviceRegionFindUnique.mockResolvedValue(null)
      servicePackageFindUnique.mockResolvedValue(null)
    })

    it("creates all 3 regions when none exist", async () => {
      await new BillingSeeder().seed()
      expect(serviceRegionCreate).toHaveBeenCalledTimes(3)
    })

    it("creates all 3 packages when none exist", async () => {
      await new BillingSeeder().seed()
      expect(servicePackageCreate).toHaveBeenCalledTimes(3)
    })

    it("updates regions that already exist", async () => {
      serviceRegionFindUnique.mockImplementation(async (args: unknown) => {
        const { where } = args as { where: { code: string } }
        return makeRegion(where.code)
      })
      await new BillingSeeder().seed()
      expect(serviceRegionUpdate).toHaveBeenCalledTimes(3)
      expect(serviceRegionCreate).toHaveBeenCalledTimes(0)
    })
  })

  describe("seedPricings", () => {
    beforeEach(resetMocks)

    it("sets billingPeriod=MONTHLY and periodPrice=basePriceIdr for APP_HOSTING BUNDLE/PACKAGE pricings", async () => {
      await new BillingSeeder().seed()

      // APP_HOSTING BUNDLE/PACKAGE: chargeUnit=SUBSCRIPTION, billingMode=PACKAGE, basePriceIdr > 0
      const appHostingBundle = pricingCreateCalls.filter(
        (r) =>
          r.chargeUnit === "SUBSCRIPTION" &&
          r.billingMode === "PACKAGE" &&
          r.type === "BUNDLE" &&
          Number(r.basePriceIdr) > 0
      )

      expect(appHostingBundle.length).toBeGreaterThan(0)

      for (const r of appHostingBundle) {
        expect(r.billingPeriod).toBe("MONTHLY")
        expect(r.periodPrice).toBe(r.basePriceIdr)
        expect(Number(r.periodPrice)).toBeGreaterThan(0)
        expect(r.isActive).toBe(true)
      }
    })

    it("does NOT set billingPeriod or periodPrice for PAYG pricings", async () => {
      await new BillingSeeder().seed()

      const paygRows = pricingCreateCalls.filter(
        (r) => r.billingMode === "PAYG"
      )

      expect(paygRows.length).toBeGreaterThan(0)

      for (const r of paygRows) {
        expect(r.billingPeriod).toBeUndefined()
        expect(r.periodPrice).toBeUndefined()
      }
    })

    it("sets isActive=false for WHATSAPP pricings (chargeUnit=DEVICE)", async () => {
      await new BillingSeeder().seed()

      const whatsappRows = pricingCreateCalls.filter(
        (r) => r.chargeUnit === "DEVICE"
      )

      expect(whatsappRows.length).toBeGreaterThan(0)

      for (const r of whatsappRows) {
        expect(r.isActive).toBe(false)
        expect(r.billingPeriod).toBe("MONTHLY")
        expect(r.periodPrice).toBe(0)
      }
    })

    it("sets billingPeriod=MONTHLY for VPN BUNDLE/PACKAGE pricings", async () => {
      await new BillingSeeder().seed()

      // VPN: SUBSCRIPTION chargeUnit, PACKAGE mode, basePriceIdr === 0
      const vpnBundle = pricingCreateCalls.filter(
        (r) =>
          r.chargeUnit === "SUBSCRIPTION" &&
          r.billingMode === "PACKAGE" &&
          Number(r.basePriceIdr) === 0
      )

      expect(vpnBundle.length).toBeGreaterThan(0)

      for (const r of vpnBundle) {
        expect(r.billingPeriod).toBe("MONTHLY")
        expect(r.periodPrice).toBe(0) // VPN is free / TBD
        expect(r.isActive).toBe(true)
      }
    })

    it("creates the expected number of pricing rows", async () => {
      await new BillingSeeder().seed()
      // 8 APP_HOSTING BUNDLE + 2 APP_HOSTING PAYG + 4 VPN + 4 WHATSAPP = 18
      expect(pricingCreateCalls.length).toBe(18)
    })
  })
})
