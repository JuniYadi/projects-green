import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Job } from "bullmq"

process.env.REDIS_URL = "redis://localhost:6379/0"

// ─── BullMQ mocks ───────────────────────────────────────────────────────────────

let capturedProcessor: ((job: Job<any>) => Promise<void>) | null = null

class WorkerMock {
  constructor(_name: string, processor: (job: Job<any>) => Promise<void>) {
    capturedProcessor = processor
  }
  on(_event: string, _handler: unknown) {
    return this
  }
  async close() {}
}

class QueueMock {
  constructor(..._args: unknown[]) {}
  async add(..._args: unknown[]) {
    return {} as unknown
  }
  async close() {}
}

// ─── Client mocks ────────────────────────────────────────────────────────────────

const sendTemplateMessageMock = mock(async () => ({
  providerMessageId: "wmid",
})) as any
const fromDeviceMock = mock(async () => ({
  sendTemplateMessage: sendTemplateMessageMock,
})) as any

// ─── Prisma mocks ────────────────────────────────────────────────────────────────

const recipientFU = mock(async () => null) as any
const recipientUpd = mock(async () => ({})) as any
const recipientGB = mock(async () => []) as any
const campaignFU = mock(async () => null) as any
const campaignUpd = mock(async () => ({})) as any
const rateFU = mock(async () => null) as any
const rateUp = mock(async () => ({})) as any
const convUp = mock(async () => ({ id: "c" })) as any
const msgCr = mock(async () => ({ id: "m" })) as any

mock.module("bullmq", () => ({ Queue: QueueMock, Worker: WorkerMock }) as any)
mock.module(
  "@/lib/prisma",
  () =>
    ({
      prisma: {
        whatsappBroadcastRecipient: {
          findUnique: recipientFU,
          update: recipientUpd,
          groupBy: recipientGB,
        },
        whatsappBroadcastCampaign: {
          findUnique: campaignFU,
          update: campaignUpd,
        },
        whatsappBroadcastRateState: {
          findUnique: rateFU,
          upsert: rateUp,
        },
        whatsappConversation: { upsert: convUp },
        whatsappMessage: { create: msgCr },
      },
    }) as any
)
mock.module(
  "@/lib/whatsapp/meta-cloud/device-client",
  () =>
    ({
      WhatsAppDeviceClient: { fromDevice: fromDeviceMock },
    }) as any
)

// Import under test
await import("@/scripts/whatsapp-broadcast-worker")

// ─── Fixture factories ───────────────────────────────────────────────────────────

function recipient(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    broadcastId: "c1",
    phoneNumber: "+1555",
    status: "QUEUED",
    attempts: 0,
    waMessageId: null,
    lastError: null,
    dynamicValues: null,
    name: "T",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    organizationId: "o1",
    templateName: "t1",
    templateLanguage: "en",
    templateParams: ["p1"],
    status: "PROCESSING",
    total: 1,
    queued: 1,
    sent: 0,
    failed: 0,
    startedAt: new Date(),
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    whatsappContactGroupId: null,
    whatsappDeviceId: "d1",
    throttleMaxMessages: null,
    throttlePerMinutes: null,
    ...overrides,
  }
}

function device(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    tokenEncrypted: "tok",
    whatsappPhoneId: "pid",
    whatsappBusinessAccountId: "waba",
    ...overrides,
  }
}

function fullRecipient() {
  return recipient({ broadcast: campaign({ whatsappDevice: device() }) })
}

// ─── Setup ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  for (const m of [
    sendTemplateMessageMock,
    fromDeviceMock,
    recipientFU,
    recipientUpd,
    recipientGB,
    campaignFU,
    campaignUpd,
    rateFU,
    rateUp,
    convUp,
    msgCr,
  ]) {
    m.mockClear()
  }

  recipientFU.mockResolvedValue(fullRecipient())
  campaignFU.mockResolvedValue(campaign())
  fromDeviceMock.mockResolvedValue({
    sendTemplateMessage: sendTemplateMessageMock,
  })
  sendTemplateMessageMock.mockResolvedValue({ providerMessageId: "wmid" })
  recipientGB.mockResolvedValue([{ status: "SENT", _count: { _all: 1 } }])
  convUp.mockResolvedValue({ id: "c" })
  msgCr.mockResolvedValue({ id: "m" })
})

function exec(data: Record<string, string>) {
  return capturedProcessor!({
    id: "j",
    name: "t",
    attemptsMade: 0,
    data,
  } as Job<any>)
}

// ─── Dispatch ────────────────────────────────────────────────────────────────────

describe("dispatch", () => {
  it("sends template via Meta API and creates conversation + message records", async () => {
    await exec({ campaignId: "c1", recipientId: "r1", method: "dispatch" })

    expect(fromDeviceMock).toHaveBeenCalledWith({
      accessToken: "tok",
      phoneNumberId: "pid",
      wabaId: "waba",
    })
    expect(sendTemplateMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+1555",
        templateName: "t1",
        templateLanguage: "en",
        fields: ["p1"],
      })
    )
    expect(convUp).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_contactPhone: {
            organizationId: "o1",
            contactPhone: "+1555",
          },
        },
        create: expect.objectContaining({
          organizationId: "o1",
          contactPhone: "+1555",
          lastDirection: "OUTBOX",
        }),
      })
    )
    expect(msgCr).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: "OUTBOX",
          messageType: "template",
          waMessageId: "wmid",
        }),
      })
    )
    expect(recipientUpd).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({ status: "SENT", waMessageId: "wmid" }),
      })
    )
  })

  it("marks recipient FAILED on Meta API error", async () => {
    sendTemplateMessageMock.mockRejectedValue(new Error("rate limit hit"))
    await exec({ campaignId: "c1", recipientId: "r1", method: "dispatch" })

    expect(recipientUpd).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          lastError: "rate limit hit",
        }),
      })
    )
  })

  it("skips sending when recipient is already SENT", async () => {
    recipientFU.mockResolvedValue(
      recipient({
        status: "SENT",
        broadcast: campaign({ whatsappDevice: device() }),
      })
    )
    await exec({ campaignId: "c1", recipientId: "r1", method: "dispatch" })
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
  })

  it("fails recipient when device credentials are missing", async () => {
    recipientFU.mockResolvedValue(
      recipient({ broadcast: campaign({ whatsappDevice: null }) })
    )
    await exec({ campaignId: "c1", recipientId: "r1", method: "dispatch" })
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
    expect(recipientUpd).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    )
  })

  it("includes dynamic values in template fields", async () => {
    recipientFU.mockResolvedValue(
      recipient({
        dynamicValues: { "{{1}}": "Alice", "{{2}}": "Bob" },
        broadcast: campaign({
          templateParams: ["{{1}}", "{{2}}"],
          whatsappDevice: device(),
        }),
      })
    )
    await exec({ campaignId: "c1", recipientId: "r1", method: "dispatch" })
    expect(sendTemplateMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.arrayContaining(["Alice", "Bob"]),
      })
    )
  })
})

// ─── Throttle ────────────────────────────────────────────────────────────────────

describe("throttle", () => {
  it("allows sending when within limit and no rate state exists", async () => {
    campaignFU.mockResolvedValue(
      campaign({
        whatsappContactGroupId: "g1",
        throttleMaxMessages: 100,
        throttlePerMinutes: 5,
      })
    )
    rateFU.mockResolvedValue(null)
    await exec({ campaignId: "c1", recipientId: "r1", method: "throttle" })
    expect(sendTemplateMessageMock).toHaveBeenCalled()
    expect(rateUp).toHaveBeenCalled()
  })

  it("defers sending when rate limit is exceeded", async () => {
    campaignFU.mockResolvedValue(
      campaign({
        whatsappContactGroupId: "g1",
        throttleMaxMessages: 10,
        throttlePerMinutes: 1,
      })
    )
    rateFU.mockResolvedValue({
      organizationId: "o1",
      whatsappContactGroupId: "g1",
      windowStartAt: new Date(Date.now() - 10_000),
      messagesSentInWindow: 999,
    })
    await exec({ campaignId: "c1", recipientId: "r1", method: "throttle" })
    expect(sendTemplateMessageMock).not.toHaveBeenCalled()
  })

  it("sends without throttle when maxMessages is 0", async () => {
    campaignFU.mockResolvedValue(
      campaign({
        whatsappContactGroupId: "g1",
        throttleMaxMessages: 0,
        throttlePerMinutes: 0,
      })
    )
    await exec({ campaignId: "c1", recipientId: "r1", method: "throttle" })
    expect(sendTemplateMessageMock).toHaveBeenCalled()
  })

  it("sends without throttle when no contact group", async () => {
    campaignFU.mockResolvedValue(campaign({ whatsappContactGroupId: null }))
    await exec({ campaignId: "c1", recipientId: "r1", method: "throttle" })
    expect(sendTemplateMessageMock).toHaveBeenCalled()
  })
})

// ─── Status Update ───────────────────────────────────────────────────────────────

describe("status-update", () => {
  it("sets COMPLETED when all recipients sent", async () => {
    recipientGB.mockResolvedValue([{ status: "SENT", _count: { _all: 1 } }])
    campaignFU.mockResolvedValue(campaign({ total: 1 }))
    await exec({ campaignId: "c1", recipientId: "r1", method: "status-update" })
    expect(campaignUpd).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          endedAt: expect.any(Date),
        }),
      })
    )
  })

  it("sets COMPLETED_WITH_ERRORS when some fail", async () => {
    recipientGB.mockResolvedValue([
      { status: "SENT", _count: { _all: 2 } },
      { status: "FAILED", _count: { _all: 1 } },
    ])
    campaignFU.mockResolvedValue(campaign({ total: 3 }))
    await exec({ campaignId: "c1", recipientId: "r1", method: "status-update" })
    expect(campaignUpd).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED_WITH_ERRORS",
          sent: 2,
          failed: 1,
          endedAt: expect.any(Date),
        }),
      })
    )
  })

  it("keeps PROCESSING while still in progress", async () => {
    recipientGB.mockResolvedValue([{ status: "SENT", _count: { _all: 1 } }])
    campaignFU.mockResolvedValue(campaign({ total: 5 }))
    await exec({ campaignId: "c1", recipientId: "r1", method: "status-update" })
    expect(campaignUpd).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PROCESSING" }),
      })
    )
    const call = campaignUpd.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(call.data.endedAt).toBeUndefined()
  })

  it("does nothing when campaign not found", async () => {
    campaignFU.mockResolvedValue(null)
    await exec({ campaignId: "c1", recipientId: "r1", method: "status-update" })
    expect(campaignUpd).not.toHaveBeenCalled()
  })
})
