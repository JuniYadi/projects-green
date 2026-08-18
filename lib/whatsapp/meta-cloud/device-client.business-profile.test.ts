import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("@/modules/whatsapp/rate-limit/rate-limit.service", () => ({
  apiCallTracker: { recordCall: mock(async () => {}) },
}))
mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: mock(async (token: string) => token),
}))

const { WhatsAppDeviceClient } =
  await import("@/lib/whatsapp/meta-cloud/device-client")

const TEST_ACCESS_TOKEN = "test-token"
const PHONE_ID = "phone-1"
const WABA_ID = "waba-1"

function createClient() {
  return new WhatsAppDeviceClient({
    accessToken: TEST_ACCESS_TOKEN,
    phoneNumberId: PHONE_ID,
    wabaId: WABA_ID,
  })
}

describe("WhatsAppDeviceClient business profile", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("getBusinessProfile returns null when data array is empty", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    ) as unknown as typeof globalThis.fetch

    const client = createClient()
    const result = await client.getBusinessProfile()
    expect(result).toBeNull()
  })

  it("getBusinessProfile returns unwrapped profile fields", async () => {
    const profileData = {
      about: "We provide DevOps services",
      email: "support@example.com",
      websites: ["https://example.com"],
      vertical: "PROF_SERVICES",
    }

    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({ data: [{ business_profile: profileData }] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
    ) as unknown as typeof globalThis.fetch

    const client = createClient()
    const result = await client.getBusinessProfile()
    expect(result).toEqual(profileData)
  })

  it("updateBusinessProfile sends POST with correct payload", async () => {
    let capturedBody: string | null = null
    globalThis.fetch = mock(async (_url: string, opts: RequestInit) => {
      capturedBody = opts.body as string
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof globalThis.fetch

    const client = createClient()
    const result = await client.updateBusinessProfile({
      messaging_product: "whatsapp",
      about: "New about text",
      vertical: "AUTO",
    })

    expect(result).toEqual({ success: true })
    expect(capturedBody).toBeTruthy()
    const parsed = JSON.parse(capturedBody!)
    expect(parsed.messaging_product).toBe("whatsapp")
    expect(parsed.about).toBe("New about text")
    expect(parsed.vertical).toBe("AUTO")
  })

  it("updateBusinessProfile returns success false when Meta says so", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ success: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    ) as unknown as typeof globalThis.fetch

    const client = createClient()
    const result = await client.updateBusinessProfile({
      messaging_product: "whatsapp",
      about: "test",
    })

    expect(result.success).toBe(false)
  })

  it("uploadProfilePicture throws if metaAppId is missing", async () => {
    const client = createClient()
    await expect(
      client.uploadProfilePicture({
        data: new ArrayBuffer(8),
        mimeType: "image/png",
        fileName: "test.png",
      })
    ).rejects.toThrow("Meta app ID is required")
  })

  it("uploadProfilePicture creates session and uploads file part", async () => {
    const client = new WhatsAppDeviceClient({
      accessToken: TEST_ACCESS_TOKEN,
      phoneNumberId: PHONE_ID,
      wabaId: WABA_ID,
      metaAppId: "app-123",
    })

    let requestCount = 0
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      requestCount++
      const urlStr = url.toString()
      if (urlStr.includes("/app-123/uploads")) {
        return new Response(JSON.stringify({ id: "session-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (
        urlStr.includes("upload:session-123") ||
        urlStr.includes("session-123")
      ) {
        return new Response(JSON.stringify({ h: "handle-456" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response("Not found", { status: 404 })
    }) as unknown as typeof globalThis.fetch

    const res = await client.uploadProfilePicture({
      data: new ArrayBuffer(16),
      mimeType: "image/png",
      fileName: "avatar.png",
    })

    expect(res).toEqual({ handle: "handle-456" })
    expect(requestCount).toBe(2)
  })

  it("uploadProfilePicture throws if no handle returned", async () => {
    const client = new WhatsAppDeviceClient({
      accessToken: TEST_ACCESS_TOKEN,
      phoneNumberId: PHONE_ID,
      wabaId: WABA_ID,
      metaAppId: "app-123",
    })

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/app-123/uploads")) {
        return new Response(JSON.stringify({ id: "session-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof globalThis.fetch

    await expect(
      client.uploadProfilePicture({
        data: new ArrayBuffer(16),
        mimeType: "image/png",
        fileName: "avatar.png",
      })
    ).rejects.toThrow("no profile picture handle")
  })
})
