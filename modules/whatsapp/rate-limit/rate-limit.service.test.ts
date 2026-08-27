import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockCreate = mock(() => Promise.resolve({}))
const mockCount = mock(() => Promise.resolve(0))
const mockGroupBy = mock(() => Promise.resolve([]))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappApiCall: {
      create: mockCreate,
      count: mockCount,
      groupBy: mockGroupBy,
    },
  },
}))

import { ApiCallTracker, apiCallTracker } from "./rate-limit.service"

describe("ApiCallTracker", () => {
  beforeEach(() => {
    mockCreate.mockClear()
    mockCount.mockClear()
    mockGroupBy.mockClear()
  })

  it("exports a singleton instance", () => {
    expect(apiCallTracker).toBeInstanceOf(ApiCallTracker)
  })

  it("records an API call with provided fields", async () => {
    mockCreate.mockResolvedValueOnce({ id: "call-1" })

    await apiCallTracker.recordCall({
      organizationId: "org-123",
      operation: "messages.send",
      phoneNumberId: "phone-1",
      status: 200,
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-123",
        operation: "messages.send",
        phoneNumberId: "phone-1",
        status: 200,
      },
    })
  })

  it("records an API call with default null organizationId if omitted", async () => {
    mockCreate.mockResolvedValueOnce({ id: "call-2" })

    await apiCallTracker.recordCall({
      operation: "templates.fetch",
      phoneNumberId: "phone-2",
      status: 404,
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organizationId: null,
        operation: "templates.fetch",
        phoneNumberId: "phone-2",
        status: 404,
      },
    })
  })

  it("counts recent API calls within specified time window", async () => {
    mockCount.mockResolvedValueOnce(42)

    const count = await apiCallTracker.getCallCount("phone-1", 5)

    expect(count).toBe(42)
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        phoneNumberId: "phone-1",
        createdAt: {
          gte: expect.any(Date),
        },
      },
    })
  })

  it("counts recent errors (429, 5xx)", async () => {
    mockCount.mockResolvedValueOnce(3)

    const errors = await apiCallTracker.getRecentErrors("phone-1", 10)

    expect(errors).toBe(3)
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        phoneNumberId: "phone-1",
        createdAt: {
          gte: expect.any(Date),
        },
        status: { in: [429, 500, 502, 503, 504] },
      },
    })
  })

  it("gets daily volume grouped by phone number and handles null phoneNumberId", async () => {
    mockGroupBy.mockResolvedValueOnce([
      { phoneNumberId: "phone-1", _count: { id: 150 } },
      { phoneNumberId: null, _count: { id: 10 } },
    ])

    const volume = await apiCallTracker.getDailyVolume("org-123")

    expect(volume).toEqual([
      { phoneNumberId: "phone-1", count: 150 },
      { phoneNumberId: "unknown", count: 10 },
    ])
    expect(mockGroupBy).toHaveBeenCalledWith({
      by: ["phoneNumberId"],
      where: {
        organizationId: "org-123",
        createdAt: { gte: expect.any(Date) },
      },
      _count: { id: true },
    })
  })
})
