import { describe, it, expect, beforeEach, mock } from "bun:test"

// Mock prisma at the lowest shared dependency — must be before any imports
// that pull in @/lib/prisma (BaseSeeder does)
const mockPrisma = {
  currency: { findUnique: mock(() => Promise.resolve(null)) },
  $disconnect: mock(() => Promise.resolve()),
  paymentGateway: { findMany: async () => [], findFirst: async () => null },
  paymentBankAccount: { findMany: async () => [] },
  paymentCurrency: {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
  },
  billingInvoice: {
    findMany: async () => [],
    findFirst: async () => null,
    create: async (data: unknown) => ({
      id: "inv-mock",
      ...(data as Record<string, unknown>),
    }),
    update: async (data: unknown) => data,
  },
  billingAccount: {
    findUnique: async () => null,
    create: async (data: unknown) => data as Record<string, unknown>,
  },
  billingAdjustment: { create: async () => ({ id: "adj-mock" }) },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { registerSeeder, getSeeders, getSeeder, listSeeders, clearRegistry } =
  await import("@/lib/seeders/registry")
const { BaseSeeder } = await import("@/lib/seeders/base-seeder")

// ── Test Seeders ──────────────────────────────────────────────────────────

class AlphaSeeder extends BaseSeeder {
  static override readonly seederName = "Alpha"
  static override readonly classification = "system" as const
  static override readonly runOrder = 30
  static override readonly description = "Third in system"

  async seed(): Promise<void> {
    /* no-op */
  }
}

class BetaSeeder extends BaseSeeder {
  static override readonly seederName = "Beta"
  static override readonly classification = "system" as const
  static override readonly runOrder = 10
  static override readonly description = "First in system"

  async seed(): Promise<void> {
    /* no-op */
  }
}

class GammaSeeder extends BaseSeeder {
  static override readonly seederName = "Gamma"
  static override readonly classification = "dummy" as const
  static override readonly runOrder = 20
  static override readonly description = "A dummy seeder"
  static override readonly seedTag = "gamma-v1"
  static override readonly requiredEnvVars = ["GAMMA_KEY"] as const

  async seed(): Promise<void> {
    /* no-op */
  }
}

class DeltaSeeder extends BaseSeeder {
  static override readonly seederName = "Delta"
  static override readonly classification = "dummy" as const
  static override readonly runOrder = 5
  static override readonly description = "First dummy"

  async seed(): Promise<void> {
    /* no-op */
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("seeder registry", () => {
  beforeEach(() => {
    clearRegistry()
  })

  // ── Registration ───────────────────────────────────────────────────────

  describe("registerSeeder()", () => {
    it("registers a seeder class", () => {
      registerSeeder(AlphaSeeder)
      const found = getSeeder("Alpha")
      expect(found).toBe(AlphaSeeder)
    })

    it("registers multiple seeders", () => {
      registerSeeder(AlphaSeeder)
      registerSeeder(BetaSeeder)
      registerSeeder(GammaSeeder)

      expect(getSeeder("Alpha")).toBe(AlphaSeeder)
      expect(getSeeder("Beta")).toBe(BetaSeeder)
      expect(getSeeder("Gamma")).toBe(GammaSeeder)
    })

    it("throws on duplicate registration", () => {
      registerSeeder(AlphaSeeder)
      expect(() => registerSeeder(AlphaSeeder)).toThrow(
        'Seeder "Alpha" is already registered'
      )
    })
  })

  // ── getSeeder ──────────────────────────────────────────────────────────

  describe("getSeeder()", () => {
    it("returns undefined for unregistered name", () => {
      expect(getSeeder("NonExistent")).toBeUndefined()
    })

    it("returns the correct class for registered name", () => {
      registerSeeder(BetaSeeder)
      expect(getSeeder("Beta")).toBe(BetaSeeder)
    })
  })

  // ── getSeeders — sorting ───────────────────────────────────────────────

  describe("getSeeders() sorting", () => {
    it("returns seeders sorted by runOrder ascending", () => {
      registerSeeder(AlphaSeeder) // runOrder 30
      registerSeeder(BetaSeeder) // runOrder 10
      registerSeeder(GammaSeeder) // runOrder 20

      const seeders = getSeeders()
      expect(seeders.map((s) => s.seederName)).toEqual([
        "Beta",
        "Gamma",
        "Alpha",
      ])
    })

    it("returns empty array when no seeders registered", () => {
      expect(getSeeders()).toEqual([])
    })
  })

  // ── getSeeders — classification filtering ──────────────────────────────

  describe("getSeeders() classification filtering", () => {
    beforeEach(() => {
      registerSeeder(AlphaSeeder) // system, runOrder 30
      registerSeeder(BetaSeeder) // system, runOrder 10
      registerSeeder(GammaSeeder) // dummy, runOrder 20
      registerSeeder(DeltaSeeder) // dummy, runOrder 5
    })

    it("returns all seeders when no classification filter", () => {
      const seeders = getSeeders()
      expect(seeders).toHaveLength(4)
    })

    it("filters to system seeders only", () => {
      const seeders = getSeeders("system")
      expect(seeders).toHaveLength(2)
      expect(seeders.every((s) => s.classification === "system")).toBe(true)
      expect(seeders.map((s) => s.seederName)).toEqual(["Beta", "Alpha"])
    })

    it("filters to dummy seeders only", () => {
      const seeders = getSeeders("dummy")
      expect(seeders).toHaveLength(2)
      expect(seeders.every((s) => s.classification === "dummy")).toBe(true)
      expect(seeders.map((s) => s.seederName)).toEqual(["Delta", "Gamma"])
    })

    it("returns empty array when filtering by classification with no matches", () => {
      clearRegistry()
      registerSeeder(AlphaSeeder) // system only
      const seeders = getSeeders("dummy")
      expect(seeders).toEqual([])
    })
  })

  // ── listSeeders ────────────────────────────────────────────────────────

  describe("listSeeders()", () => {
    it("returns config objects sorted by runOrder", () => {
      registerSeeder(AlphaSeeder)
      registerSeeder(BetaSeeder)
      registerSeeder(GammaSeeder)

      const configs = listSeeders()
      expect(configs).toHaveLength(3)

      expect(configs[0].name).toBe("Beta")
      expect(configs[0].runOrder).toBe(10)
      expect(configs[0].classification).toBe("system")

      expect(configs[1].name).toBe("Gamma")
      expect(configs[1].runOrder).toBe(20)
      expect(configs[1].classification).toBe("dummy")
      expect(configs[1].seedTag).toBe("gamma-v1")
      expect(configs[1].requiredEnvVars).toEqual(["GAMMA_KEY"])

      expect(configs[2].name).toBe("Alpha")
      expect(configs[2].runOrder).toBe(30)
      expect(configs[2].classification).toBe("system")
    })

    it("returns empty array when no seeders registered", () => {
      expect(listSeeders()).toEqual([])
    })

    it("includes all expected config fields", () => {
      registerSeeder(GammaSeeder)
      const configs = listSeeders()
      const config = configs[0]

      expect(config).toHaveProperty("name")
      expect(config).toHaveProperty("classification")
      expect(config).toHaveProperty("runOrder")
      expect(config).toHaveProperty("description")
      expect(config).toHaveProperty("seedTag")
      expect(config).toHaveProperty("requiredEnvVars")
    })
  })

  // ── clearRegistry ──────────────────────────────────────────────────────

  describe("clearRegistry()", () => {
    it("removes all registered seeders", () => {
      registerSeeder(AlphaSeeder)
      registerSeeder(BetaSeeder)

      clearRegistry()

      expect(getSeeder("Alpha")).toBeUndefined()
      expect(getSeeder("Beta")).toBeUndefined()
      expect(getSeeders()).toEqual([])
    })

    it("allows re-registration after clear", () => {
      registerSeeder(AlphaSeeder)
      clearRegistry()
      // Should not throw — registry was cleared
      expect(() => registerSeeder(AlphaSeeder)).not.toThrow()
    })
  })

  // ── Runner behavior integration ────────────────────────────────────────

  describe("runner behavior (registry integration)", () => {
    it("discovers seeders in correct execution order", () => {
      registerSeeder(AlphaSeeder) // system/30
      registerSeeder(BetaSeeder) // system/10
      registerSeeder(GammaSeeder) // dummy/20
      registerSeeder(DeltaSeeder) // dummy/5

      const allSeeders = getSeeders()
      const order = allSeeders.map((s) => ({
        name: s.seederName,
        type: s.classification,
        order: s.runOrder,
      }))

      expect(order).toEqual([
        { name: "Delta", type: "dummy", order: 5 },
        { name: "Beta", type: "system", order: 10 },
        { name: "Gamma", type: "dummy", order: 20 },
        { name: "Alpha", type: "system", order: 30 },
      ])
    })

    it("filters by classification then sorts by runOrder", () => {
      registerSeeder(AlphaSeeder) // system/30
      registerSeeder(BetaSeeder) // system/10
      registerSeeder(GammaSeeder) // dummy/20
      registerSeeder(DeltaSeeder) // dummy/5

      const systemOnly = getSeeders("system")
      expect(systemOnly.map((s) => s.seederName)).toEqual(["Beta", "Alpha"])

      const dummyOnly = getSeeders("dummy")
      expect(dummyOnly.map((s) => s.seederName)).toEqual(["Delta", "Gamma"])
    })

    it("getConfig matches getConfig on each seeder", () => {
      registerSeeder(BetaSeeder)
      registerSeeder(GammaSeeder)

      const fromListSeeders = listSeeders()
      const fromDirect = [BetaSeeder.getConfig(), GammaSeeder.getConfig()]

      // listSeeders sorts by runOrder, so direct should be in same order
      // Beta has runOrder 10, Gamma has 20
      expect(fromListSeeders).toEqual(fromDirect)
    })

    it("validateEnv reflects requiredEnvVars", () => {
      expect(GammaSeeder.validateEnv()).toEqual(
        expect.arrayContaining(["GAMMA_KEY"])
      )
      expect(BetaSeeder.validateEnv()).toEqual([])
    })
  })
})
