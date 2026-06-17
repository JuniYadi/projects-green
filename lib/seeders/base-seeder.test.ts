import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test"

// Mock prisma at the lowest shared dependency
const mockPrisma = {
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
    create: async (data: unknown) => ({ id: "inv-mock", ...(data as Record<string, unknown>) }),
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

const { BaseSeeder } = await import("./base-seeder")

// ── Concrete test subclass ────────────────────────────────────────────────

class TestSeeder extends BaseSeeder {
  static override readonly seederName = "TestSeeder"
  static override readonly classification = "system" as const
  static override readonly runOrder = 25
  static override readonly description = "A test seeder"
  static override readonly seedTag = "test-v1"
  static override readonly requiredEnvVars = ["TEST_VAR"] as const

  seedCalled = false
  unseedCalled = false

  async seed(): Promise<void> {
    this.seedCalled = true
    this.log("seeding...")
    this.trackCreated(3)
    this.trackUpdated(1)
    this.trackSkipped(2)
  }

  override async unseed(): Promise<void> {
    this.unseedCalled = true
    this.trackDeleted(5)
  }

  /** Expose protected cliArgs for testing */
  get testCliArgs(): Map<string, string> {
    return this.cliArgs
  }

  /** Expose protected tracking methods for testing */
  testTrackCreated(count?: number): void {
    this.trackCreated(count)
  }
  testTrackUpdated(count?: number): void {
    this.trackUpdated(count)
  }
  testTrackDeleted(count?: number): void {
    this.trackDeleted(count)
  }
  testTrackSkipped(count?: number): void {
    this.trackSkipped(count)
  }
  testTrackError(message: string): void {
    this.trackError(message)
  }
}

class MinimalSeeder extends BaseSeeder {
  static override readonly seederName = "Minimal"
  static override readonly classification = "dummy" as const

  async seed(): Promise<void> {
    // no-op
  }

  testTrackError(message: string): void {
    this.trackError(message)
  }
}

class ErrorSeeder extends BaseSeeder {
  static override readonly seederName = "ErrorSeeder"
  static override readonly classification = "dummy" as const

  async seed(): Promise<void> {
    this.trackError("something went wrong")
    this.warn("watch out")
    throw new Error("boom")
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("BaseSeeder", () => {
  beforeEach(() => {
    mockPrisma.$disconnect.mockClear()
  })

  // ── Static Config ──────────────────────────────────────────────────────

  describe("static configuration", () => {
    it("returns seederName from static config", () => {
      expect(TestSeeder.seederName).toBe("TestSeeder")
    })

    it("returns classification from static config", () => {
      expect(TestSeeder.classification).toBe("system")
    })

    it("returns runOrder from static config", () => {
      expect(TestSeeder.runOrder).toBe(25)
    })

    it("returns description from static config", () => {
      expect(TestSeeder.description).toBe("A test seeder")
    })

    it("returns seedTag from static config", () => {
      expect(TestSeeder.seedTag).toBe("test-v1")
    })

    it("returns requiredEnvVars from static config", () => {
      expect(TestSeeder.requiredEnvVars).toEqual(["TEST_VAR"])
    })

    it("uses defaults when subclass does not override", () => {
      expect(MinimalSeeder.classification).toBe("dummy")
      expect(MinimalSeeder.runOrder).toBe(100)
      expect(MinimalSeeder.description).toBe("")
      expect(MinimalSeeder.seedTag).toBeNull()
      expect(MinimalSeeder.requiredEnvVars).toEqual([])
    })
  })

  // ── getConfig ──────────────────────────────────────────────────────────

  describe("getConfig()", () => {
    it("returns a SeederConfig object with all fields", () => {
      const config = TestSeeder.getConfig()

      expect(config.name).toBe("TestSeeder")
      expect(config.classification).toBe("system")
      expect(config.runOrder).toBe(25)
      expect(config.description).toBe("A test seeder")
      expect(config.seedTag).toBe("test-v1")
      expect(config.requiredEnvVars).toEqual(["TEST_VAR"])
    })

    it("returns defaults for minimal seeder", () => {
      const config = MinimalSeeder.getConfig()

      expect(config.name).toBe("Minimal")
      expect(config.classification).toBe("dummy")
      expect(config.runOrder).toBe(100)
      expect(config.seedTag).toBeNull()
      expect(config.requiredEnvVars).toEqual([])
    })
  })

  // ── validateEnv ────────────────────────────────────────────────────────

  describe("validateEnv()", () => {
    it("returns empty array when all required env vars are set", () => {
      const orig = process.env.TEST_VAR
      process.env.TEST_VAR = "some-value"

      try {
        expect(TestSeeder.validateEnv()).toEqual([])
      } finally {
        if (orig === undefined) delete process.env.TEST_VAR
        else process.env.TEST_VAR = orig
      }
    })

    it("returns missing var names when env vars are unset", () => {
      const orig = process.env.TEST_VAR
      delete process.env.TEST_VAR

      try {
        expect(TestSeeder.validateEnv()).toEqual(["TEST_VAR"])
      } finally {
        if (orig !== undefined) process.env.TEST_VAR = orig
      }
    })

    it("treats whitespace-only values as missing", () => {
      const orig = process.env.TEST_VAR
      process.env.TEST_VAR = "   "

      try {
        expect(TestSeeder.validateEnv()).toEqual(["TEST_VAR"])
      } finally {
        if (orig === undefined) delete process.env.TEST_VAR
        else process.env.TEST_VAR = orig
      }
    })

    it("returns empty array when no required env vars", () => {
      expect(MinimalSeeder.validateEnv()).toEqual([])
    })
  })

  // ── create() factory ───────────────────────────────────────────────────

  describe("create()", () => {
    it("creates an instance of the seeder", () => {
      const instance = TestSeeder.create()
      expect(instance).toBeInstanceOf(TestSeeder)
      expect(instance).toBeInstanceOf(BaseSeeder)
    })

    it("forwards cliArgs to the constructor", () => {
      const args = new Map([["--organization-id", "org-123"]])
      const instance = TestSeeder.create(args) as TestSeeder
      expect(instance.testCliArgs.get("--organization-id")).toBe("org-123")
    })

    it("defaults cliArgs to empty map", () => {
      const instance = TestSeeder.create() as TestSeeder
      expect(instance.testCliArgs.size).toBe(0)
    })
  })

  // ── Constructor / Result Initialization ─────────────────────────────────

  describe("constructor", () => {
    it("initializes result with zero counts and empty errors", () => {
      const instance = new TestSeeder()
      const result = instance.getResult()

      expect(result.name).toBe("TestSeeder")
      expect(result.classification).toBe("system")
      expect(result.created).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.deleted).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toEqual([])
    })

    it("stores cliArgs from constructor", () => {
      const args = new Map([["--dry-run", "true"]])
      const instance = new TestSeeder(args)
      expect(instance.testCliArgs.get("--dry-run")).toBe("true")
    })
  })

  // ── Result Tracking ────────────────────────────────────────────────────

  describe("result tracking", () => {
    it("trackCreated increments created count", async () => {
      const instance = new TestSeeder()
      await instance.seed()

      const result = instance.getResult()
      expect(result.created).toBe(3)
    })

    it("trackUpdated increments updated count", async () => {
      const instance = new TestSeeder()
      await instance.seed()

      const result = instance.getResult()
      expect(result.updated).toBe(1)
    })

    it("trackSkipped increments skipped count", async () => {
      const instance = new TestSeeder()
      await instance.seed()

      const result = instance.getResult()
      expect(result.skipped).toBe(2)
    })

    it("trackDeleted increments deleted count", async () => {
      const instance = new TestSeeder()
      await instance.unseed()

      const result = instance.getResult()
      expect(result.deleted).toBe(5)
    })

    it("trackError appends error messages", async () => {
      const instance = new ErrorSeeder()

      try {
        await instance.seed()
      } catch {
        // expected
      }

      const result = instance.getResult()
      expect(result.errors).toContain("something went wrong")
    })

    it("trackCreated/Updated/Skipped accept custom count", () => {
      const instance = new TestSeeder()
      instance.testTrackCreated(10)
      instance.testTrackUpdated(5)
      instance.testTrackSkipped(3)
      instance.testTrackDeleted(7)

      const result = instance.getResult()
      expect(result.created).toBe(10)
      expect(result.updated).toBe(5)
      expect(result.skipped).toBe(3)
      expect(result.deleted).toBe(7)
    })

    it("defaults track count to 1", () => {
      const instance = new TestSeeder()
      instance.testTrackCreated()
      instance.testTrackUpdated()
      instance.testTrackDeleted()
      instance.testTrackSkipped()

      const result = instance.getResult()
      expect(result.created).toBe(1)
      expect(result.updated).toBe(1)
      expect(result.deleted).toBe(1)
      expect(result.skipped).toBe(1)
    })
  })

  // ── getResult returns a copy ───────────────────────────────────────────

  describe("getResult()", () => {
    it("returns a new object each call (shallow copy)", async () => {
      const instance = new TestSeeder()
      await instance.seed()

      const result1 = instance.getResult()
      const result2 = instance.getResult()

      // Top-level object is a new instance
      expect(result1).toEqual(result2)
      expect(result1).not.toBe(result2)
      // Shallow copy — errors array is the same reference
      expect(result1.errors).toBe(result2.errors)
    })
  })

  // ── Logging ────────────────────────────────────────────────────────────

  describe("logging", () => {
    it("log() outputs message with seeder name prefix", async () => {
      const consoleSpy = spyOn(console, "log").mockImplementation(() => {})
      const instance = new TestSeeder()

      await instance.seed()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TestSeeder]"),
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("seeding..."),
      )

      consoleSpy.mockRestore()
    })

    it("warn() outputs message with seeder name and warning icon", async () => {
      const consoleSpy = spyOn(console, "warn").mockImplementation(() => {})
      const instance = new ErrorSeeder()

      try {
        await instance.seed()
      } catch {
        // expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ErrorSeeder]"),
      )
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("⚠"))
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("watch out"),
      )

      consoleSpy.mockRestore()
    })
  })

  // ── Default unseed ─────────────────────────────────────────────────────

  describe("default unseed()", () => {
    it("logs a skip message when unseed is not overridden", async () => {
      const consoleSpy = spyOn(console, "log").mockImplementation(() => {})
      const instance = new MinimalSeeder()

      await instance.unseed()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("unseed() not implemented"),
      )

      consoleSpy.mockRestore()
    })
  })

  // ── Lifecycle Hooks ────────────────────────────────────────────────────

  describe("lifecycle hooks", () => {
    it("calls seed() which populates the result", async () => {
      const instance = new TestSeeder()
      expect(instance.seedCalled).toBe(false)

      await instance.seed()

      expect(instance.seedCalled).toBe(true)
      const result = instance.getResult()
      expect(result.created).toBe(3)
      expect(result.updated).toBe(1)
      expect(result.skipped).toBe(2)
    })

    it("calls unseed() which populates deleted count", async () => {
      const instance = new TestSeeder()
      expect(instance.unseedCalled).toBe(false)

      await instance.unseed()

      expect(instance.unseedCalled).toBe(true)
      expect(instance.getResult().deleted).toBe(5)
    })

    it("seed() can throw and the error propagates", async () => {
      const instance = new ErrorSeeder()

      await expect(instance.seed()).rejects.toThrow("boom")
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────

  describe("error handling", () => {
    it("accumulates multiple trackError calls", () => {
      const instance = new MinimalSeeder()
      instance.testTrackError("first error")
      instance.testTrackError("second error")
      instance.testTrackError("third error")

      const result = instance.getResult()
      expect(result.errors).toHaveLength(3)
      expect(result.errors).toEqual([
        "first error",
        "second error",
        "third error",
      ])
    })

    it("getResult returns new object but shares errors array reference", () => {
      const instance = new MinimalSeeder()
      instance.testTrackError("err")

      const result1 = instance.getResult()
      const result2 = instance.getResult()

      // New top-level object each call
      expect(result1).not.toBe(result2)
      // Shallow copy — errors is the same array reference
      expect(result1.errors).toBe(result2.errors)
      expect(result1.errors).toEqual(["err"])
    })
  })
})
