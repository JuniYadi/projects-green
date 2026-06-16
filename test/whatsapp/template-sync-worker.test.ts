import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Job } from "bullmq"

process.env.REDIS_URL = "redis://localhost:6379/0"

const workerOnMock = mock((_event: string, _handler: unknown) => undefined)
const workerCloseMock = mock(async () => undefined)
let capturedProcessor: ((job: Job<any>) => Promise<void>) | null = null

class WorkerMock {
  name: string

  constructor(name: string, processor: (job: Job<any>) => Promise<void>) {
    this.name = name
    capturedProcessor = processor
  }

  on(event: string, handler: unknown) {
    return workerOnMock(event, handler)
  }

  async close() {
    return workerCloseMock()
  }
}

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(async (..._args: unknown[]) => null as unknown),
  },
  whatsappTemplate: {
    findFirst: mock(async (..._args: unknown[]) => null as unknown),
    create: mock(async (..._args: unknown[]) => ({})),
    update: mock(async (..._args: unknown[]) => ({})),
  },
  whatsappTemplateLanguage: {
    upsert: mock(async (..._args: unknown[]) => ({})),
  },
}

const listTemplatesPageMock = mock(
  async (..._args: unknown[]) => ({ data: [] }) as unknown
)
const fromDeviceMock = mock(async (..._args: unknown[]) => ({
  listTemplatesPage: listTemplatesPageMock,
}))

class QueueMock {}

mock.module("bullmq", () => ({ Queue: QueueMock, Worker: WorkerMock }))
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: { fromDevice: fromDeviceMock },
}))

await import("@/scripts/whatsapp-template-sync-worker")

beforeEach(() => {
  workerOnMock.mockClear()
  workerCloseMock.mockClear()
  mockPrisma.whatsappDevice.findFirst.mockClear()
  mockPrisma.whatsappTemplate.findFirst.mockClear()
  mockPrisma.whatsappTemplate.create.mockClear()
  mockPrisma.whatsappTemplate.update.mockClear()
  mockPrisma.whatsappTemplateLanguage.upsert.mockClear()
  listTemplatesPageMock.mockClear()
  fromDeviceMock.mockClear()

  mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
    id: "device_1",
    organizationId: "org_1",
    tokenEncrypted: "encrypted-token",
    whatsappPhoneId: "phone_1",
    whatsappBusinessAccountId: "waba_1",
  })
  mockPrisma.whatsappTemplate.findFirst.mockResolvedValue(null)
  listTemplatesPageMock.mockResolvedValue({ data: [] })
  fromDeviceMock.mockResolvedValue({ listTemplatesPage: listTemplatesPageMock })
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

    await capturedProcessor?.({
      id: "job_1",
      name: "sync-templates",
      attemptsMade: 0,
      data: {
        organizationId: "org_1",
        deviceId: "device_1",
        method: "sync-templates",
      },
    } as Job<any>)

    expect(fromDeviceMock).toHaveBeenCalledWith({
      accessToken: "encrypted-token",
      phoneNumberId: "phone_1",
      wabaId: "waba_1",
    })
    expect(listTemplatesPageMock).toHaveBeenNthCalledWith(1, undefined)
    expect(listTemplatesPageMock).toHaveBeenNthCalledWith(2, "cursor_2")
    expect(mockPrisma.whatsappTemplate.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.whatsappTemplate.create.mock.calls[0]?.[0]).toMatchObject(
      {
        data: {
          organizationId: "org_1",
          slug: "welcome-message",
          name: "welcome_message",
          description: "MARKETING",
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

    await capturedProcessor?.({
      id: "job_2",
      name: "sync-status",
      attemptsMade: 0,
      data: {
        organizationId: "org_1",
        deviceId: "device_1",
        method: "sync-status",
      },
    } as Job<any>)

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
  })
})
