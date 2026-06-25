import { describe, expect, it, mock, beforeEach } from "bun:test"

// Mock decryptWhatsAppToken first — before any imports
mock.module("../crypto", () => ({
  decryptWhatsAppToken: mock(async (token: string) => token),
}))

const { WhatsAppDeviceClient } = await import("../device-client")

describe("WhatsAppDeviceClient", () => {
  let client: InstanceType<typeof WhatsAppDeviceClient>
  let fetchSpy: ReturnType<typeof mock>

  beforeEach(() => {
    fetchSpy = mock(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.test123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    client = new WhatsAppDeviceClient({
      accessToken: "test-token",
      phoneNumberId: "phone-id-1",
      wabaId: "waba-1",
    })
  })

  describe("sendMessage", () => {
    it("sends an interactive message via generic sendMessage", async () => {
      const result = await client.sendMessage({
        to: "628123456789",
        type: "interactive",
        payload: {
          type: "button",
          body: { text: "Hello" },
          action: { buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }] },
        },
      })

      expect(result.providerMessageId).toBe("wamid.test123")
      const [, opts] = fetchSpy.mock.calls[0] as [string, { body: string }]
      const payload = JSON.parse(opts.body)
      expect(payload.type).toBe("interactive")
      expect(payload.interactive.type).toBe("button")
      expect(payload.interactive.body.text).toBe("Hello")
    })
  })
})
