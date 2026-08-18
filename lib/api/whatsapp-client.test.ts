import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

type FetchCall = {
  input: string
  init?: RequestInit
}

const calls: FetchCall[] = []
const responses: Response[] = []
let fetchMock: ReturnType<typeof mock>

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const queueJson = (body: unknown, status = 200) => {
  responses.push(jsonResponse(body, status))
}

// Import after each test sets its browser origin so Eden uses that origin.
const client = async () =>
  (await import("@/lib/api/whatsapp-client")).whatsappClient

const bodyOf = (call: FetchCall) =>
  call.init?.body ? JSON.parse(String(call.init.body)) : undefined

describe("whatsappClient", () => {
  beforeEach(() => {
    calls.length = 0
    responses.length = 0
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300"

    const happyDOM = (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM
    happyDOM.setURL(
      "https://pgreen.tunnel.juniyadi.id/id/console/whatsapp/dashboard"
    )

    fetchMock = mock((input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input: input.toString(), init })
      return Promise.resolve(responses.shift() ?? jsonResponse({ ok: true }))
    })
    fetchMock.mockClear()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL
  })

  it("uses browser origin and serializes device requests", async () => {
    const whatsappClient = await client()
    queueJson({ ok: true, devices: [] })
    await whatsappClient.devices.list()
    expect(calls[0]?.input).toBe(
      "https://pgreen.tunnel.juniyadi.id/api/whatsapp/devices"
    )

    queueJson({ ok: true, device: {} })
    await whatsappClient.devices.get("device-1")
    expect(calls[1]?.input).toContain("/api/whatsapp/devices/device-1")

    queueJson({ ok: true, device: {} })
    await whatsappClient.devices.update("device-1", {
      phoneNumber: "+6281234567890",
      displayName: "Support",
    })
    expect(calls[2]?.init?.method).toBe("PATCH")
    expect(bodyOf(calls[2]!)).toEqual({
      phoneNumber: "+6281234567890",
      displayName: "Support",
    })

    queueJson({ ok: true, device: {} })
    await whatsappClient.devices.verify("device-1")
    queueJson({ ok: true, device: {} })
    await whatsappClient.devices.reconnect("device-1")
    expect(calls[3]?.init?.method).toBe("POST")
    expect(calls[4]?.init?.method).toBe("POST")

    queueJson({ ok: true, profile: {} })
    await whatsappClient.devices.profile.get("device-1")
    queueJson({ ok: true, profile: {} })
    await whatsappClient.devices.profile.update("device-1", { about: "Hello" })
    expect(calls[6]?.init?.method).toBe("PATCH")
    expect(bodyOf(calls[6]!)).toEqual({ about: "Hello" })
    queueJson({ ok: true, message: "queued" })
    await whatsappClient.devices.syncTemplates("device-1")
    responses.push(jsonResponse({ message: "sync failed" }, 500))
    await expect(
      whatsappClient.devices.syncTemplates("device-1")
    ).rejects.toThrow()
    queueJson({ ok: false, message: "sync rejected" })
    await expect(
      whatsappClient.devices.syncTemplates("device-1")
    ).rejects.toThrow("sync rejected")
  })

  it("calls every message and conversation method with the right request", async () => {
    const whatsappClient = await client()
    queueJson({ ok: true, messages: [] })
    await whatsappClient.messages.list({
      conversationId: "conversation-1",
      direction: "INBOUND",
      messageType: "TEXT",
    })
    expect(calls[0]?.input).toContain("conversationId=conversation-1")
    expect(calls[0]?.input).toContain("direction=INBOUND")

    queueJson({ ok: true, message: {} })
    await whatsappClient.messages.get("message-1")
    queueJson({ ok: true, message: {} })
    await whatsappClient.messages.create({ text: "hello" })
    queueJson({ ok: true, message: {} })
    await whatsappClient.messages.update("message-1", { status: "READ" })
    queueJson({ ok: true })
    await whatsappClient.messages.delete("message-1")
    queueJson({
      ok: true,
      jobId: "job",
      messageId: "message",
      waMessageId: "wa",
      status: "sent",
    })
    await whatsappClient.messages.send({
      phoneNumber: "+6281234567890",
      message: "hello",
      deviceId: "device-1",
    })
    queueJson({
      ok: true,
      jobId: "job",
      messageId: "message",
      waMessageId: "wa",
      status: "sent",
    })
    await whatsappClient.messages.sendInteractive({
      phoneNumber: "+6281234567890",
      deviceId: "device-1",
      interactive: { type: "button" },
    })
    queueJson({
      ok: true,
      jobId: "job",
      messageId: "message",
      waMessageId: "wa",
      status: "sent",
    })
    await whatsappClient.messages.sendTemplate({
      phoneNumber: "+6281234567890",
      templateId: "template-1",
      templateLanguage: "en_US",
      fields: ["Ada"],
      deviceId: "device-1",
    })
    expect(calls[2]?.init?.method).toBe("POST")
    expect(calls[3]?.init?.method).toBe("PATCH")
    expect(calls[4]?.init?.method).toBe("DELETE")
    expect(calls[5]?.input).toContain("/messages/send")
    expect(calls[6]?.input).toContain("/messages/send-interactive")
    expect(calls[7]?.input).toContain("/messages/send-template")

    queueJson({ ok: true, conversations: [] })
    await whatsappClient.conversations.list({
      contactPhone: "+6281234567890",
      status: "OPEN",
      limit: 10,
    })
    queueJson({ ok: true, conversation: {} })
    await whatsappClient.conversations.get("conversation-1")
    queueJson({ ok: true, conversation: {} })
    await whatsappClient.conversations.create({
      contactPhone: "+6281234567890",
    })
    queueJson({ ok: true, conversation: {} })
    await whatsappClient.conversations.update("conversation-1", {
      internalNotes: "important",
      labelIds: ["label-1"],
    })
    queueJson({ ok: true })
    await whatsappClient.conversations.delete("conversation-1")
    queueJson({ ok: true, labels: [] })
    await whatsappClient.conversations.getLabels()
    queueJson({ ok: true, label: {} })
    await whatsappClient.conversations.createLabel({ name: "VIP", color: null })
    expect(calls[8]?.input).toContain("contactPhone=%2B6281234567890")
    expect(calls[11]?.init?.method).toBe("PATCH")
    expect(calls[12]?.init?.method).toBe("DELETE")
    expect(calls[13]?.input).toContain("/conversations/labels")
    expect(calls[14]?.init?.method).toBe("POST")
  })

  it("covers contacts, media, usage, catalogs, analytics and webhooks", async () => {
    const whatsappClient = await client()
    queueJson({ ok: true, contacts: [] })
    await whatsappClient.contacts.list({
      contactGroupId: "group-1",
      status: "ACTIVE",
      phoneNumber: "+6281234567890",
    })
    queueJson({ ok: true, contact: {} })
    await whatsappClient.contacts.get("contact-1")
    queueJson({ ok: true, contact: {} })
    await whatsappClient.contacts.create({ phoneNumber: "+6281234567890" })
    queueJson({ ok: true, contact: {} })
    await whatsappClient.contacts.update("contact-1", { name: "Ada" })
    queueJson({ ok: true })
    await whatsappClient.contacts.delete("contact-1")

    queueJson({ ok: true, media: [] })
    await whatsappClient.media.list({ deviceId: "device-1" })
    queueJson({ ok: true, media: {} })
    await whatsappClient.media.get("media-1")
    queueJson({ ok: true })
    await whatsappClient.media.delete("media-1")
    queueJson({ ok: true, media: {} })
    await whatsappClient.media.upload(
      new File(["hello"], "hello.txt"),
      "device-1"
    )
    expect(calls[3]?.init?.method).toBe("PATCH")
    expect(calls[4]?.init?.method).toBe("DELETE")
    expect(calls[8]?.init?.method).toBe("POST")
    expect(calls[8]?.init?.body).toBeInstanceOf(FormData)
    expect(whatsappClient.media.downloadUrl("media-1")).toBe(
      "/api/whatsapp/media/media-1/download"
    )

    queueJson({ ok: true, month: [], today: [], cost: {}, devices: [] })
    await whatsappClient.usage.overview()
    queueJson({ ok: true, counts: [] })
    await whatsappClient.usage.daily({ from: "2024-01-01", to: "2024-01-31" })
    queueJson({ ok: true, counts: [] })
    await whatsappClient.usage.monthly({ year: 2024, month: 1 })
    queueJson({ ok: true, totalAmount: 1, totalEntries: 1, byCategory: [] })
    await whatsappClient.usage.cost({ period: "month" })
    queueJson({ ok: true, period: "month", totalCost: 1 })
    await whatsappClient.usage.costBreakdown({
      period: "month",
      deviceId: "device-1",
    })

    queueJson({
      ok: true,
      meta: { total: 7, page: 1, limit: 1, totalPages: 7 },
    })
    await whatsappClient.broadcasts.summary()

    queueJson({ ok: true, data: [] })
    await whatsappClient.catalogs.list()
    queueJson({ ok: true, data: {} })
    await whatsappClient.catalogs.get("catalog-1")
    queueJson({ ok: true, data: {} })
    await whatsappClient.catalogs.create({
      name: "Store",
      metaCatalogId: "meta-1",
    })
    queueJson({ ok: true, data: {} })
    await whatsappClient.catalogs.update("catalog-1", { name: "New Store" })
    queueJson({ ok: true })
    await whatsappClient.catalogs.delete("catalog-1")
    queueJson({ ok: true, data: { synced: 1 } })
    await whatsappClient.catalogs.sync("catalog-1")
    queueJson({ ok: true, data: [] })
    await whatsappClient.catalogs.listProducts("catalog-1")
    queueJson({ ok: true, data: { providerMessageId: "provider-1" } })
    await whatsappClient.catalogs.sendMessage({
      to: "+6281234567890",
      catalogId: "catalog-1",
      type: "product",
    })

    queueJson({ ok: true, syncedCount: 1, discrepancies: [] })
    await whatsappClient.analytics.sync({
      deviceId: "device-1",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    })
    queueJson({
      ok: true,
      from: "2024-01-01",
      to: "2024-01-31",
      deviceId: "device-1",
      comparisons: [],
      summary: {},
    })
    await whatsappClient.analytics.report({
      deviceId: "device-1",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    })
    queueJson({
      ok: true,
      rows: [],
      totalMetaCost: 0,
      totalLocalCost: 0,
      totalDelta: 0,
    })
    await whatsappClient.analytics.costReconciliation({
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    })
    queueJson({ ok: true, data: {} })
    await whatsappClient.webhooks.stats({ deviceId: "device-1" })

    expect(
      calls.some(({ input }) => input.includes("/api/whatsapp/catalogs/send"))
    ).toBe(true)
    expect(
      calls.some(({ input }) =>
        input.includes("/api/whatsapp/webhooks/dead-letter/stats")
      )
    ).toBe(true)
  })

  it("handles server errors and unauthorized responses", async () => {
    const whatsappClient = await client()
    queueJson(
      {
        error: "FORBIDDEN",
        message: "Requires owner",
        required: "owner",
        current: "member",
        action: "upgrade",
      },
      403
    )
    try {
      await whatsappClient.devices.list()
      throw new Error("expected forbidden request to fail")
    } catch (error) {
      expect(error).toMatchObject({
        message: "Requires owner",
        error: "FORBIDDEN",
        required: "owner",
        current: "member",
        action: "upgrade",
      })
    }

    queueJson({ error: "UNAUTHORIZED", message: "Session expired" }, 401)
    await expect(whatsappClient.devices.list()).rejects.toThrow(
      "Session expired"
    )

    responses.push(new Response("not json", { status: 500 }))
    await expect(whatsappClient.devices.list()).rejects.toThrow("HTTP 500")
  })

  it("handles media upload failures", async () => {
    const whatsappClient = await client()
    queueJson({ message: "File rejected" }, 400)
    await expect(
      whatsappClient.media.upload(new File(["hello"], "hello.txt"), "device-1")
    ).rejects.toThrow("File rejected")

    responses.push(new Response("not json", { status: 500 }))
    await expect(
      whatsappClient.media.upload(new File(["hello"], "hello.txt"), "device-1")
    ).rejects.toThrow("Upload failed with status 500")
  })
})
