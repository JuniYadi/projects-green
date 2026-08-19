import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockCount = mock(async () => 0)
const mockAggregate = mock(async () => ({
  _sum: { sent: 0, failed: 0 },
}))

const mockPrisma = {
  whatsappBroadcastCampaign: {
    count: mockCount,
    aggregate: mockAggregate,
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const authContext = {
  type: "workos" as const,
  userId: "user-1",
  email: "admin@example.com",
  organizationId: "org-1",
  orgRole: "admin" as const,
  platformRole: "none",
  source: "proxy_header" as const,
}

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mock(async () => authContext),
}))

const { broadcastsRoutes } = await import("./broadcasts.route")

const createTestApp = () => new Elysia().use(broadcastsRoutes).compile()

describe("broadcastsRoutes summary", () => {
  beforeEach(() => {
    mockCount.mockReset()
    mockAggregate.mockReset()
    mockCount.mockResolvedValueOnce(7).mockResolvedValueOnce(2)
    mockAggregate
      .mockResolvedValueOnce({ _sum: { sent: 5, failed: 0 } })
      .mockResolvedValueOnce({ _sum: { sent: 0, failed: 1 } })
  })

  it("returns campaign totals scoped to the authenticated organization", async () => {
    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/summary")
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      total: 7,
      active: 2,
      sent: 5,
      failed: 1,
    })
    expect(mockCount).toHaveBeenNthCalledWith(1, {
      where: { organizationId: "org-1" },
    })
    expect(mockCount).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: "org-1",
        status: { in: ["QUEUED", "PROCESSING"] },
      },
    })
    expect(mockAggregate).toHaveBeenNthCalledWith(1, {
      where: { organizationId: "org-1" },
      _sum: { sent: true },
    })
    expect(mockAggregate).toHaveBeenNthCalledWith(2, {
      where: { organizationId: "org-1" },
      _sum: { failed: true },
    })
  })
})
