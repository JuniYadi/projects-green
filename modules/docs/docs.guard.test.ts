import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

import {
  inspectPromptSafety,
  checkRateLimit,
  resetRateLimiterStores,
  getEscalationLevel,
  checkActiveBan,
  recordStrikeAndEscalate,
} from "./docs.guard"

// Mock prisma for DB calls
const mockFindMany = mock(async () => [])
const mockUpdateMany = mock(async () => ({ count: 1 }))
const mockCount = mock(async () => 0)
const mockCreate = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "ban_1",
  ...args.data,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiChatBan: {
      findMany: mockFindMany,
      create: mockCreate,
    },
    aiChatSession: {
      updateMany: mockUpdateMany,
    },
    aiChatMessage: {
      count: mockCount,
    },
  },
}))

describe("docs.guard - inspectPromptSafety", () => {
  it("allows safe and clean inputs", () => {
    const result = inspectPromptSafety("Bagaimana cara membuat invoice baru?")
    expect(result.ok).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it("allows legitimate double-dash text", () => {
    const result = inspectPromptSafety("Lihat halaman 10--15 untuk rinciannya")

    expect(result.ok).toBe(true)
  })

  it("rejects inputs exceeding max character limit (> 800 chars)", () => {
    const longText = "a".repeat(801)
    const result = inspectPromptSafety(longText)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("OVERSIZE")
    expect(result.message).toContain("800")
  })

  it("accepts inputs exactly at 800 characters", () => {
    const text800 = "a".repeat(800)
    const result = inspectPromptSafety(text800)
    expect(result.ok).toBe(true)
  })

  it("detects Indonesian profanities and slurs", () => {
    const words = ["anjing", "kontol", "bangsat", "memek", "goblok", "bajingan"]
    for (const word of words) {
      const result = inspectPromptSafety(`Halo bot ${word} banget sih`)
      expect(result.ok).toBe(false)
      expect(result.reason).toBe("PROFANITY")
    }
  })

  it("detects English profanities and slurs", () => {
    const words = ["fuck", "fucking", "shit", "bitch", "asshole", "dick"]
    for (const word of words) {
      const result = inspectPromptSafety(`What the ${word} is this?`)
      expect(result.ok).toBe(false)
      expect(result.reason).toBe("PROFANITY")
    }
  })

  it("detects custom blocked words configured per agent", () => {
    const customWords = ["competitorX", "scam_domain"]
    const result = inspectPromptSafety("Check out competitorX now", customWords)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("PROFANITY")
  })

  it("detects script and injection attacks", () => {
    const injections = [
      "<script>alert(1)</script>",
      "javascript:eval('x')",
      "<img src=x onerror=alert(1)>",
      "UNION SELECT * FROM users",
      "'; DROP TABLE AiChatMessage; --",
    ]
    for (const injection of injections) {
      const result = inspectPromptSafety(`Test query ${injection}`)
      expect(result.ok).toBe(false)
      expect(result.reason).toBe("INJECTION")
    }
  })
})

describe("docs.guard - checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimiterStores()
  })

  it("allows normal requests within IP rate limit (15 req / 60s)", () => {
    const ip = "192.168.1.1"
    const now = 100000

    for (let i = 0; i < 15; i++) {
      const result = checkRateLimit(ip, undefined, now + i * 100)
      expect(result.allowed).toBe(true)
    }

    // 16th request in same window should be blocked
    const overflow = checkRateLimit(ip, undefined, now + 2000)
    expect(overflow.allowed).toBe(false)
    expect(overflow.reason).toBe("IP_FLOOD")
    expect(overflow.retryAfterSec).toBeGreaterThan(0)
  })

  it("allows normal requests within User rate limit (5 req / 30s)", () => {
    const userId = "user_123"
    const now = 100000

    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(undefined, userId, now + i * 100)
      expect(result.allowed).toBe(true)
    }

    // 6th request in same window should be blocked
    const overflow = checkRateLimit(undefined, userId, now + 1000)
    expect(overflow.allowed).toBe(false)
    expect(overflow.reason).toBe("USER_RATE_LIMIT")
    expect(overflow.retryAfterSec).toBeGreaterThan(0)
  })

  it("evicts inactive IP and user buckets after their windows expire", () => {
    const deleteSpy = spyOn(Map.prototype, "delete")

    try {
      checkRateLimit("expired-ip", "expired-user", 100_000)
      checkRateLimit("live-ip", "live-user", 160_001)

      expect(deleteSpy).toHaveBeenCalledWith("expired-ip")
      expect(deleteSpy).toHaveBeenCalledWith("expired-user")
    } finally {
      deleteSpy.mockRestore()
    }
  })
})

describe("docs.guard - getEscalationLevel", () => {
  it("escalates properly across 5 levels", () => {
    expect(getEscalationLevel(2)).toEqual({
      offenseLevel: 0,
      durationMs: 0,
      isPermanent: false,
    })
    // 3 strikes -> Level 1 (1 hour)
    expect(getEscalationLevel(3)).toEqual({
      offenseLevel: 1,
      durationMs: 3600000,
      isPermanent: false,
    })
    // 5 strikes -> Level 2 (12 hours)
    expect(getEscalationLevel(5)).toEqual({
      offenseLevel: 2,
      durationMs: 43200000,
      isPermanent: false,
    })
    // 8 strikes -> Level 3 (24 hours)
    expect(getEscalationLevel(8)).toEqual({
      offenseLevel: 3,
      durationMs: 86400000,
      isPermanent: false,
    })
    // 12 strikes -> Level 4 (7 days)
    expect(getEscalationLevel(12)).toEqual({
      offenseLevel: 4,
      durationMs: 604800000,
      isPermanent: false,
    })
    // 15 strikes -> Level 5 (Permanent)
    expect(getEscalationLevel(15)).toEqual({
      offenseLevel: 5,
      durationMs: 0,
      isPermanent: true,
    })
  })
})

describe("docs.guard - checkActiveBan & recordStrikeAndEscalate", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
    mockUpdateMany.mockReset()
    mockCount.mockReset()
    mockCreate.mockReset()
  })

  it("returns not banned when no ban record is active", async () => {
    mockFindMany.mockResolvedValueOnce([])
    const result = await checkActiveBan({
      organizationId: "org_1",
      userId: "user_1",
    })
    expect(result.isBanned).toBe(false)
  })

  it("returns isBanned: true when an active ban exists", async () => {
    const futureDate = new Date(Date.now() + 3600000)
    mockFindMany.mockResolvedValueOnce([
      {
        id: "ban_1",
        banType: "ORGANIZATION",
        offenseLevel: 1,
        isPermanent: false,
        blockedUntil: futureDate,
        reason: "Spam",
      },
    ] as never)

    const result = await checkActiveBan({ organizationId: "org_1" })
    expect(result.isBanned).toBe(true)
    expect(result.offenseLevel).toBe(1)
    expect(result.banType).toBe("ORGANIZATION")
  })

  it("does not escalate before the third committed strike", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockCount.mockResolvedValueOnce(2)
    mockCreate.mockImplementationOnce(
      async (args: { data: Record<string, unknown> }) => ({
        id: "ban_early",
        ...args.data,
      })
    )

    const result = await recordStrikeAndEscalate({
      sessionId: "sess_1",
      organizationId: "org_1",
      reason: "PROFANITY",
    })

    expect(result.isBanned).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates a permanent ban when 15 committed strikes are reached", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockCount.mockResolvedValueOnce(15)
    mockCreate.mockImplementationOnce(
      async (args: { data: Record<string, unknown> }) => ({
        id: "ban_perm",
        ...args.data,
      })
    )

    const result = await recordStrikeAndEscalate({
      sessionId: "sess_1",
      organizationId: "org_1",
      reason: "PROFANITY",
    })

    expect(result.isBanned).toBe(true)
    expect(result.offenseLevel).toBe(5)
    expect(result.isPermanent).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})
