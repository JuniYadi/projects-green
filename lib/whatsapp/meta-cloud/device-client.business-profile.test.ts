import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("@/modules/whatsapp/rate-limit/rate-limit.service", () => ({
  apiCallTracker: { recordCall: mock(async () => {}) },
}))
mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: mock(async (token: string) => token),
}))

const { WhatsAppDeviceClient } = await import("@/lib/whatsapp/meta-cloud/device-client")

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
    globalThis.fetch = mock(async () =>
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

    globalThis.fetch = mock(async () =>
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
    globalThis.fetch = mock(async () =>
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
})
