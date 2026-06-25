import { describe, expect, it, mock, beforeEach } from "bun:test"

// Mock decryptWhatsAppToken first — before any imports
mock.module("../crypto", () => ({
  decryptWhatsAppToken: mock(async (token: string) => token),
}))

const mockRequest = mock(async () => ({
  messages: [{ id: "wamid.test123" }],
}))

mock.module("../client", () => ({
  MetaCloudHttpClient: mock(() => ({
    request: mockRequest,
  })),
}))

const { WhatsAppDeviceClient } = await import("../device-client")

describe("WhatsAppDeviceClient interactive methods", () => {
  let client: InstanceType<typeof WhatsAppDeviceClient>

  beforeEach(() => {
    mockRequest.mockClear()
    mockRequest.mockResolvedValue({
      messages: [{ id: "wamid.test123" }],
    })
    client = new WhatsAppDeviceClient({
      accessToken: "test-token",
      phoneNumberId: "phone-id-1",
      wabaId: "waba-1",
    })
  })

  describe("sendReplyButtons", () => {
    it("sends a button interactive message with correct payload", async () => {
      const result = await client.sendReplyButtons({
        to: "628123456789",
        body: { text: "Do you need help?" },
        buttons: [
          { id: "btn_help", title: "Need Help" },
          { id: "btn_no", title: "No Thanks" },
        ],
      })

      expect(result.providerMessageId).toBe("wamid.test123")
      expect(mockRequest).toHaveBeenCalledTimes(1)

      const callArgs = mockRequest.mock.calls[0] as unknown[]
      const payload = callArgs[3] as Record<string, unknown>
      const interactive = payload.interactive as Record<string, unknown>
      const action = interactive.action as Record<string, unknown>
      const buttons = action.buttons as Array<Record<string, unknown>>
      expect(payload.type).toBe("interactive")
      expect(interactive.type).toBe("button")
      expect((interactive.body as Record<string, unknown>).text).toBe("Do you need help?")
      expect(buttons).toHaveLength(2)
      expect(buttons[0]).toEqual({
        type: "reply",
        reply: { id: "btn_help", title: "Need Help" },
      })
    })

    it("includes header and footer when provided", async () => {
      await client.sendReplyButtons({
        to: "628123456789",
        header: { type: "text", text: "Order Confirmation" },
        body: { text: "Your order is ready." },
        footer: { text: "Reply within 24h" },
        buttons: [{ id: "btn_ok", title: "OK" }],
      })

      const callArgs = mockRequest.mock.calls[0] as unknown[]
      const payload = callArgs[3] as Record<string, unknown>
      const interactive = payload.interactive as Record<string, unknown>
      expect(interactive.header).toEqual({
        type: "text",
        text: "Order Confirmation",
      })
      expect(interactive.footer).toEqual({ text: "Reply within 24h" })
    })
  })

  describe("sendList", () => {
    it("sends a list interactive message", async () => {
      await client.sendList({
        to: "628123456789",
        body: { text: "Select a service:" },
        button: "View Options",
        sections: [
          {
            title: "DevOps",
            rows: [
              { id: "svc_k8s", title: "Kubernetes", description: "K8s setup" },
            ],
          },
        ],
      })

      const callArgs = mockRequest.mock.calls[0] as unknown[]
      const payload = callArgs[3] as Record<string, unknown>
      const interactive = payload.interactive as Record<string, unknown>
      const action = interactive.action as Record<string, unknown>
      const sections = action.sections as Array<Record<string, unknown>>
      expect(payload.type).toBe("interactive")
      expect(interactive.type).toBe("list")
      expect(action.button).toBe("View Options")
      expect(sections).toHaveLength(1)
      const rows = sections[0].rows as Array<Record<string, unknown>>
      expect(rows[0].id).toBe("svc_k8s")
    })
  })

  describe("sendCTAUrl", () => {
    it("sends a cta_url button message", async () => {
      await client.sendCTAUrl({
        to: "628123456789",
        body: { text: "Visit us:" },
        buttons: [{ display_text: "Open Website", url: "https://example.com" }],
      })

      const callArgs = mockRequest.mock.calls[0] as unknown[]
      const payload = callArgs[3] as Record<string, unknown>
      const interactive = payload.interactive as Record<string, unknown>
      const action = interactive.action as Record<string, unknown>
      const buttons = action.buttons as Array<Record<string, unknown>>
      expect(payload.type).toBe("interactive")
      expect(interactive.type).toBe("button")
      expect(buttons[0]).toEqual({
        type: "cta_url",
        cta_url: { display_text: "Open Website", url: "https://example.com" },
      })
    })
  })
})
