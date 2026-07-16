import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindFirst = mock()
const mockFindUnique = mock()

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
