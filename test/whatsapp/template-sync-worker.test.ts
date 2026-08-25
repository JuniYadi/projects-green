import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Job } from "bullmq"
import type { Prisma } from "@prisma/client"

process.env.REDIS_URL = "redis://localhost:6379/0"

const workerOnMock = mock((_event: string, _handler: unknown) => undefined)
const workerCloseMock = mock(async () => undefined)

class WorkerMock {
  name: string

  constructor(name: string, _processor: (job: Job<any>) => Promise<void>) {
    this.name = name
  }

  on(event: string, handler: unknown) {
    return workerOnMock(event, handler)
  }

  async close() {
    return workerCloseMock()
  }
}

const createTemplateMock = mock(async (..._args: unknown[]) => ({
  id: "meta-tpl-1",
  status: "PENDING",
  category: "UTILITY",
}))

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(async (..._args: unknown[]) => null as unknown),
  },
  whatsappTemplate: {
    findFirst: mock(async (..._args: unknown[]) => null as unknown),
    findMany: mock(async (..._args: unknown[]) => []),
    create: mock(async (..._args: unknown[]) => ({})),
    update:
      mock<(args: Prisma.WhatsappTemplateUpdateArgs) => Promise<unknown>>(),
    updateMany: mock(async (..._args: unknown[]) => ({ count: 0 })),
  },
  whatsappTemplateLanguage: {
    update: mock(async (..._args: unknown[]) => ({})),
    upsert: mock(async (..._args: unknown[]) => ({})),
  },
}

const listTemplatesPageMock = mock(
  async (..._args: unknown[]) => ({ data: [] }) as unknown
)
const fromDeviceMock = mock(async (..._args: unknown[]) => ({
  listTemplatesPage: listTemplatesPageMock,
  createTemplate: createTemplateMock,
}))
const logWhatsappAuditEventMock = mock(async (..._args: unknown[]) => undefined)

class QueueMock {}

mock.module("bullmq", () => ({ Queue: QueueMock, Worker: WorkerMock }))
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: { fromDevice: fromDeviceMock },
}))
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: logWhatsappAuditEventMock,
}))

const { syncTemplates, syncTemplateStatus } =
  await import("@/scripts/whatsapp-template-sync-worker")

beforeEach(() => {
  workerOnMock.mockClear()
  workerCloseMock.mockClear()
  mockPrisma.whatsappDevice.findFirst.mockClear()
  mockPrisma.whatsappTemplate.findFirst.mockClear()
  mockPrisma.whatsappTemplate.findMany.mockClear()
  mockPrisma.whatsappTemplate.create.mockClear()
  mockPrisma.whatsappTemplate.update.mockClear()
  mockPrisma.whatsappTemplateLanguage.update.mockClear()
  mockPrisma.whatsappTemplateLanguage.upsert.mockClear()
  createTemplateMock.mockClear()
  listTemplatesPageMock.mockClear()
  fromDeviceMock.mockClear()
  logWhatsappAuditEventMock.mockClear()

  mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
    id: "device_1",
    organizationId: "org_1",
    tokenEncrypted: "encrypted-token",
    whatsappPhoneId: "phone_1",
    whatsappBusinessAccountId: "waba_1",
  })
  mockPrisma.whatsappTemplate.findFirst.mockResolvedValue(null)
  mockPrisma.whatsappTemplate.findMany.mockResolvedValue([])
  listTemplatesPageMock.mockResolvedValue({ data: [] })
  fromDeviceMock.mockResolvedValue({
    listTemplatesPage: listTemplatesPageMock,
    createTemplate: createTemplateMock,
  })
})
describe("whatsapp-template-sync-worker", () => {
  it("fetches paginated templates and creates local template records", async () => {
    listTemplatesPageMock
      .mockResolvedValueOnce({
        data: [
          {
            name: "welcome_message",
            language: "en_US",
            status: "APPROVED",
            category: "MARKETING",
            components: [
              { type: "BODY", text: "Hello {{1}}" },
              { type: "FOOTER", text: "Thanks" },
            ],
          },
        ],
        paging: { cursors: { after: "cursor_2" } },
      })
      .mockResolvedValueOnce({
        data: [
          {
            name: "otp_code",
            language: "id",
            status: "PENDING",
            components: [{ type: "BODY", text: "Code {{1}}" }],
          },
        ],
      })

    await syncTemplates({
      organizationId: "org_1",
      deviceId: "device_1",
      method: "sync-templates",
    })

    expect(fromDeviceMock).toHaveBeenCalledWith({
      accessToken: "encrypted-token",
      phoneNumberId: "phone_1",
      wabaId: "waba_1",
      organizationId: "org_1",
    })
    expect(listTemplatesPageMock).toHaveBeenNthCalledWith(1, undefined)
    expect(listTemplatesPageMock).toHaveBeenNthCalledWith(2, "cursor_2")
    expect(mockPrisma.whatsappTemplate.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.whatsappTemplate.create.mock.calls[0]?.[0]).toMatchObject(
      {
        data: {
          organizationId: "org_1",
          slug: "welcome_message",
          name: "welcome_message",
          category: "MARKETING",
          syncStatus: "SYNCED",
          metaStatus: "APPROVED",
          whatsappDevice: { connect: { id: "device_1" } },
          languages: {
            create: {
              lang: "en_US",
              body: "Hello {{1}}",
              footer: "Thanks",
              parameters: {
                components: [
                  { type: "BODY", text: "Hello {{1}}" },
                  { type: "FOOTER", text: "Thanks" },
                ],
              },
              isApproved: true,
              metaStatus: "APPROVED",
            },
          },
        },
      }
    )

    // Audit assertions — STARTED then SYNCED
    expect(logWhatsappAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TEMPLATE_SYNC_STARTED",
        status: "STARTED",
      })
    )
    expect(logWhatsappAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEMPLATE_SYNCED", status: "OK" })
    )
  })

  it("updates status and stores rejection reason on rejected templates", async () => {
    mockPrisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: "template_1",
    })
    listTemplatesPageMock.mockResolvedValue({
      data: [
        {
          name: "welcome_message",
          language: "en_US",
          status: "REJECTED",
          rejected_reason: "INVALID_FORMAT",
          components: [{ type: "BODY", text: "Hello" }],
        },
      ],
    })

    await syncTemplateStatus({
      organizationId: "org_1",
      deviceId: "device_1",
      method: "sync-status",
    })

    expect(mockPrisma.whatsappTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template_1" },
        data: expect.objectContaining({
          syncStatus: "SYNCED",
          metaStatus: "REJECTED",
        }),
      })
    )
    expect(mockPrisma.whatsappTemplateLanguage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateId_lang: {
            templateId: "template_1",
            lang: "en_US",
          },
        },
        update: expect.objectContaining({
          metaStatus: "REJECTED",
          rejectReason: "INVALID_FORMAT",
        }),
      })
    )

    // Audit — STARTED then SYNCED for sync-status
    expect(logWhatsappAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TEMPLATE_SYNC_STARTED",
        status: "STARTED",
      })
    )
    expect(logWhatsappAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEMPLATE_SYNCED", status: "OK" })
    )
  })

  it("preserves a local display name while pulling Meta template status", async () => {
    mockPrisma.whatsappTemplate.findFirst.mockResolvedValue({
      id: "template_1",
      name: "Welcome Message",
      slug: "welcome_message",
    })
    listTemplatesPageMock.mockResolvedValue({
      data: [
        {
          name: "welcome_message",
          language: "en_US",
          status: "APPROVED",
          category: "MARKETING",
          components: [{ type: "BODY", text: "Hello" }],
        },
      ],
    })

    await syncTemplates({
      organizationId: "org_1",
      deviceId: "device_1",
      method: "sync-templates",
    })

    expect(mockPrisma.whatsappTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          whatsappDeviceId: "device_1",
          slug: { in: expect.arrayContaining(["welcome_message"]) },
        },
      })
    )
    const updateArgs = mockPrisma.whatsappTemplate.update.mock.calls[0]?.[0]
    if (!updateArgs) throw new Error("Expected template update arguments")
    expect(updateArgs.data.name).toBeUndefined()
    expect(updateArgs.data.slug).toBe("welcome_message")
  })

  it("emits TEMPLATE_SYNC_FAILED when sync-templates partially fails", async () => {
    // First template throws, second succeeds
    listTemplatesPageMock.mockResolvedValue({
      data: [
        { name: "fail", components: [] },
        {
          name: "ok",
          language: "en",
          components: [{ type: "BODY", text: "ok" }],
        },
      ],
    })
    mockPrisma.whatsappTemplate.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    mockPrisma.whatsappTemplate.create
      .mockRejectedValueOnce(new Error("Meta API error"))
      .mockResolvedValueOnce({})

    await expect(
      syncTemplates({
        organizationId: "org_1",
        deviceId: "device_1",
        method: "sync-templates",
      })
    ).rejects.toThrow("partially failed")

    // Verify audit event ordering: STARTED must come before FAILED
    const auditCalls = logWhatsappAuditEventMock.mock.calls as Array<
      [Record<string, unknown>]
    >
    expect(auditCalls.length).toBeGreaterThanOrEqual(2)
    const startedIdx = auditCalls.findIndex(
      (call) =>
        (call[0] as Record<string, unknown>)?.action === "TEMPLATE_SYNC_STARTED"
    )
    const failedIdx = auditCalls.findIndex(
      (call) =>
        (call[0] as Record<string, unknown>)?.action === "TEMPLATE_SYNC_FAILED"
    )
    expect(startedIdx).toBeLessThan(failedIdx)
    expect(auditCalls[failedIdx][0] as Record<string, unknown>).toMatchObject({
      action: "TEMPLATE_SYNC_FAILED",
      status: "FAILED",
    })
  })
  it("pushes un-synced local templates to Meta before pulling", async () => {
    mockPrisma.whatsappTemplate.findMany.mockResolvedValueOnce([
      {
        id: "tpl_local_1",
        name: "Order Confirmation",
        slug: "order_confirmation",
        category: "UTILITY",
        languages: [
          {
            id: "lang_1",
            lang: "id",
            headerType: "NONE",
            body: "Pesanan {{1}} berhasil!",
            footer: "Terima kasih",
            buttons: null,
          },
        ],
      },
    ] as any)
    listTemplatesPageMock.mockResolvedValue({
      data: [
        {
          name: "order_confirmation",
          language: "id",
          status: "PENDING",
          category: "UTILITY",
          components: [{ type: "BODY", text: "Pesanan {{1}} berhasil!" }],
        },
      ],
    })

    await syncTemplates({
      organizationId: "org_1",
      deviceId: "device_1",
      method: "sync-templates",
    })

    expect(createTemplateMock).toHaveBeenCalledWith({
      name: "order_confirmation",
      category: "UTILITY",
      language: "id",
      components: [
        {
          type: "BODY",
          text: "Pesanan {{1}} berhasil!",
          example: {
            body_text: [["Sample 1"]],
          },
        },
        { type: "FOOTER", text: "Terima kasih" },
      ],
    })
    expect(mockPrisma.whatsappTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl_local_1" },
        data: expect.objectContaining({
          syncStatus: "SYNCED",
          metaStatus: "PENDING",
        }),
      })
    )
  })
})
