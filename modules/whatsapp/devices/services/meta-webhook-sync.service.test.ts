import { beforeEach, describe, expect, it, mock } from "bun:test"
import { syncMetaWebhookSubscription } from "./meta-webhook-sync.service"

const mockDeviceFindUnique = mock()
const mockDeviceUpdate = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findUnique: mockDeviceFindUnique,
      update: mockDeviceUpdate,
    },
  },
}))

mock.module(
  "@/modules/whatsapp/meta-apps/services/meta-credentials-resolver.service",
  () => ({
    resolveDecryptedDeviceMetaToken: mock(
      async (dev: {
        whatsappVersion?: string | null
        tokenEncrypted?: string | null
        whatsappMetaApp?: { defaultVersion?: string | null } | null
      }) => ({
        token: "mock-decrypted-token",
        version:
          dev.whatsappVersion || dev.whatsappMetaApp?.defaultVersion || "v24.0",
        tokenSource: dev.tokenEncrypted
          ? "DEVICE_OVERRIDE"
          : "INHERITED_META_APP",
      })
    ),
  })
)

const defaultDevice = {
  id: "device-1",
  whatsappBusinessAccountId: "1029875886609003",
  whatsappVersion: "v24.0",
  tokenEncrypted: "enc-token",
  features: null,
  whatsappMetaApp: {
    metaAppId: "1423851616333892",
    name: "PFNAppID",
    systemTokenEncrypted: null,
    defaultVersion: "v24.0",
  },
}

describe("syncMetaWebhookSubscription", () => {
  beforeEach(() => {
    mockDeviceFindUnique.mockReset()
    mockDeviceUpdate.mockReset()
    mockDeviceFindUnique.mockResolvedValue(defaultDevice)
    mockDeviceUpdate.mockResolvedValue({})
  })

  it("marks SUBSCRIBED when target metaAppId is already in subscribed_apps", async () => {
    const mockFetch = mock(async (url: string) => {
      return new Response(
        JSON.stringify({
          data: [
            {
              whatsapp_business_api_data: {
                id: "1423851616333892",
                name: "PFNAppID",
              },
            },
          ],
        }),
        { status: 200 }
      )
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const result = await syncMetaWebhookSubscription("device-1")

    expect(result.active).toBe(true)
    expect(result.status).toBe("SUBSCRIBED")
    expect(result.metaAppId).toBe("1423851616333892")
    expect(mockDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "device-1" },
        data: {
          features: expect.objectContaining({
            metaWebhook: expect.objectContaining({
              status: "SUBSCRIBED",
              active: true,
            }),
          }),
        },
      })
    )
  })

  it("attempts auto-subscription when target metaAppId is absent and marks SUBSCRIBED if auto-subscribe succeeds", async () => {
    let callCount = 0
    const mockFetch = mock(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") {
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }
      callCount++
      if (callCount === 1) {
        // First GET: only legacy app
        return new Response(
          JSON.stringify({
            data: [
              {
                whatsapp_business_api_data: {
                  id: "1333081460547759",
                  name: "Krm Pesan",
                },
              },
            ],
          }),
          { status: 200 }
        )
      }
      // Second GET (after POST): target app added
      return new Response(
        JSON.stringify({
          data: [
            {
              whatsapp_business_api_data: {
                id: "1423851616333892",
                name: "PFNAppID",
              },
            },
            {
              whatsapp_business_api_data: {
                id: "1333081460547759",
                name: "Krm Pesan",
              },
            },
          ],
        }),
        { status: 200 }
      )
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const result = await syncMetaWebhookSubscription("device-1")

    expect(result.status).toBe("SUBSCRIBED")
    expect(result.active).toBe(true)
    expect(callCount).toBe(2)
  })

  it("marks TOKEN_APP_MISMATCH when auto-subscription fails to add target metaAppId", async () => {
    const mockFetch = mock(async () => {
      // Returns only legacy app both before and after POST
      return new Response(
        JSON.stringify({
          data: [
            {
              whatsapp_business_api_data: {
                id: "1333081460547759",
                name: "Krm Pesan",
              },
            },
          ],
        }),
        { status: 200 }
      )
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const result = await syncMetaWebhookSubscription("device-1")

    expect(result.status).toBe("TOKEN_APP_MISMATCH")
    expect(result.active).toBe(false)
    expect(result.warning).toContain(
      "Access token belongs to an alternate Meta App"
    )
  })

  it("returns NO_WABA_CONFIGURED when device has no WABA ID", async () => {
    mockDeviceFindUnique.mockResolvedValueOnce({
      ...defaultDevice,
      whatsappBusinessAccountId: null,
    })

    const result = await syncMetaWebhookSubscription("device-1")
    expect(result.status).toBe("NO_WABA_CONFIGURED")
    expect(result.active).toBe(false)
  })

  it("returns NO_META_APP_LINKED when device has no linked Meta App", async () => {
    mockDeviceFindUnique.mockResolvedValueOnce({
      ...defaultDevice,
      whatsappMetaApp: null,
    })

    const result = await syncMetaWebhookSubscription("device-1")
    expect(result.status).toBe("NO_META_APP_LINKED")
    expect(result.active).toBe(false)
  })
})
