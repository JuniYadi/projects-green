import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { duitkuProvider } from "./duitku.provider"
import crypto from "crypto"

describe("DuitkuPaymentProvider", () => {
  const originalEnv = process.env.DUITKU_SANDBOX
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    delete process.env.DUITKU_SANDBOX
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DUITKU_SANDBOX = originalEnv
    } else {
      delete process.env.DUITKU_SANDBOX
    }
    globalThis.fetch = originalFetch
  })

  describe("metadata", () => {
    it("has expected provider properties", () => {
      expect(duitkuProvider.id).toBe("duitku")
      expect(duitkuProvider.name).toBe("Duitku")
      expect(duitkuProvider.supportedCurrencies).toEqual(["IDR"])
      expect(duitkuProvider.paymentMethods).toEqual(["VC", "QR"])
      expect(duitkuProvider.configFields).toBeDefined()
      expect(duitkuProvider.configFields.length).toBe(4)
    })
  })

  describe("createPayment", () => {
    const validConfig = {
      merchantCode: "M12345",
      apiKey: "secret-api-key",
      sandboxUrl: "https://sandbox.duitku.com",
      productionUrl: "https://api.duitku.com",
    }

    const paymentRequest = {
      invoiceId: "INV-2026-001",
      amount: 150000,
      currency: "IDR",
      productDetails: "Pro Plan Subscription",
      email: "user@example.com",
      paymentMethod: "VC",
      customerName: "Jane Doe",
      returnUrl: "https://app.example.com/billing/return",
      callbackUrl: "https://app.example.com/api/webhooks/duitku",
    }

    it("throws if merchantCode or apiKey is missing", async () => {
      await expect(
        duitkuProvider.createPayment(paymentRequest, { apiKey: "key" })
      ).rejects.toThrow(
        "Duitku gateway not configured: missing merchantCode or apiKey"
      )

      await expect(
        duitkuProvider.createPayment(paymentRequest, { merchantCode: "M123" })
      ).rejects.toThrow(
        "Duitku gateway not configured: missing merchantCode or apiKey"
      )
    })

    it("creates payment successfully in production mode", async () => {
      let interceptedUrl = ""
      let interceptedBody: unknown = null

      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        interceptedUrl = url
        interceptedBody = JSON.parse(init?.body as string)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            statusCode: "00",
            statusMessage: "SUCCESS",
            paymentUrl: "https://app.duitku.com/pay/12345",
            vaNumber: "888800012345",
            reference: "DUI-REF-999",
          }),
        } as unknown as Response
      }) as typeof fetch

      const result = await duitkuProvider.createPayment(
        paymentRequest,
        validConfig
      )

      expect(interceptedUrl).toBe("https://api.duitku.com/merchant/v2/inquiry")
      expect(result.paymentUrl).toBe("https://app.duitku.com/pay/12345")
      expect(result.vaNumber).toBe("888800012345")
      expect(result.reference).toBe("DUI-REF-999")

      // Verify signature calculation: merchantCode + merchantOrderId + paymentAmount
      const expectedSig = crypto
        .createHmac("sha256", "secret-api-key")
        .update("M12345INV-2026-001150000")
        .digest("hex")

      const body = interceptedBody as Record<string, unknown>
      expect(body.merchantCode).toBe("M12345")
      expect(body.paymentAmount).toBe(150000)
      expect(body.merchantOrderId).toBe("INV-2026-001")
      expect(body.productDetails).toBe("Pro Plan Subscription")
      expect(body.email).toBe("user@example.com")
      expect(body.paymentMethod).toBe("VC")
      expect(body.customerVaName).toBe("Jane Doe")
      expect(body.returnUrl).toBe("https://app.example.com/billing/return")
      expect(body.callbackUrl).toBe(
        "https://app.example.com/api/webhooks/duitku"
      )
      expect(body.signature).toBe(expectedSig)
    })

    it("uses sandboxUrl when DUITKU_SANDBOX=true", async () => {
      process.env.DUITKU_SANDBOX = "true"
      let interceptedUrl = ""

      globalThis.fetch = (async (url: string) => {
        interceptedUrl = url
        return {
          ok: true,
          status: 200,
          json: async () => ({
            statusCode: "00",
            statusMessage: "SUCCESS",
            paymentUrl: "https://sandbox.duitku.com/pay/12345",
            vaNumber: "888800012345",
          }),
        } as unknown as Response
      }) as typeof fetch

      const result = await duitkuProvider.createPayment(
        paymentRequest,
        validConfig
      )

      expect(interceptedUrl).toBe(
        "https://sandbox.duitku.com/merchant/v2/inquiry"
      )
      expect(result.paymentUrl).toBe("https://sandbox.duitku.com/pay/12345")
      expect(result.reference).toBe("INV-2026-001") // falls back to invoiceId
    })

    it("throws when fetch response is not ok", async () => {
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 502,
        } as unknown as Response
      }) as typeof fetch

      await expect(
        duitkuProvider.createPayment(paymentRequest, validConfig)
      ).rejects.toThrow("Duitku API error: 502")
    })

    it("throws when Duitku returns non-00 statusCode", async () => {
      globalThis.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            statusCode: "01",
            statusMessage: "Bad Signature",
          }),
        } as unknown as Response
      }) as typeof fetch

      await expect(
        duitkuProvider.createPayment(paymentRequest, validConfig)
      ).rejects.toThrow("Duitku error: Bad Signature")
    })
  })

  describe("verifyCallback", () => {
    const config = { apiKey: "secret-callback-key" }
    it("throws if apiKey is missing", async () => {
      await expect(
        duitkuProvider.verifyCallback!({ merchantCode: "M1" }, {})
      ).rejects.toThrow("Duitku gateway not configured: missing apiKey")
    })

    it("returns true when callback signature is valid", async () => {
      const merchantCode = "M12345"
      const amount = "150000"
      const merchantOrderId = "INV-001"

      const signature = crypto
        .createHmac("sha256", "secret-callback-key")
        .update(merchantCode + amount + merchantOrderId)
        .digest("hex")

      const payload = {
        merchantCode,
        amount,
        merchantOrderId,
        signature,
      }

      const isValid = await duitkuProvider.verifyCallback!(payload, config)
      expect(isValid).toBe(true)
    })

    it("returns false when callback signature does not match", async () => {
      const payload = {
        merchantCode: "M12345",
        amount: "150000",
        merchantOrderId: "INV-001",
        signature: "invalid-signature-hex",
      }

      const isValid = await duitkuProvider.verifyCallback!(payload, config)
      expect(isValid).toBe(false)
    })
  })
})
