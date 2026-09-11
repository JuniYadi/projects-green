import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockPrisma = {
  applicationStack: {
    findFirst: mock(),
    findMany: mock(),
  },
  appHostingDailyLogSnapshot: {
    findUnique: mock(),
    findMany: mock(),
    upsert: mock(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockResolveOpenSearchForStack = mock()
mock.module("./opensearch-traffic.service", () => ({
  resolveOpenSearchForStack: mockResolveOpenSearchForStack,
}))

const {
  getHourlyRollupWindow,
  extractErrorSignature,
  computeHourlyLogAggregation,
  accumulateHourlyLogSnapshot,
  getAppLogReport,
  getAppLogErrorsDrilldown,
} = await import("./opensearch-log-health.service")

describe("opensearch-log-health.service", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockResolveOpenSearchForStack.mockResolvedValue({
      client: {},
      stack: { id: "st_1", slug: "my-app" },
      clusterCode: "sgp",
    })
  })

  describe("getHourlyRollupWindow", () => {
    it("cleanly resolves midnight 00:05 UTC to yesterday hour 23", () => {
      const midnight = new Date("2026-09-12T00:05:00.000Z")
      const window = getHourlyRollupWindow(midnight)

      expect(window.targetHour).toBe(23)
      expect(window.targetDate.toISOString().slice(0, 10)).toBe("2026-09-11")
      expect(window.windowStart.toISOString()).toBe("2026-09-11T23:00:00.000Z")
      expect(window.windowEnd.toISOString()).toBe("2026-09-11T23:59:59.999Z")
    })

    it("resolves afternoon hour correctly", () => {
      const afternoon = new Date("2026-09-12T14:10:00.000Z")
      const window = getHourlyRollupWindow(afternoon)

      expect(window.targetHour).toBe(13)
      expect(window.targetDate.toISOString().slice(0, 10)).toBe("2026-09-12")
    })
  })

  describe("extractErrorSignature", () => {
    it("extracts first line and strips ANSI codes up to 120 chars", () => {
      const raw =
        "\u001b[91mError: DB connection timed out\u001b[0m\n    at Connection.connect (/app/db.js:12)"
      expect(extractErrorSignature(raw)).toBe("Error: DB connection timed out")
    })
  })

  describe("computeHourlyLogAggregation", () => {
    it("computes hourly aggregation with pod isolation query", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_1",
        slug: "my-app",
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            hits: { total: { value: 120 } },
            aggregations: {
              levels: { buckets: [{ key: 40, doc_count: 5 }] },
              errors: {
                doc_count: 3,
                top_messages: {
                  buckets: [
                    { key: "TypeError: null is not an object", doc_count: 3 },
                  ],
                },
              },
            },
          },
        })),
      }

      const window = getHourlyRollupWindow(new Date("2026-09-11T14:00:00Z"))
      const result = await computeHourlyLogAggregation(
        "my-app",
        window,
        mockClient
      )

      expect(result.totalLogs).toBe(120)
      expect(result.errorCount).toBe(3)
      expect(result.warnCount).toBe(5)
      expect(result.infoCount).toBe(112)
      expect(result.topErrors).toHaveLength(1)
      expect(result.topErrors[0].signature).toBe(
        "TypeError: null is not an object"
      )
    })
  })

  describe("accumulateHourlyLogSnapshot", () => {
    it("merges into 24-slot array and upserts database record", async () => {
      mockPrisma.appHostingDailyLogSnapshot.findUnique.mockResolvedValue(null)

      const window = getHourlyRollupWindow(new Date("2026-09-11T14:00:00Z"))
      await accumulateHourlyLogSnapshot({
        stackId: "st_1",
        slug: "my-app",
        window,
        totalLogs: 100,
        infoCount: 95,
        warnCount: 3,
        errorCount: 2,
        topErrors: [{ signature: "Err 1", count: 2, sampleMessage: "Err 1" }],
      })

      expect(mockPrisma.appHostingDailyLogSnapshot.upsert).toHaveBeenCalled()
      const upsertArgs =
        mockPrisma.appHostingDailyLogSnapshot.upsert.mock.calls[0][0]
      expect(upsertArgs.create.errorCount).toBe(2)
      expect(upsertArgs.create.healthScore).toBe(98)
    })
  })

  describe("getAppLogReport", () => {
    it("returns daily report with 24-hour slots", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_1",
        slug: "my-app",
        name: "My App",
      })

      mockPrisma.appHostingDailyLogSnapshot.findUnique.mockResolvedValue({
        id: "snap_1",
        stackId: "st_1",
        date: new Date("2026-09-11T00:00:00Z"),
        totalLogs: 1000,
        infoCount: 950,
        warnCount: 30,
        errorCount: 20,
        healthScore: 98,
        hourlyTrendJson: [
          { hour: 0, info: 100, warn: 2, error: 1 },
          { hour: 1, info: 200, warn: 0, error: 0 },
        ],
        topErrorsJson: [
          {
            signature: "Error: connect ECONNREFUSED",
            count: 20,
            sampleMessage: "Error: connect ECONNREFUSED",
          },
        ],
      })

      const report = await getAppLogReport("my-app", {
        granularity: "daily",
        date: "2026-09-11",
      })

      expect(report.granularity).toBe("daily")
      expect(report.totalLogs).toBe(1000)
      expect(report.healthScore).toBe(98)
      expect(report.trend).toHaveLength(24)
      expect(report.topErrors).toHaveLength(1)
    })
  })

  describe("getAppLogErrorsDrilldown", () => {
    it("returns on-demand distinct error signatures from OpenSearch", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_1",
        slug: "my-app",
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            aggregations: {
              error_messages: {
                buckets: [
                  { key: "DB Connection Timeout after 30s", doc_count: 14 },
                  {
                    key: "TypeError: undefined has no properties",
                    doc_count: 5,
                  },
                ],
              },
            },
          },
        })),
      }

      const res = await getAppLogErrorsDrilldown(
        "my-app",
        { limit: 20 },
        mockClient
      )
      expect(res.errors).toHaveLength(2)
      expect(res.errors[0].signature).toBe("DB Connection Timeout after 30s")
      expect(res.errors[0].count).toBe(14)
    })
  })
})
