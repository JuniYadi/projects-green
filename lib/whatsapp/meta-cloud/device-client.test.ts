import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { WhatsAppDeviceClient } from "./device-client"

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRequest = mock(
  async (op: string, endpoint: string, method: string, body?: unknown) => {
    return { messages: [{ id: "wamid.mock" }] }
  }
)

mock.module("./client", () => ({
  MetaCloudHttpClient: class {
    request = mockRequest
    getAccessToken = () => "mock-token"
  },
}))

mock.module("../crypto", () => ({
  decryptWhatsAppToken: async (token: string) => token,
}))

function createClient() {
  return new WhatsAppDeviceClient({
    accessToken: "mock-token",
    phoneNumberId: "phone-1",
    wabaId: "waba-1",
  })
}

// ─── Catalog tests ───────────────────────────────────────────────────────────

describe("WhatsAppDeviceClient catalog methods", () => {
  beforeEach(() => {
    mockRequest.mockClear()
  })

  describe("sendSingleProduct", () => {
    it("sends a single product message with minimal fields", async () => {
      const client = createClient()
      const result = await client.sendSingleProduct(
        "628123456789",
        "cat-1",
        "SKU-001"
      )

      expect(result.providerMessageId).toBe("wamid.mock")
      expect(mockRequest).toHaveBeenCalled()

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(payload).toEqual({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "628123456789",
        type: "interactive",
        interactive: {
          type: "product",
          action: { catalog_id: "cat-1", product_retailer_id: "SKU-001" },
        },
      })
    })

    it("includes optional body text when provided", async () => {
      const client = createClient()
      await client.sendSingleProduct("628123456789", "cat-1", "SKU-001", {
        text: "Check this out!",
      })

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(payload.interactive.body).toEqual({ text: "Check this out!" })
    })

    it("omits header field for product type", async () => {
      const client = createClient()
      await client.sendSingleProduct("628123456789", "cat-1", "SKU-001")

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(payload.interactive.header).toBeUndefined()
    })
  })

  describe("sendMultiProductList", () => {
    it("sends a product list with sections", async () => {
      const client = createClient()
      await client.sendMultiProductList(
        "628123456789",
        "cat-1",
        [{ title: "DevOps", productItems: ["SKU-001", "SKU-002"] }],
        { text: "Our Products" },
        { text: "Browse:" },
        { text: "Tap to view" }
      )

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(payload).toEqual({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "628123456789",
        type: "interactive",
        interactive: {
          type: "product_list",
          header: { type: "text", text: "Our Products" },
          body: { text: "Browse:" },
          footer: { text: "Tap to view" },
          action: {
            catalog_id: "cat-1",
            sections: [
              {
                title: "DevOps",
                product_items: [
                  { product_retailer_id: "SKU-001" },
                  { product_retailer_id: "SKU-002" },
                ],
              },
            ],
          },
        },
      })
    })

    it("omits footer when not provided", async () => {
      const client = createClient()
      await client.sendMultiProductList(
        "628123456789",
        "cat-1",
        [{ title: "DevOps", productItems: ["SKU-001"] }],
        { text: "Header" },
        { text: "Body" }
      )

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(payload.interactive.footer).toBeUndefined()
    })
  })

  describe("sendCatalogMessage", () => {
    it("sends a catalog message", async () => {
      const client = createClient()
      await client.sendCatalogMessage("628123456789", "cat-1")

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(payload.interactive.type).toBe("catalog_message")
      expect(payload.interactive.action.catalog_id).toBe("cat-1")
      expect(payload.interactive.action.name).toBe("catalog_message")
    })

    it("includes thumbnail when provided", async () => {
      const client = createClient()
      await client.sendCatalogMessage("628123456789", "cat-1", "SKU-001")

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(
        payload.interactive.action.parameters
          .thumbnail_product_retailer_id
      ).toBe("SKU-001")
    })

    it("omits thumbnail parameters when not provided", async () => {
      const client = createClient()
      await client.sendCatalogMessage("628123456789", "cat-1")

      const [, , , payload] = mockRequest.mock.calls[0] as any[]
      expect(payload.interactive.action.parameters).toBeUndefined()
    })
  })
})

// ─── Media tests ─────────────────────────────────────────────────────────────

describe("WhatsAppDeviceClient media methods", () => {
  beforeEach(() => {
    mockRequest.mockClear()
  })

  describe("completeUploadMedia", () => {
    it("uploads a file and returns mediaId", async () => {
      mockRequest.mockImplementationOnce(async () => ({ id: "media-12345" }))

      const client = createClient()
      const file = new ArrayBuffer(10)
      const result = await client.completeUploadMedia(
        file,
        "test.jpg",
        "image/jpeg"
      )

      expect(result.mediaId).toBe("media-12345")
      expect(mockRequest).toHaveBeenCalledWith(
        "UPLOAD_MEDIA",
        expect.any(String),
        "POST",
        expect.any(FormData)
      )
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
      mockRequest.mockImplementationOnce(async () => meta)

      const client = createClient()
      const result = await client.getMedia("media-12345")

      expect(result.url).toBe("https://example.com/media")
      expect(result.mime_type).toBe("image/jpeg")
      expect(result.file_size).toBe(12345)
    })
  })

  describe("deleteMedia", () => {
    it("deletes media and returns success", async () => {
      mockRequest.mockImplementationOnce(async () => ({ success: true }))

      const client = createClient()
      const result = await client.deleteMedia("media-12345")

      expect(result.success).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        "DELETE_MEDIA",
        expect.any(String),
        "DELETE"
      )
    })
  })

  describe("downloadMedia", () => {
    // ponytail: downloadMedia uses raw fetch (for arrayBuffer), not httpClient.request.
    // We mock globalThis.fetch for this one method.
    it("downloads binary with redirect follow", async () => {
      const data = new ArrayBuffer(100)
      const mockFetch = mock(async () => {
        return new Response(data, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        })
      })
      globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch

      const client = createClient()
      const result = await client.downloadMedia("media-12345")

      expect(result.byteLength).toBe(100)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ redirect: "follow" })
      )

      // ponytail: restore original fetch
      globalThis.fetch = fetch
    })
  })
})
