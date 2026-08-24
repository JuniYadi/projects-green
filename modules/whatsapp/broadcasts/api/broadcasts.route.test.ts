import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockCount = mock(async () => 0)
const mockAggregate = mock(async () => ({
  _sum: { sent: 0, failed: 0 },
}))
const mockFindUnique = mock(async () => null)
const mockCampaignUpdate = mock(async () => ({}))

const mockPrisma = {
  whatsappBroadcastCampaign: {
    count: mockCount,
    aggregate: mockAggregate,
    findUnique: mockFindUnique,
    update: mockCampaignUpdate,
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

const mockAddBulk = mock(async () => [])
mock.module("@/lib/queue/whatsapp-broadcast", () => ({
  getWhatsAppBroadcastQueue: () => ({
    addBulk: mockAddBulk,
  }),
  WHATSAPP_BROADCAST_JOB_NAME: "broadcast-message",
  enqueueWhatsAppBroadcast: mock(async () => {}),
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

describe("broadcastsRoutes /:id/send", () => {
  beforeEach(() => {
    mockFindUnique.mockClear()
    mockCampaignUpdate.mockClear()
    mockAddBulk.mockClear()
  })

  it("dispatches recipients in bulk with UUID v7 job IDs without colons", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "camp-123",
      organizationId: "org-1",
      status: "QUEUED",
      recipients: [
        { id: "recip-1", status: "QUEUED" },
        { id: "recip-2", status: "QUEUED" },
      ],
    } as any)

    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/camp-123/send", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      message: "Dispatched 2 recipients for broadcasting.",
    })

    expect(mockCampaignUpdate).toHaveBeenCalledTimes(1)
    expect(mockAddBulk).toHaveBeenCalledTimes(1)

    const calls = mockAddBulk.mock.calls as unknown[][]
    const jobs = calls[0][0] as Array<{
      name: string
      data: { campaignId: string; recipientId: string; method: string }
      opts: { jobId: string }
    }>

    expect(jobs).toHaveLength(2)
    expect(jobs[0].opts.jobId).toMatch(
      /^wa-broadcast_dispatch_camp-123_recip-1_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(jobs[1].opts.jobId).toMatch(
      /^wa-broadcast_dispatch_camp-123_recip-2_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(jobs[0].opts.jobId).not.toContain(":")
    expect(jobs[1].opts.jobId).not.toContain(":")
    expect(jobs[0].opts.jobId).not.toBe(jobs[1].opts.jobId)
  })
})
