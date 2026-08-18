import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { createWhatsAppClient } from "./whatsapp-client"

const originalFetch = globalThis.fetch
const fetchMock = mock(async () => new Response(JSON.stringify({})))

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })

const requestCall = () => {
  const call = fetchMock.mock.calls[0]
  if (!call) throw new Error("Expected fetch to be called")
  return call as unknown as [string, RequestInit | undefined]
}

describe("createWhatsAppClient", () => {
  beforeEach(() => {
    fetchMock.mockClear()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("creates a client with the WhatsApp API methods", () => {
    const client = createWhatsAppClient()

    expect(client.listDevices).toEqual(expect.any(Function))
    expect(client.listConversations).toEqual(expect.any(Function))
    expect(client.listMessages).toEqual(expect.any(Function))
    expect(client.sendMessage).toEqual(expect.any(Function))
  })

  it("sends the expected message payload and parses the response", async () => {
    const response = {
      jobId: "job-1",
      messageId: "message-1",
      waMessageId: "wamid.1",
      status: "sent" as const,
    }
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, ...response }))

    const result = await createWhatsAppClient().sendMessage({
      phoneNumber: "+14155550100",
      message: "Hello from a test",
      deviceId: "device-1",
    })

    expect(result).toEqual({ ok: true, ...response })
    const [url, init] = requestCall()
    expect(url).toBe("/api/whatsapp/messages/send")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toEqual({ "content-type": "application/json" })
    expect(JSON.parse(init?.body as string)).toEqual({
      phoneNumber: "+14155550100",
      message: "Hello from a test",
      deviceId: "device-1",
    })
  })

  it("lists conversations with an encoded contact phone filter", async () => {
    const conversations = [
      {
        id: "conversation-1",
        organizationId: "organization-1",
        contactPhone: "+14155550100",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, conversations }))

    const result = await createWhatsAppClient().listConversations({
      contactPhone: "+14155550100",
    })

    expect(result).toEqual(conversations)
    const [url, init] = requestCall()
    expect(url).toBe("/api/whatsapp/conversations?contactPhone=%2B14155550100")
    expect(init?.method).toBeUndefined()
    expect(init?.signal).toEqual(expect.any(AbortSignal))
  })

  it("maps device responses and sends update requests as JSON", async () => {
    const device = {
      id: "device-1",
      organizationId: "organization-1",
      phoneNumber: "+14155550100",
      balance: 0,
      quotaBase: 100,
      quotaBaseOut: 100,
      dailyLimitMessage: 1000,
      status: "ACTIVE" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, device }))

    const result = await createWhatsAppClient().updateDevice("device-1", {
      phoneNumber: "+14155550101",
    })

    expect(result).toEqual(device)
    const [url, init] = requestCall()
    expect(url).toBe("/api/whatsapp/devices/device-1")
    expect(init?.method).toBe("PATCH")
    expect(JSON.parse(init?.body as string)).toEqual({
      phoneNumber: "+14155550101",
    })
  })

  it("throws the API message when a request fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: "Device unavailable" }, 503)
    )

    await expect(createWhatsAppClient().listDevices()).rejects.toThrow(
      "Device unavailable"
    )
  })
  it("calls the remaining resource methods with their API shapes", async () => {
    const client = createWhatsAppClient()
    const respond = (payload: Record<string, unknown> = {}) => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, ...payload }))
    }

    respond({ device: {} })
    await client.getDevice("device-1")
    respond({ device: {} })
    await client.verifyDevice("device-1")
    respond({ device: {} })
    await client.reconnectDevice("device-1")

    respond({ templates: [] })
    await client.listTemplates()
    respond({ template: {} })
    await client.getTemplate("template-1")
    respond({ template: {} })
    await client.createTemplate({
      slug: "welcome",
      name: "Welcome",
      languages: [{ lang: "en_US" }],
    })
    respond({ template: {} })
    await client.updateTemplate("template-1", { name: "Updated" })
    respond()
    await client.deleteTemplate("template-1")
    respond({ message: "Synced" })
    await client.syncTemplate("template-1")

    respond({ contacts: [] })
    await client.listContacts({
      contactGroupId: "group-1",
      status: "ACTIVE",
      phoneNumber: "+14155550100",
    })
    respond({ contact: {} })
    await client.getContact("contact-1")
    respond({ contact: {} })
    await client.createContact({
      phoneNumber: "+14155550100",
      name: "Ada",
      email: "ada@example.test",
    })
    respond({ contact: {} })
    await client.updateContact("contact-1", { name: "Updated" })
    respond()
    await client.deleteContact("contact-1")

    respond({ conversation: {} })
    await client.getConversation("conversation-1")
    respond({ conversation: {} })
    await client.createConversation({ contactPhone: "+14155550100" })
    respond({ messages: [] })
    await client.listMessages({
      conversationId: "conversation-1",
      direction: "OUTBOX",
      messageType: "text",
    })
    respond({ message: {} })
    await client.getMessage("message-1")

    respond({ groups: [] })
    await client.listGroups()
    respond({ group: {} })
    await client.getGroup("group-1")
    respond({ group: {} })
    await client.createGroup({ name: "VIP", description: "Important" })
    respond({ group: {} })
    await client.updateGroup("group-1", { status: "INACTIVE" })
    respond()
    await client.deleteGroup("group-1")

    respond({ broadcasts: [] })
    await client.listBroadcasts()
    respond({ broadcast: {} })
    await client.getBroadcast("broadcast-1")
    respond({ broadcast: {} })
    await client.createBroadcast({
      templateName: "welcome",
      templateLanguage: "en_US",
      recipients: [{ phoneNumber: "+14155550100" }],
    })
    respond({ broadcast: {} })
    await client.updateBroadcast("broadcast-1", { templateName: "updated" })
    respond()
    await client.deleteBroadcast("broadcast-1")
    respond({ message: "Queued" })
    await client.sendBroadcast("broadcast-1")
    respond({ capacity: {}, recommendation: {} })
    await client.previewBroadcastSchedule({
      whatsappDeviceId: "device-1",
      recipients: [{ phoneNumber: "+14155550100" }],
    })

    respond({ webhooks: [] })
    await client.listWebhooks()
    respond({ webhook: {} })
    await client.getWebhook("webhook-1")
    respond({ webhook: {} })
    await client.createWebhook({ name: "Events", url: "https://example.test" })
    respond({ webhook: {} })
    await client.updateWebhook("webhook-1", { name: "Updated" })
    respond()
    await client.deleteWebhook("webhook-1")

    respond({ users: [] })
    await client.listWhatsAppUsers()
    respond({ user: {} })
    await client.getWhatsAppUser("user-1")
    respond({ user: {} })
    await client.createWhatsAppUser({ email: "ada@example.test" })
    respond({ user: {} })
    await client.updateWhatsAppUser("user-1", { role: "ADMIN" })
    respond()
    await client.deleteWhatsAppUser("user-1")

    respond({ data: [] })
    await client.listCatalogs()
    respond({ data: {} })
    await client.getCatalog("catalog-1")
    respond({ data: {} })
    await client.createCatalog({ name: "Products", metaCatalogId: "meta-1" })
    respond({ data: {} })
    await client.updateCatalog("catalog-1", { name: "Updated" })
    respond()
    await client.deleteCatalog("catalog-1")
    respond({ data: { synced: 1 } })
    await client.syncCatalog("catalog-1")
    respond({ data: [] })
    await client.listCatalogProducts("catalog-1")
    respond({ data: { providerMessageId: "provider-1" } })
    await client.sendCatalogMessage({
      to: "+14155550100",
      catalogId: "catalog-1",
      type: "product",
      productRetailerId: "product-1",
    })

    expect(fetchMock).toHaveBeenCalledTimes(48)
  })

  it("handles invalid and incomplete API error payloads", async () => {
    const client = createWhatsAppClient()

    fetchMock.mockResolvedValueOnce(new Response("not-json"))
    await expect(client.listDevices()).rejects.toThrow()

    fetchMock.mockResolvedValueOnce(
      new Response("unavailable", { status: 503 })
    )
    await expect(client.listDevices()).rejects.toThrow(
      "Unable to load WhatsApp devices."
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false }, 503))
    await expect(client.listDevices()).rejects.toThrow(
      "Unable to load WhatsApp devices."
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await expect(client.getBroadcast("broadcast-1")).rejects.toThrow(
      "Unable to load WhatsApp broadcast."
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await expect(
      client.createBroadcast({
        templateName: "welcome",
        templateLanguage: "en_US",
        recipients: [{ phoneNumber: "+14155550100" }],
      })
    ).rejects.toThrow("Unable to create WhatsApp broadcast.")
  })
})
