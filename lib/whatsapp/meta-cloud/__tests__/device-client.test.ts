import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"

// Mock decryptWhatsAppToken first — before any imports
mock.module("../crypto", () => ({
  decryptWhatsAppToken: mock(async (token: string) => token),
}))

const { WhatsAppDeviceClient } = await import("../device-client")

describe("WhatsAppDeviceClient interactive methods", () => {
  let client: WhatsAppDeviceClient
  let fetchSpy: ReturnType<typeof mock>

  beforeEach(() => {
    fetchSpy = mock(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.test123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    globalThis.fetch = fetchSpy

    client = new WhatsAppDeviceClient({
      accessToken: "test-token",
      phoneNumberId: "phone-id-1",
      wabaId: "waba-1",
    })
  })

  afterEach(() => {
    // restore is handled by bun test worker isolation
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
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      const [url, opts] = fetchSpy.mock.calls[0] as [string, { body: string }]
      const payload = JSON.parse(opts.body)
      expect(url).toContain("phone-id-1/messages")
      expect(payload.type).toBe("interactive")
      expect(payload.interactive.type).toBe("button")
      expect(payload.interactive.body.text).toBe("Do you need help?")
      expect(payload.interactive.action.buttons).toHaveLength(2)
      expect(payload.interactive.action.buttons[0]).toEqual({
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

      const [, opts] = fetchSpy.mock.calls[0] as [string, { body: string }]
      const payload = JSON.parse(opts.body)
      expect(payload.interactive.header).toEqual({
        type: "text",
        text: "Order Confirmation",
      })
      expect(payload.interactive.footer).toEqual({ text: "Reply within 24h" })
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

      const [, opts] = fetchSpy.mock.calls[0] as [string, { body: string }]
      const payload = JSON.parse(opts.body)
      expect(payload.type).toBe("interactive")
      expect(payload.interactive.type).toBe("list")
      expect(payload.interactive.action.button).toBe("View Options")
      expect(payload.interactive.action.sections).toHaveLength(1)
      expect(payload.interactive.action.sections[0].rows[0].id).toBe("svc_k8s")
    })
  })

  describe("sendCTAUrl", () => {
    it("sends a cta_url button message", async () => {
      await client.sendCTAUrl({
        to: "628123456789",
        body: { text: "Visit us:" },
        buttons: [{ display_text: "Open Website", url: "https://example.com" }],
      })

      const [, opts] = fetchSpy.mock.calls[0] as [string, { body: string }]
      const payload = JSON.parse(opts.body)
      expect(payload.type).toBe("interactive")
      expect(payload.interactive.type).toBe("button")
      expect(payload.interactive.action.buttons[0]).toEqual({
        type: "cta_url",
        cta_url: { display_text: "Open Website", url: "https://example.com" },
      })
    })
  })
})
