import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { WhatsAppDeviceClient } from "./device-client"

const mockRequest = mock(async (op: string, endpoint: string, method: string, body?: unknown) => {
  return { messages: [{ id: "wamid.mock" }] }
})

mock.module("./client", () => ({
  MetaCloudHttpClient: class {
    request = mockRequest
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

describe("WhatsAppDeviceClient catalog methods", () => {
  beforeEach(() => { mockRequest.mockClear() })

  describe("sendSingleProduct", () => {
    it("sends a single product message with minimal fields", async () => {
      const client = createClient()
      const result = await client.sendSingleProduct("628123456789", "cat-1", "SKU-001")

      expect(result.providerMessageId).toBe("wamid.mock")
      expect(mockRequest).toHaveBeenCalled()

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body).toEqual({
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
      await client.sendSingleProduct("628123456789", "cat-1", "SKU-001", { text: "Check this out!" })

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body.interactive.body).toEqual({ text: "Check this out!" })
    })

    it("omits header field for product type", async () => {
      const client = createClient()
      await client.sendSingleProduct("628123456789", "cat-1", "SKU-001")

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body.interactive.header).toBeUndefined()
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
        { text: "Tap to view" },
      )

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body).toEqual({
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
            sections: [{
              title: "DevOps",
              product_items: [{ product_retailer_id: "SKU-001" }, { product_retailer_id: "SKU-002" }],
            }],
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
        { text: "Body" },
      )

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body.interactive.footer).toBeUndefined()
    })
  })

  describe("sendCatalogMessage", () => {
    it("sends a catalog message", async () => {
      const client = createClient()
      await client.sendCatalogMessage("628123456789", "cat-1")

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body.interactive.type).toBe("catalog_message")
      expect(body.interactive.action.catalog_id).toBe("cat-1")
      expect(body.interactive.action.name).toBe("catalog_message")
    })

    it("includes thumbnail when provided", async () => {
      const client = createClient()
      await client.sendCatalogMessage("628123456789", "cat-1", "SKU-001")

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body.interactive.action.parameters.thumbnail_product_retailer_id).toBe("SKU-001")
    })

    it("omits thumbnail parameters when not provided", async () => {
      const client = createClient()
      await client.sendCatalogMessage("628123456789", "cat-1")

      const [, , , body] = mockRequest.mock.calls[0] as any[]
      expect(body.interactive.action.parameters).toBeUndefined()
    })
  })
})
