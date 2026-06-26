import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { WhatsAppDeviceClient } from "./device-client"

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFetch = mock<(url: string | URL, options?: any) => Promise<Response>>()
const originalFetch = globalThis.fetch

function mockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function mockArrayBufferResponse(data: ArrayBuffer, status = 200): Response {
  return new Response(data, {
    status,
    headers: { "Content-Type": "application/octet-stream" },
  })
}

function createClient() {
  return new WhatsAppDeviceClient({
    accessToken: "test-token",
    phoneNumberId: "123456789",
    wabaId: "waba-123",
    organizationId: "org-123",
  })
}

describe("WhatsAppDeviceClient media methods", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    mockFetch.mockRestore()
  })

  describe("completeUploadMedia", () => {
    it("uploads a file and returns mediaId", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ id: "media-12345" }))

      const client = createClient()
      const file = new ArrayBuffer(10)
      const result = await client.completeUploadMedia(file, "test.jpg", "image/jpeg")

      expect(result.mediaId).toBe("media-12345")
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const call = mockFetch.mock.calls[0]
      expect(call[1]?.method).toBe("POST")
      expect(call[1]?.body).toBeInstanceOf(FormData)
    })
  })

  describe("getMedia", () => {
    it("fetches media metadata", async () => {
      const meta = {
        url: "https://example.com/media",
        mime_type: "image/jpeg",
        sha256: "abc123",
        file_size: 12345,
        id: "media-12345",
        messaging_product: "whatsapp",
      }
      mockFetch.mockResolvedValue(mockJsonResponse(meta))

      const client = createClient()
      const result = await client.getMedia("media-12345")

      expect(result.url).toBe("https://example.com/media")
      expect(result.mime_type).toBe("image/jpeg")
      expect(result.file_size).toBe(12345)
    })
  })

  describe("downloadMedia", () => {
    it("downloads binary with redirect follow", async () => {
      const data = new ArrayBuffer(100)
      mockFetch.mockResolvedValue(mockArrayBufferResponse(data))

      const client = createClient()
      const result = await client.downloadMedia("media-12345")

      expect(result.byteLength).toBe(100)
      expect(mockFetch.mock.calls[0][1]?.redirect).toBe("follow")
    })
  })

  describe("deleteMedia", () => {
    it("deletes media and returns success", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ success: true }))

      const client = createClient()
      const result = await client.deleteMedia("media-12345")

      expect(result.success).toBe(true)
      expect(mockFetch.mock.calls[0][1]?.method).toBe("DELETE")
    })
  })
})
