import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { WhatsAppDeviceClient } from "./device-client"

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockResolvedValue: (value: Response) => void
let mockCalls: Array<{ url: string; options?: RequestInit }>

function createMockFetch() {
  const mockFn = mock()
  mockCalls = []
  mockResolvedValue = (value: Response) => {
    mockFn.mockImplementation(async (...args: any[]) => {
      mockCalls.push({ url: String(args[0]), options: args[1] })
      return value
    })
  }
  return mockFn
}

let mockFetch: ReturnType<typeof mock>

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
    mockFetch = createMockFetch()
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    mockFetch.mockRestore?.()
  })

  describe("completeUploadMedia", () => {
    it("uploads a file and returns mediaId", async () => {
      mockResolvedValue(mockJsonResponse({ id: "media-12345" }))

      const client = createClient()
      const file = new ArrayBuffer(10)
      const result = await client.completeUploadMedia(file, "test.jpg", "image/jpeg")

      expect(result.mediaId).toBe("media-12345")
      expect(mockCalls).toHaveLength(1)
      expect(mockCalls[0].options?.method).toBe("POST")
      expect(mockCalls[0].options?.body).toBeInstanceOf(FormData)
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
      mockResolvedValue(mockJsonResponse(meta))

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
      mockResolvedValue(mockArrayBufferResponse(data))

      const client = createClient()
      const result = await client.downloadMedia("media-12345")

      expect(result.byteLength).toBe(100)
      expect(mockCalls[0].options?.redirect).toBe("follow")
    })
  })

  describe("deleteMedia", () => {
    it("deletes media and returns success", async () => {
      mockResolvedValue(mockJsonResponse({ success: true }))

      const client = createClient()
      const result = await client.deleteMedia("media-12345")

      expect(result.success).toBe(true)
      expect(mockCalls[0].options?.method).toBe("DELETE")
    })
  })
})
