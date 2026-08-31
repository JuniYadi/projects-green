import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

const mockFindMany = mock(async () => [])
const mockUpsert = mock(async () => ({}))
const mockDeleteMany = mock(async () => ({}))

const redisStore = new Map<string, string>()

const mockRedisGet = mock(async (key: string) => redisStore.get(key) ?? null)
const mockRedisSet = mock(async (key: string, val: string) => {
  redisStore.set(key, val)
  return "OK"
})
const mockRedisDel = mock(async (key: string) => {
  redisStore.delete(key)
  return 1
})

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingAlertRule: {
      findMany: mockFindMany,
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
    },
  },
}))

mock.module("@/lib/redis", () => ({
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
  },
}))

const {
  getAlertRulesForVertical,
  resolveAlertRule,
  upsertAlertRule,
  deleteAlertRule,
} = await import("./billing-alerts.service")

describe("billing-alerts.service", () => {
  beforeEach(() => {
    redisStore.clear()
    mockFindMany.mockClear()
    mockUpsert.mockClear()
    mockDeleteMany.mockClear()
    mockRedisGet.mockClear()
    mockRedisSet.mockClear()
    mockRedisDel.mockClear()
  })

  it("fetches rules from DB on cache miss and stores in Redis", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "rule-1",
        organizationId: "org-1",
        vertical: "WHATSAPP",
        eventType: "QUOTA_LOW",
        targetId: "*",
        isEnabled: true,
        thresholdValue: new Prisma.Decimal(75),
        channels: ["EMAIL"],
        metadata: { thresholds: [75, 90, 100] },
      },
    ] as never)

    const rules = await getAlertRulesForVertical("org-1", "WHATSAPP")

    expect(mockRedisGet).toHaveBeenCalledWith("billing:alerts:org-1:WHATSAPP")
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", vertical: "WHATSAPP" },
    })
    expect(mockRedisSet).toHaveBeenCalledWith(
      "billing:alerts:org-1:WHATSAPP",
      expect.any(String),
      "EX",
      86400
    )
    expect(rules["*"]?.QUOTA_LOW).toEqual({
      isEnabled: true,
      thresholdValue: 75,
      channels: ["EMAIL"],
      metadata: { thresholds: [75, 90, 100] },
    })
  })

  it("returns cached rules without hitting DB", async () => {
    redisStore.set(
      "billing:alerts:org-1:WHATSAPP",
      JSON.stringify({
        "*": {
          QUOTA_LOW: {
            isEnabled: true,
            thresholdValue: 80,
            channels: ["EMAIL"],
            metadata: null,
          },
        },
      })
    )

    const rules = await getAlertRulesForVertical("org-1", "WHATSAPP")

    expect(mockRedisGet).toHaveBeenCalledWith("billing:alerts:org-1:WHATSAPP")
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(rules["*"]?.QUOTA_LOW?.thresholdValue).toBe(80)
  })

  it("resolves target override when present, falls back to global default", async () => {
    redisStore.set(
      "billing:alerts:org-1:WHATSAPP",
      JSON.stringify({
        "*": {
          QUOTA_LOW: {
            isEnabled: true,
            thresholdValue: 75,
            channels: ["EMAIL"],
          },
        },
        "dev-vip": {
          QUOTA_LOW: {
            isEnabled: true,
            thresholdValue: 50,
            channels: ["EMAIL"],
          },
        },
      })
    )

    // Specific target
    const vipRule = await resolveAlertRule(
      "org-1",
      "WHATSAPP",
      "QUOTA_LOW",
      "dev-vip"
    )
    expect(vipRule?.thresholdValue).toBe(50)

    // Other target falls back to "*"
    const standardRule = await resolveAlertRule(
      "org-1",
      "WHATSAPP",
      "QUOTA_LOW",
      "dev-other"
    )
    expect(standardRule?.thresholdValue).toBe(75)
  })

  it("upserts rule and invalidates Redis cache", async () => {
    mockUpsert.mockResolvedValueOnce({
      id: "rule-1",
      organizationId: "org-1",
      vertical: "WHATSAPP",
      eventType: "QUOTA_LOW",
      targetId: "*",
      isEnabled: true,
      thresholdValue: new Prisma.Decimal(90),
      channels: ["EMAIL"],
    } as never)

    await upsertAlertRule({
      organizationId: "org-1",
      vertical: "WHATSAPP",
      eventType: "QUOTA_LOW",
      thresholdValue: 90,
    })

    expect(mockUpsert).toHaveBeenCalled()
    expect(mockRedisDel).toHaveBeenCalledWith("billing:alerts:org-1:WHATSAPP")
  })

  it("deletes rule and invalidates Redis cache", async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 1 } as never)

    await deleteAlertRule("org-1", "WHATSAPP", "QUOTA_LOW", "dev-1")

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        vertical: "WHATSAPP",
        eventType: "QUOTA_LOW",
        targetId: "dev-1",
      },
    })
    expect(mockRedisDel).toHaveBeenCalledWith("billing:alerts:org-1:WHATSAPP")
  })
})
