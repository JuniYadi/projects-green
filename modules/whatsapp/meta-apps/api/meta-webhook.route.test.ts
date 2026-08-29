import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import templateStatusFixture from "./__fixtures__/message-template-status-update.json"

type Credentials = {
  id: string
  name: string
  metaAppId: string
  webhookKey: string
  active: boolean
  appSecret: string
  verifyToken: string
}
type Device = { id: string; organizationId: string; whatsappPhoneId: string }
type HandleResult =
  | { code: number; message: string; entries: unknown[] }
  | { duplicate: true }
type CreateEvent = (
  orgId: string,
  deviceId: string,
  eventType: string,
  payload: unknown
) => Promise<string>
type RecordProcessingResult = (
  eventId: string,
  status: string,
  errorMessage?: string
) => Promise<void>
type Dispatch = (data: {
  eventId: string
  eventType: "message" | "statuses" | "template_status_update"
  deviceId: string
  organizationId: string
  payload: unknown
}) => Promise<void>
let eventCounter = 0
const mockResolveCredentials = mock<
  (key: string) => Promise<Credentials | null>
>(async (_key) => null)
const mockResolveDevice = mock<
  (metaAppId: string, phoneId: string) => Promise<Device | null>
>(async () => null)
const mockResolveDevicesByWabaId = mock<
  (metaAppId: string, wabaId: string) => Promise<Device[]>
>(async () => [])
const mockCreateWebhookEvent = mock<CreateEvent>(
  async () => `event-${++eventCounter}`
)
const mockRecordProcessingResult = mock<RecordProcessingResult>(
  async () => undefined
)
const mockDispatch = mock<Dispatch>(async () => undefined)
const mockHandleEvent = mock<
  (payload: unknown, options: { rawBody: string }) => Promise<HandleResult>
>(async () => ({ code: 200, message: "EVENT_RECEIVED", entries: [] }))
const mockLogAudit = mock(async () => undefined)

mock.module("../meta-apps.service", () => ({
  metaAppsService: {
    resolveCredentialsByWebhookKey: mockResolveCredentials,
    resolveDeviceByPhoneId: mockResolveDevice,
    resolveDevicesByWabaId: mockResolveDevicesByWabaId,
  },
}))
mock.module("@/modules/whatsapp/webhooks/webhooks.service", () => ({
  createWebhookEvent: mockCreateWebhookEvent,
  recordProcessingResult: mockRecordProcessingResult,
  handleIncomingWebhook: mock(async () => undefined),
}))
mock.module("@/modules/whatsapp/webhooks/jobs/webhook-retry.job", () => ({
  WebhookRetryJob: { dispatch: mockDispatch },
}))
mock.module("@/lib/whatsapp/handle-event", () => ({
  handleEventUseCase: mockHandleEvent,
  normalizeTemplateStatusUpdate: (value: Record<string, unknown>) => {
    const templateId = value.message_template_id
    const templateName = value.message_template_name
    const event = value.event
    if (
      (typeof templateId !== "string" && typeof templateId !== "number") ||
      typeof templateName !== "string" ||
      typeof event !== "string"
    ) {
      return null
    }
    return {
      templateId: String(templateId),
      templateName,
      event,
      ...(typeof value.message_template_category === "string"
        ? { category: value.message_template_category }
        : {}),
      ...(typeof value.message_template_language === "string"
        ? { language: value.message_template_language }
        : {}),
      ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    }
  },
}))
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogAudit,
}))

const { metaWebhookRoutes } = await import("./meta-webhook.route")

const appCredentials = {
  id: "meta-1",
  name: "Primary",
  metaAppId: "waba-1",
  webhookKey: "key-1",
  active: true,
  appSecret: "app-secret-1",
  verifyToken: "verify-token-1",
}

const devices = {
  phone1: {
    id: "device-1",
    organizationId: "org-1",
    whatsappPhoneId: "phone-1",
  },
  phone2: {
    id: "device-2",
    organizationId: "org-2",
    whatsappPhoneId: "phone-2",
  },
}

function createTestApp() {
  return new Elysia().use(metaWebhookRoutes)
}

function signedRequest(body: string, secret = appCredentials.appSecret) {
  const signature = createHmac("sha256", secret).update(body).digest("hex")
  return new Request("http://localhost/whatsapp/meta-webhook/key-1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
    body,
  })
}

beforeEach(() => {
  mockResolveCredentials.mockReset()
  mockResolveDevice.mockReset()
  mockResolveDevicesByWabaId.mockReset()
  mockCreateWebhookEvent.mockReset()
  mockRecordProcessingResult.mockReset()
  mockDispatch.mockReset()
  mockHandleEvent.mockReset()
  mockLogAudit.mockReset()
  eventCounter = 0
  mockCreateWebhookEvent.mockImplementation(
    async () => `event-${++eventCounter}`
  )
  mockRecordProcessingResult.mockResolvedValue(undefined)
  mockDispatch.mockResolvedValue(undefined)
  mockHandleEvent.mockResolvedValue({
    code: 200,
    message: "EVENT_RECEIVED",
    entries: [],
  })
  mockLogAudit.mockResolvedValue(undefined)
  mockResolveDevicesByWabaId.mockResolvedValue([])
})
describe("canonical Meta webhook ingress", () => {
  it("returns challenge only for matching active app token", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    const response = await createTestApp().handle(
      new Request(
        "http://localhost/whatsapp/meta-webhook/key-1?hub.mode=subscribe&hub.verify_token=verify-token-1&hub.challenge=challenge-123"
      )
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("challenge-123")
  })

  it("rejects wrong GET token and mode", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    const app = createTestApp()
    const wrongToken = await app.handle(
      new Request(
        "http://localhost/whatsapp/meta-webhook/key-1?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=c"
      )
    )
    const wrongMode = await app.handle(
      new Request(
        "http://localhost/whatsapp/meta-webhook/key-1?hub.mode=unsubscribe&hub.verify_token=verify-token-1&hub.challenge=c"
      )
    )

    expect(wrongToken.status).toBe(403)
    expect(wrongMode.status).toBe(403)
  })

  it("verifies raw HMAC and routes each message to its app device", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevice.mockImplementation(
      async (_metaAppId, phoneId) =>
        devices[phoneId as "phone1" | "phone2"] ?? null
    )
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "phone1" },
                messages: [{ id: "m-1", from: "1" }],
              },
            },
          ],
        },
        {
          id: "entry-2",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "phone2" },
                messages: [{ id: "m-2", from: "2" }],
              },
            },
          ],
        },
      ],
    })

    const response = await createTestApp().handle(signedRequest(body))

    expect(response.status).toBe(200)
    expect(mockResolveDevice).toHaveBeenCalledTimes(2)
    expect(mockCreateWebhookEvent).toHaveBeenCalledTimes(2)
    expect(
      mockCreateWebhookEvent.mock.calls.map(
        (call: Parameters<CreateEvent>) => call[1]
      )
    ).toEqual(["device-1", "device-2"])
    expect(
      mockDispatch.mock.calls.map(
        (call: Parameters<Dispatch>) => call[0].deviceId
      )
    ).toEqual(["device-1", "device-2"])
  })

  it("accepts a signed template status update without message items", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevicesByWabaId.mockResolvedValue([devices.phone1])
    const body = JSON.stringify(templateStatusFixture)

    const response = await createTestApp().handle(signedRequest(body))

    expect(response.status).toBe(200)
    expect(mockResolveDevicesByWabaId).toHaveBeenCalledWith(
      "meta-1",
      "test-waba-template-status"
    )
    expect(mockCreateWebhookEvent).toHaveBeenCalledWith(
      "org-1",
      "device-1",
      "template_status_update",
      expect.objectContaining({
        templateId: "1234567890",
        templateName: "thank_you_message",
        category: "MARKETING",
        language: "id",
        event: "APPROVED",
        reason: "NONE",
      }),
      templateStatusFixture
    )
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "template_status_update" })
    )
  })

  it("does not create duplicate template status events", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevicesByWabaId.mockResolvedValue([devices.phone1])
    const body = JSON.stringify(templateStatusFixture)

    const first = await createTestApp().handle(signedRequest(body))
    mockHandleEvent.mockResolvedValueOnce({ duplicate: true })
    const second = await createTestApp().handle(signedRequest(body))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(mockCreateWebhookEvent).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("rejects malformed template status updates without creating events", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "test-waba-template-status",
          changes: [
            {
              field: "message_template_status_update",
              value: { event: "APPROVED", message_template_id: 1234567890 },
            },
          ],
        },
      ],
    })

    const response = await createTestApp().handle(signedRequest(body))

    expect(response.status).toBe(422)
    expect(mockCreateWebhookEvent).not.toHaveBeenCalled()
  })

  it("rejects invalid signature and unknown app or phone", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    })
    const badSignature = await createTestApp().handle(
      new Request("http://localhost/whatsapp/meta-webhook/key-1", {
        method: "POST",
        headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) },
        body,
      })
    )
    expect(badSignature.status).toBe(401)

    mockResolveCredentials.mockResolvedValue(null)
    const unknownKey = await createTestApp().handle(signedRequest(body))
    expect(unknownKey.status).toBe(404)

    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevice.mockResolvedValue(null)
    const unknownPhoneBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "missing" },
                messages: [{ id: "m-1" }],
              },
            },
          ],
        },
      ],
    })
    const unknownPhone = await createTestApp().handle(
      signedRequest(unknownPhoneBody)
    )
    expect(unknownPhone.status).toBe(422)
    expect(mockCreateWebhookEvent).not.toHaveBeenCalled()
  })

  it("accepts duplicate body without creating another event", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevice.mockResolvedValue(devices.phone1)
    mockHandleEvent.mockResolvedValueOnce({
      code: 200,
      message: "EVENT_RECEIVED",
      entries: [],
    })
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone1" },
                statuses: [{ id: "s-1" }],
              },
            },
          ],
        },
      ],
    })
    const first = await createTestApp().handle(signedRequest(body))
    mockHandleEvent.mockResolvedValueOnce({ duplicate: true })
    const second = await createTestApp().handle(signedRequest(body))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(mockCreateWebhookEvent).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })
  it("rejects bodies larger than one MiB before parsing", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    const body =
      JSON.stringify({ object: "whatsapp_business_account", entry: [] }) +
      "x".repeat(1_048_576)

    const response = await createTestApp().handle(signedRequest(body))

    expect(response.status).toBe(413)
    expect(await response.text()).not.toContain(body)
  })

  it("marks all created events failed when queue dispatch fails", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevice.mockResolvedValue(devices.phone1)
    mockDispatch.mockRejectedValueOnce(new Error("queue unavailable"))
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone1" },
                messages: [{ id: "m-1" }, { id: "m-2" }],
              },
            },
          ],
        },
      ],
    })

    const response = await createTestApp().handle(signedRequest(body))

    expect(response.status).toBe(500)
    expect(mockCreateWebhookEvent).toHaveBeenCalledTimes(2)
    expect(mockRecordProcessingResult.mock.calls).toEqual([
      ["event-1", "FAILED", "DISPATCH_FAILED"],
      ["event-2", "FAILED", "DISPATCH_FAILED"],
    ])
  })
  it("marks already-created events with create failure when event insertion fails", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevice.mockResolvedValue(devices.phone1)
    mockCreateWebhookEvent
      .mockResolvedValueOnce("event-1")
      .mockRejectedValueOnce(new Error("database unavailable"))
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone1" },
                messages: [{ id: "m-1" }, { id: "m-2" }],
              },
            },
          ],
        },
      ],
    })

    const response = await createTestApp().handle(signedRequest(body))

    expect(response.status).toBe(500)
    expect(mockRecordProcessingResult.mock.calls).toEqual([
      ["event-1", "FAILED", "CREATE_FAILED"],
    ])
    expect(mockDispatch).not.toHaveBeenCalled()
  })
  it("does not expose credential failures", async () => {
    mockResolveCredentials.mockRejectedValue(
      new Error("app-secret-1 verify-token-1")
    )

    const response = await createTestApp().handle(
      new Request("http://localhost/whatsapp/meta-webhook/key-1")
    )

    const text = await response.text()
    expect(response.status).toBe(500)
    expect(text).not.toContain("app-secret-1")
    expect(text).not.toContain("verify-token-1")
  })
  it("logs WEBHOOK_REJECTED audit event when signature is missing", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)

    const response = await createTestApp().handle(
      new Request("http://localhost/whatsapp/meta-webhook/key-1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ object: "whatsapp_business_account" }),
      })
    )

    expect(response.status).toBe(401)
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WEBHOOK_REJECTED",
        status: "FAILED",
        organizationId: "system",
        errorMessage: "MISSING_SIGNATURE",
        details: expect.objectContaining({
          webhookKey: "key-1",
          metaAppId: "waba-1",
        }),
      })
    )
  })
  it("logs WEBHOOK_REJECTED audit event when device is unmapped", async () => {
    mockResolveCredentials.mockResolvedValue(appCredentials)
    mockResolveDevice.mockResolvedValue(null)
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "unmapped-phone-999" },
                messages: [{ id: "m-1" }],
              },
            },
          ],
        },
      ],
    })

    const response = await createTestApp().handle(signedRequest(body))

    expect(response.status).toBe(422)
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WEBHOOK_REJECTED",
        status: "FAILED",
        organizationId: "system",
        errorMessage: "UNKNOWN_DEVICE",
        details: expect.objectContaining({
          webhookKey: "key-1",
          metaAppId: "waba-1",
          phoneIds: ["unmapped-phone-999"],
          unmappedPhoneIds: ["unmapped-phone-999"],
        }),
      })
    )
  })
})
