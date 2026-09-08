import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindFirst = mock()
const mockFindUnique = mock()
const mockBillingAccountFindUnique = mock<() => Promise<unknown>>(
  async () => null
)
const mockServiceSubscriptionFindFirst = mock<() => Promise<unknown>>(
  async () => null
)
const mockGetMessagePricing = mock<(...args: unknown[]) => Promise<unknown>>(
  async () => ({
    unitPrice: 500,
    currency: "IDR",
  })
)

mock.module("@/modules/billing/message-cost.service", () => ({
  MessageCostService: class {
    getMessagePricing = mockGetMessagePricing
  },
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
    },
    whatsappDailyCount: {
      findUnique: mockFindUnique,
    },
    whatsappHourlyCount: {
      findUnique: mockFindUnique,
    },
    billingAccount: {
      findUnique: mockBillingAccountFindUnique,
    },
    serviceSubscription: {
      findFirst: mockServiceSubscriptionFindFirst,
    },
  },
}))
const {
  computeRecommendedSchedule,
  getDeviceBroadcastCapacity,
  validateSchedule,
  BroadcastScheduleLimitError,
} = await import("./broadcast-schedule.service")

const DEVICE = {
  id: "dev_1",
  organizationId: "org_1",
  dailyLimitMessage: 1000,
}

describe("computeRecommendedSchedule", () => {
  beforeEach(() => {
    mockFindFirst.mockClear()
    mockFindFirst.mockResolvedValue(DEVICE)
  })

  it("returns 41 max/60min for 500 recipients with 1000 daily limit", async () => {
    const result = await computeRecommendedSchedule({
      totalRecipients: 500,
      organizationId: "org_1",
      deviceId: "dev_1",
    })
    expect(result.throttleMaxMessages).toBe(41)
    expect(result.throttlePerMinutes).toBe(60)
    expect(result.estimatedDurationMinutes).toBeGreaterThan(700)
    expect(result.estimatedDurationMinutes).toBeLessThan(800)
  })

  it("returns 41 max/60min for 1000 recipients with 1000 daily limit", async () => {
    const result = await computeRecommendedSchedule({
      totalRecipients: 1000,
      organizationId: "org_1",
      deviceId: "dev_1",
    })
    expect(result.throttleMaxMessages).toBe(41)
    expect(result.estimatedDurationMinutes).toBeGreaterThan(1400)
  })

  it("caps at recipients when fewer than hourly limit", async () => {
    mockFindFirst.mockResolvedValue({ dailyLimitMessage: 1000 })
    const result = await computeRecommendedSchedule({
      totalRecipients: 10,
      organizationId: "org_1",
      deviceId: "dev_1",
    })
    expect(result.throttleMaxMessages).toBe(10)
    expect(result.estimatedDurationMinutes).toBe(60)
  })

  it("throws if device not found", async () => {
    mockFindFirst.mockResolvedValue(null)
    await expect(
      computeRecommendedSchedule({
        totalRecipients: 100,
        organizationId: "org_1",
        deviceId: "missing",
      })
    ).rejects.toThrow(BroadcastScheduleLimitError)
  })
})

describe("getDeviceBroadcastCapacity", () => {
  beforeEach(() => {
    mockFindFirst.mockClear()
    mockFindUnique.mockClear()
    mockFindFirst.mockResolvedValue(DEVICE)
  })

  it("returns capacity with no usage", async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await getDeviceBroadcastCapacity("org_1", "dev_1")
    expect(result.dailyLimit).toBe(1000)
    expect(result.hourlyLimit).toBe(41)
    expect(result.dailyUsed).toBe(0)
    expect(result.hourlyUsed).toBe(0)
    expect(result.remainingToday).toBe(1000)
    expect(result.remainingThisHour).toBe(41)
  })

  it("returns isAffordable false when recipients exceed quota and balance is zero", async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...DEVICE,
      quotaBaseOut: 10,
      addonQuota: 0,
    })
    mockFindUnique.mockResolvedValue(null)

    const result = await getDeviceBroadcastCapacity("org_1", "dev_1", 100)
    expect(result.quotaRemaining).toBe(10)
    expect(result.coveredByQuota).toBe(10)
    expect(result.overageRecipients).toBe(90)
    expect(result.maxAffordableRecipients).toBe(10)
    expect(result.isAffordable).toBe(false)
  })

  it("returns isAffordable true when quota covers all recipients", async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...DEVICE,
      quotaBaseOut: 500,
      addonQuota: 0,
    })
    mockFindUnique.mockResolvedValue(null)

    const result = await getDeviceBroadcastCapacity("org_1", "dev_1", 100)
    expect(result.quotaRemaining).toBe(500)
    expect(result.coveredByQuota).toBe(100)
    expect(result.overageRecipients).toBe(0)
    expect(result.isAffordable).toBe(true)
  })

  it("calculates financial capacity with unit price and deposit balance", async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...DEVICE,
      quotaBaseOut: 10,
      addonQuota: 0,
    })
    mockBillingAccountFindUnique.mockResolvedValueOnce({
      balance: 50000,
      currency: "IDR",
    })
    mockGetMessagePricing.mockResolvedValueOnce({
      unitPrice: 500,
      currency: "IDR",
    })
    mockFindUnique.mockResolvedValue(null)

    const result = await getDeviceBroadcastCapacity("org_1", "dev_1", 100)
    expect(result.depositBalance).toBe(50000)
    expect(result.unitPrice).toBe(500)
    expect(result.currency).toBe("IDR")
    expect(result.coveredByQuota).toBe(10)
    expect(result.overageRecipients).toBe(90)
    expect(result.estimatedOverageCost).toBe(45000)
    expect(result.maxAffordableRecipients).toBe(110)
    expect(result.isAffordable).toBe(true)
  })

  it("handles unlimited subscription plan correctly", async () => {
    mockFindFirst.mockResolvedValueOnce(DEVICE)
    mockServiceSubscriptionFindFirst.mockResolvedValueOnce({
      plan: { resources: { unlimited: true } },
    })
    mockFindUnique.mockResolvedValue(null)

    const result = await getDeviceBroadcastCapacity("org_1", "dev_1", 5000)
    expect(result.isUnlimited).toBe(true)
    expect(result.isAffordable).toBe(true)
    expect(result.maxAffordableRecipients).toBe(999999)
  })

  it("falls back to zero unit price when pricing service throws", async () => {
    mockFindFirst.mockResolvedValueOnce(DEVICE)
    mockGetMessagePricing.mockRejectedValueOnce(new Error("pricing failed"))
    mockFindUnique.mockResolvedValue(null)

    const result = await getDeviceBroadcastCapacity("org_1", "dev_1", 10)
    expect(result.unitPrice).toBe(0)
  })
})

describe("validateSchedule", () => {
  beforeEach(() => {
    mockFindFirst.mockClear()
    mockFindFirst.mockResolvedValue(DEVICE)
  })

  it("passes for rate at hourly limit", async () => {
    await expect(
      validateSchedule({
        throttleMaxMessages: 41,
        throttlePerMinutes: 60,
        totalRecipients: 100,
        organizationId: "org_1",
        deviceId: "dev_1",
      })
    ).resolves.toBeUndefined()
  })

  it("rejects rate exceeding hourly limit", async () => {
    await expect(
      validateSchedule({
        throttleMaxMessages: 100,
        throttlePerMinutes: 60,
        totalRecipients: 100,
        organizationId: "org_1",
        deviceId: "dev_1",
      })
    ).rejects.toThrow(BroadcastScheduleLimitError)
  })

  it("rejects a zero-value throttle before calculating a rate", async () => {
    await expect(
      validateSchedule({
        throttleMaxMessages: 0,
        throttlePerMinutes: 60,
        totalRecipients: 100,
        organizationId: "org_1",
        deviceId: "dev_1",
      })
    ).rejects.toThrow("Throttle values must be greater than zero.")
  })

  it("rejects when total exceeds remaining today without acknowledge", async () => {
    const deviceWithUsage = { dailyLimitMessage: 100 }
    mockFindFirst.mockResolvedValue(deviceWithUsage)
    await expect(
      validateSchedule({
        throttleMaxMessages: 4,
        throttlePerMinutes: 60,
        totalRecipients: 200,
        organizationId: "org_1",
        deviceId: "dev_1",
      })
    ).rejects.toThrow(BroadcastScheduleLimitError)
  })
})
