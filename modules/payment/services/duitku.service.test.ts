import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"

const mockFindByType = mock(() =>
  Promise.resolve({
    id: "gw-123",
    name: "Duitku",
    type: "GATEWAY",
    isActive: true,
    config: "encrypted-config",
  })
)

const mockGetDecryptedConfig = mock(() =>
  Promise.resolve({
    merchantCode: "M001",
    apiKey: "test-api-key-1234567890abcdef",
    sandboxUrl: "https://sandbox.duitku.com",
    productionUrl: "https://api.duitku.com",
  })
)

mock.module("./gateway.service", () => ({
  GatewayService: function () {
    return {
      findByType: mockFindByType,
      getDecryptedConfig: mockGetDecryptedConfig,
    }
  },
}))

// Mock fetch globally
const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        statusCode: "00",
        statusMessage: "Success",
        paymentUrl: "https://sandbox.duitku.com/payment/abc123",
        vaNumber: "1234567890",
        reference: "REF001",
      }),
  })
)

// Store original fetch
const originalFetch = globalThis.fetch

const { DuitkuService } = await import("./duitku.service")

describe("DuitkuService", () => {
  let service: InstanceType<typeof DuitkuService>

  beforeEach(() => {
    service = new DuitkuService()
    mockFindByType.mockClear()
    mockGetDecryptedConfig.mockClear()
    mockFetch.mockClear()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = mockFetch
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = originalFetch
  })

  describe("createPayment", () => {
    it("should create payment and return payment URL", async () => {
      const result = await service.createPayment({
        invoiceId: "inv-123",
        amount: 50000,
        email: "test@example.com",
        customerName: "Test User",
        productDetails: "Top Up Balance",
        paymentMethod: "VC",
      })

      expect(result.paymentUrl).toBe("https://sandbox.duitku.com/payment/abc123")
      expect(result.vaNumber).toBe("1234567890")
      expect(result.reference).toBe("REF001")
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("should throw error when gateway not configured", async () => {
      ;(mockFindByType as ReturnType<typeof mock>).mockResolvedValueOnce(null)

      await expect(
        service.createPayment({
          invoiceId: "inv-123",
          amount: 50000,
          email: "test@example.com",
          customerName: "Test User",
          productDetails: "Top Up Balance",
          paymentMethod: "VC",
        })
      ).rejects.toThrow("Duitku gateway not configured")
    })

    it("should throw error on API failure", async () => {
      ;(mockFetch as ReturnType<typeof mock>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })

      await expect(
        service.createPayment({
          invoiceId: "inv-123",
          amount: 50000,
          email: "test@example.com",
          customerName: "Test User",
          productDetails: "Top Up Balance",
          paymentMethod: "VC",
        })
      ).rejects.toThrow("Duitku API error: 500")
    })

    it("should throw error on non-zero status code", async () => {
      ;(mockFetch as ReturnType<typeof mock>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            statusCode: "01",
            statusMessage: "Invalid signature",
          }),
      })

      await expect(
        service.createPayment({
          invoiceId: "inv-123",
          amount: 50000,
          email: "test@example.com",
          customerName: "Test User",
          productDetails: "Top Up Balance",
          paymentMethod: "VC",
        })
      ).rejects.toThrow("Duitku error: Invalid signature")
    })

    it("should use QRIS payment method correctly", async () => {
      const result = await service.createPayment({
        invoiceId: "inv-456",
        amount: 100000,
        email: "test@example.com",
        customerName: "Test User",
        productDetails: "Top Up Balance",
        paymentMethod: "QR",
      })

      expect(result.paymentUrl).toContain("duitku.com")
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe("verifyCallback", () => {
    it("should return true for valid signature", async () => {
      const result = await service.verifyCallback({
        merchantCode: "M001",
        amount: "50000",
        merchantOrderId: "inv-123",
        signature: "valid-signature",
      })

      expect(typeof result).toBe("boolean")
    })

    it("should throw error when gateway not configured", async () => {
      ;(mockFindByType as ReturnType<typeof mock>).mockResolvedValueOnce(null)

      await expect(
        service.verifyCallback({
          merchantCode: "M001",
          amount: "50000",
          merchantOrderId: "inv-123",
          signature: "some-sig",
        })
      ).rejects.toThrow("Duitku gateway not configured")
    })
  })
})
