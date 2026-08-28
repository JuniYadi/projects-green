import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import {
  WhatsappBroadcastRecipientStatus,
  WhatsappBroadcastStatus,
  type Prisma,
} from "@prisma/client"

type DeviceSelection = Prisma.WhatsappDeviceGetPayload<{
  select: { id: true }
}>
type TemplateSelection = Prisma.WhatsappTemplateGetPayload<{
  select: {
    id: true
    name: true
    languages: { select: { body: true } }
  }
}>
type Campaign = Prisma.WhatsappBroadcastCampaignGetPayload<{
  include: { recipients: true }
}>
type CampaignRecipient = Campaign["recipients"][number]
type BroadcastJob = {
  name: string
  data: { campaignId: string; recipientId: string; method: "dispatch" }
  opts: { jobId: string }
}
type SummaryAggregate = { _sum: { sent: number; failed: number } }

const campaignRecipient = (id: string): CampaignRecipient => ({
  id,
  broadcastId: "camp-123",
  status: WhatsappBroadcastRecipientStatus.QUEUED,
  phoneNumber: "+628123456789",
  name: null,
  dynamicValues: null,
  attempts: 0,
  waMessageId: null,
  lastError: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

const campaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: "camp-123",
  organizationId: "org-1",
  templateId: "template-1",
  templateName: "Authoritative template",
  templateLanguage: "en",
  templateParams: null,
  whatsappDeviceId: "device-1",
  whatsappContactGroupId: null,
  throttleMaxMessages: null,
  throttlePerMinutes: null,
  acknowledgeMultiDay: false,
  status: WhatsappBroadcastStatus.QUEUED,
  total: 1,
  queued: 1,
  sent: 0,
  failed: 0,
  startedAt: null,
  endedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  recipients: [campaignRecipient("recip-1")],
  ...overrides,
})

const mockCount = mock<() => Promise<number>>(async () => 0)
const mockAggregate = mock<() => Promise<SummaryAggregate>>(async () => ({
  _sum: { sent: 0, failed: 0 },
}))
const mockFindUnique = mock<() => Promise<Campaign | null>>(async () => null)
const mockCampaignUpdate = mock<() => Promise<Record<string, never>>>(
  async () => ({})
)
const mockCampaignCreate = mock<() => Promise<Campaign>>(async () => campaign())
const mockDeviceFindFirst = mock<() => Promise<DeviceSelection | null>>(
  async () => null
)
const mockTemplateFindFirst = mock<() => Promise<TemplateSelection | null>>(
  async () => null
)
const mockGetDeviceBroadcastCapacity = mock<
  () => Promise<{
    dailyLimit: number
    dailyUsed: number
    hourlyLimit: number
    hourlyUsed: number
    remainingToday: number
    remainingThisHour: number
  }>
>(async () => ({
  dailyLimit: 1000,
  dailyUsed: 0,
  hourlyLimit: 41,
  hourlyUsed: 0,
  remainingToday: 1000,
  remainingThisHour: 41,
}))
const mockComputeRecommendedSchedule = mock<
  () => Promise<{
    throttleMaxMessages: number
    throttlePerMinutes: number
    estimatedDurationMinutes: number
  }>
>(async () => ({
  throttleMaxMessages: 41,
  throttlePerMinutes: 60,
  estimatedDurationMinutes: 60,
}))
const mockValidateSchedule = mock<() => Promise<void>>(async () => {})

const mockCampaignFindMany = mock<() => Promise<Campaign[]>>(async () => [])

const mockPrisma = {
  whatsappBroadcastCampaign: {
    count: mockCount,
    aggregate: mockAggregate,
    findMany: mockCampaignFindMany,
    findUnique: mockFindUnique,
    update: mockCampaignUpdate,
    create: mockCampaignCreate,
  },
  whatsappDevice: {
    findFirst: mockDeviceFindFirst,
  },
  whatsappTemplate: {
    findFirst: mockTemplateFindFirst,
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

mock.module("../broadcast-schedule.service", () => ({
  getDeviceBroadcastCapacity: mockGetDeviceBroadcastCapacity,
  computeRecommendedSchedule: mockComputeRecommendedSchedule,
  validateSchedule: mockValidateSchedule,
}))

const mockAddBulk = mock<(jobs: BroadcastJob[]) => Promise<unknown[]>>(
  async () => []
)
mock.module("@/lib/queue/whatsapp-broadcast", () => ({
  getWhatsAppBroadcastQueue: () => ({
    addBulk: mockAddBulk,
  }),
  WHATSAPP_BROADCAST_JOB_NAME: "broadcast-message",
  enqueueWhatsAppBroadcast: mock(async () => {}),
}))
const { broadcastsRoutes } = await import("./broadcasts.route")

const createTestApp = () => new Elysia().use(broadcastsRoutes).compile()

beforeEach(() => {
  mockCount.mockClear()
  mockAggregate.mockClear()
  mockFindUnique.mockClear()
  mockCampaignUpdate.mockClear()
  mockCampaignCreate.mockClear()
  mockDeviceFindFirst.mockClear()
  mockTemplateFindFirst.mockClear()
  mockGetDeviceBroadcastCapacity.mockClear()
  mockComputeRecommendedSchedule.mockClear()
  mockValidateSchedule.mockClear()
  mockAddBulk.mockClear()

  mockCount.mockResolvedValue(0)
  mockAggregate.mockResolvedValue({ _sum: { sent: 0, failed: 0 } })
  mockFindUnique.mockResolvedValue(null)
  mockCampaignUpdate.mockResolvedValue({})
  mockCampaignCreate.mockResolvedValue(campaign())
  mockDeviceFindFirst.mockResolvedValue({ id: "device-1" })
  mockTemplateFindFirst.mockResolvedValue({
    id: "template-1",
    name: "Authoritative template",
    languages: [{ body: "Hello" }],
  })
  mockGetDeviceBroadcastCapacity.mockResolvedValue({
    dailyLimit: 1000,
    dailyUsed: 0,
    hourlyLimit: 41,
    hourlyUsed: 0,
    remainingToday: 1000,
    remainingThisHour: 41,
  })
  mockComputeRecommendedSchedule.mockResolvedValue({
    throttleMaxMessages: 41,
    throttlePerMinutes: 60,
    estimatedDurationMinutes: 60,
  })
  mockValidateSchedule.mockResolvedValue()
  mockAddBulk.mockResolvedValue([])
})

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
describe("broadcastsRoutes listing and detail", () => {
  it("applies bounded pagination when listing campaigns", async () => {
    mockCount.mockResolvedValueOnce(3)
    mockPrisma.whatsappBroadcastCampaign.findMany.mockResolvedValueOnce([])
    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts?page=2&limit=999")
    )
    expect(response.status).toBe(200)
    expect((await response.json()).meta).toEqual({
      total: 3,
      page: 2,
      limit: 100,
      totalPages: 1,
    })
    expect(mockPrisma.whatsappBroadcastCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 100 })
    )
  })

  it("returns not found for an unknown campaign", async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/missing")
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: "Broadcast campaign not found.",
    })
  })

  it("prevents another organization from reading a campaign", async () => {
    mockFindUnique.mockResolvedValueOnce(
      campaign({ organizationId: "org-other" })
    )
    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/foreign")
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access denied.",
    })
  })
})

describe("broadcastsRoutes /:id/send", () => {
  it("dispatches recipients in bulk with UUID v7 job IDs without colons", async () => {
    mockFindUnique.mockResolvedValueOnce(
      campaign({
        recipients: [
          campaignRecipient("recip-1"),
          campaignRecipient("recip-2"),
        ],
      })
    )

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

    const [jobs] = mockAddBulk.mock.calls[0] ?? []

    expect(jobs).toBeDefined()
    if (!jobs) throw new Error("Expected dispatch jobs")

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

  it("blocks dispatch when the selected template is no longer approved", async () => {
    mockFindUnique.mockResolvedValueOnce(campaign())
    mockTemplateFindFirst.mockResolvedValueOnce(null)

    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/camp-123/send", {
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message:
        "Select an active device, approved template, and valid language.",
    })
    expect(mockCampaignUpdate).not.toHaveBeenCalled()
    expect(mockAddBulk).not.toHaveBeenCalled()
  })

  it("revalidates persisted throttle settings before manual dispatch", async () => {
    mockFindUnique.mockResolvedValueOnce(
      campaign({ throttleMaxMessages: 99, throttlePerMinutes: 60 })
    )
    mockValidateSchedule.mockRejectedValueOnce(
      new Error("Selected rate exceeds the active device limit.")
    )

    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/camp-123/send", {
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Selected rate exceeds the active device limit.",
    })
    expect(mockValidateSchedule).toHaveBeenCalledWith({
      throttleMaxMessages: 99,
      throttlePerMinutes: 60,
      totalRecipients: 1,
      organizationId: "org-1",
      deviceId: "device-1",
      acknowledgeMultiDay: false,
    })
    expect(mockCampaignUpdate).not.toHaveBeenCalled()
    expect(mockAddBulk).not.toHaveBeenCalled()
  })
})

describe("broadcastsRoutes POST /preflight", () => {
  it("returns server-authoritative selection and capacity without scheduling a dispatch", async () => {
    mockTemplateFindFirst.mockResolvedValueOnce({
      id: "template-1",
      name: "Authoritative template",
      languages: [{ body: "Hello {{1}}" }],
    })

    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: "template-1",
          templateLanguage: "en",
          whatsappDeviceId: "device-1",
          throttleMaxMessages: 99,
          throttlePerMinutes: 60,
          recipients: [
            {
              phoneNumber: "+628123456789",
              dynamicValues: { "{{1}}": "Ayu" },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      selection: {
        deviceId: "device-1",
        templateId: "template-1",
        templateName: "Authoritative template",
        templateLanguage: "en",
        templateBody: "Hello {{1}}",
      },
      recipientCount: 1,
      dispatchMode: "MANUAL_DISPATCH",
      capacity: {
        dailyLimit: 1000,
        dailyUsed: 0,
        hourlyLimit: 41,
        hourlyUsed: 0,
        remainingToday: 1000,
        remainingThisHour: 41,
      },
      recommendation: {
        throttleMaxMessages: 41,
        throttlePerMinutes: 60,
        estimatedDurationMinutes: 60,
      },
    })
    expect(mockValidateSchedule).not.toHaveBeenCalled()
  })

  it("rejects a preflight request without recipients before querying selection", async () => {
    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: "template-1",
          templateLanguage: "en",
          whatsappDeviceId: "device-1",
          recipients: [],
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Add at least one valid recipient before continuing.",
    })
    expect(mockDeviceFindFirst).not.toHaveBeenCalled()
    expect(mockTemplateFindFirst).not.toHaveBeenCalled()
  })
})

describe("broadcastsRoutes POST /", () => {
  it("rejects a device, template, and language combination outside the organization", async () => {
    mockDeviceFindFirst.mockResolvedValue(null)
    mockTemplateFindFirst.mockResolvedValue(null)
    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: "template-other-org",
          templateName: "Untrusted template name",
          templateLanguage: "en",
          whatsappDeviceId: "device-other-org",
          recipients: [{ phoneNumber: "+628123456789" }],
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message:
        "Select an active device, approved template, and valid language.",
    })
    expect(mockDeviceFindFirst).toHaveBeenCalledWith({
      where: {
        id: "device-other-org",
        organizationId: "org-1",
        status: "ACTIVE",
      },
      select: { id: true },
    })
    expect(mockTemplateFindFirst).toHaveBeenCalledWith({
      where: {
        id: "template-other-org",
        organizationId: "org-1",
        whatsappDeviceId: "device-other-org",
        syncStatus: "SYNCED",
        metaStatus: "APPROVED",
        languages: {
          some: {
            lang: "en",
            OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
          },
        },
      },
      select: {
        id: true,
        name: true,
        languages: {
          where: {
            lang: "en",
            OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
          },
          select: { body: true },
          take: 1,
        },
      },
    })
  })

  it("rejects bypassed creation when a required recipient variable is missing", async () => {
    mockDeviceFindFirst.mockResolvedValue({ id: "device-1" })
    mockTemplateFindFirst.mockResolvedValue({
      id: "template-1",
      name: "Authoritative template",
      languages: [{ body: "Halo {{1}}" }],
    })

    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: "template-1",
          templateName: "Bypassed client value",
          templateLanguage: "id",
          whatsappDeviceId: "device-1",
          recipients: [{ phoneNumber: "+628123456789" }],
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message:
        "Recipient 1 is missing {{1}}. Add a non-empty value for every required template variable.",
    })
    expect(mockCampaignCreate).not.toHaveBeenCalled()
  })

  it("revalidates the selection and persists the server template identity", async () => {
    mockCampaignCreate.mockResolvedValueOnce(campaign())

    const response = await createTestApp().handle(
      new Request("http://localhost/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: "template-1",
          templateName: "Client-controlled template name",
          templateLanguage: "en",
          whatsappDeviceId: "device-1",
          throttleMaxMessages: 40,
          throttlePerMinutes: 60,
          acknowledgeMultiDay: true,
          recipients: [{ phoneNumber: "+628123456789" }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mockCampaignCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        templateId: "template-1",
        templateName: "Authoritative template",
        acknowledgeMultiDay: true,
        total: 1,
        queued: 1,
      }),
      include: { recipients: true },
    })
    expect(mockValidateSchedule).toHaveBeenCalledWith({
      throttleMaxMessages: 40,
      throttlePerMinutes: 60,
      totalRecipients: 1,
      organizationId: "org-1",
      deviceId: "device-1",
      acknowledgeMultiDay: true,
    })
  })
})
