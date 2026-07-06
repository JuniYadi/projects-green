import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

describe("whatsappClient", () => {
  const capturedUrls: string[] = []

  beforeEach(() => {
    capturedUrls.length = 0
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300"

    // Set browser origin to a realistic tunnel origin
    const happyDOM = (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM
    happyDOM.setURL(
      "https://pgreen.tunnel.juniyadi.id/id/console/whatsapp/dashboard"
    )

    globalThis.fetch = mock((input: string | URL | Request) => {
      capturedUrls.push(input.toString())
      return jsonResponse({ ok: true, devices: [] })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL
  })

  it("uses browser origin for API calls, not the env var origin", async () => {
    const { whatsappClient } = await import("@/lib/api/whatsapp-client")

    await whatsappClient.devices.list()

    expect(capturedUrls).toHaveLength(1)
    expect(capturedUrls[0]).toBe(
      "https://pgreen.tunnel.juniyadi.id/api/whatsapp/devices"
    )
  })
})
