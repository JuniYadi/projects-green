import { afterEach, describe, expect, it, mock } from "bun:test"

mock.module("@/modules/whatsapp/rate-limit/rate-limit.service", () => ({
  apiCallTracker: { recordCall: mock(async () => {}) },
}))

const { MetaCloudError } = await import("./errors")
const { MetaCloudHttpClient } = await import("./client")

describe("MetaCloudHttpClient", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("does not retry a permanent Meta 4xx rejection", async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "Recipient is outside the customer service window",
              code: 131047,
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        )
    )
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

    const client = new MetaCloudHttpClient({
      accessToken: "test-token",
      timeoutMs: 100,
    })

    await expect(
      client.request("SEND_MESSAGE", "https://graph.example/messages", "POST", {
        message: "Hello",
      })
    ).rejects.toBeInstanceOf(MetaCloudError)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
