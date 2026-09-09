import { describe, it, expect, afterEach } from "bun:test"
import { paypalProvider } from "./paypal.provider"

describe("PaypalPaymentProvider", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("metadata", () => {
    it("has expected provider properties", () => {
      expect(paypalProvider.id).toBe("paypal")
      expect(paypalProvider.name).toBe("PayPal")
      expect(paypalProvider.supportedCurrencies).toEqual(["USD"])
      expect(paypalProvider.paymentMethods).toEqual(["REDIRECT"])
      expect(paypalProvider.configFields).toBeDefined()
      expect(paypalProvider.configFields.length).toBe(4)
    })
  })

  describe("createPayment", () => {
    const validConfig = {
      clientId: "client-id-123",
      clientSecret: "client-secret-456",
      environment: "sandbox",
    }

    const paymentRequest = {
      invoiceId: "INV-USD-100",
      amount: 49.99,
      currency: "USD",
      productDetails: "Standard Monthly Plan",
      email: "payer@example.com",
      paymentMethod: "REDIRECT",
      customerName: "John Smith",
      returnUrl: "https://app.example.com/billing/paypal-return",
      callbackUrl: "https://example.com/callback",
    }

    it("throws if clientId or clientSecret is missing", async () => {
      await expect(
        paypalProvider.createPayment(paymentRequest, { clientId: "id" })
      ).rejects.toThrow(
        "PayPal gateway not configured: missing clientId or clientSecret"
      )

      await expect(
        paypalProvider.createPayment(paymentRequest, { clientSecret: "secret" })
      ).rejects.toThrow(
        "PayPal gateway not configured: missing clientId or clientSecret"
      )
    })

    it("throws if oauth token call fails", async () => {
      globalThis.fetch = (async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: false,
            status: 401,
          } as unknown as Response
        }
        return { ok: true } as unknown as Response
      }) as typeof fetch

      await expect(
        paypalProvider.createPayment(paymentRequest, validConfig)
      ).rejects.toThrow("PayPal auth error: 401")
    })

    it("throws if order creation fails", async () => {
      globalThis.fetch = (async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-access-token" }),
          } as unknown as Response
        }
        if (url.includes("/v2/checkout/orders")) {
          return {
            ok: false,
            status: 422,
            text: async () => "INVALID_REQUEST_PARAMETERS",
          } as unknown as Response
        }
        return { ok: true } as unknown as Response
      }) as typeof fetch

      await expect(
        paypalProvider.createPayment(paymentRequest, validConfig)
      ).rejects.toThrow("PayPal order error 422: INVALID_REQUEST_PARAMETERS")
    })

    it("throws if approval link is not returned in order links", async () => {
      globalThis.fetch = (async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-access-token" }),
          } as unknown as Response
        }
        if (url.includes("/v2/checkout/orders")) {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              id: "ORDER-12345",
              links: [{ rel: "self", href: "https://api.paypal.com/order" }],
            }),
          } as unknown as Response
        }
        return { ok: true } as unknown as Response
      }) as typeof fetch

      await expect(
        paypalProvider.createPayment(paymentRequest, validConfig)
      ).rejects.toThrow("PayPal: no approval URL returned")
    })

    it("creates payment successfully and returns redirectUrl and reference", async () => {
      const calls: Array<{
        url: string
        headers?: Record<string, string>
        body?: string
      }> = []

      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        calls.push({
          url,
          headers: init?.headers as Record<string, string>,
          body: init?.body as string,
        })

        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "valid-token" }),
          } as unknown as Response
        }

        if (url.includes("/v2/checkout/orders")) {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              id: "PAYPAL-ORDER-777",
              links: [
                {
                  rel: "self",
                  href: "https://api-m.sandbox.paypal.com/v2/checkout/orders/PAYPAL-ORDER-777",
                },
                {
                  rel: "approve",
                  href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-777",
                },
              ],
            }),
          } as unknown as Response
        }

        return { ok: false } as unknown as Response
      }) as typeof fetch

      const result = await paypalProvider.createPayment(
        paymentRequest,
        validConfig
      )

      expect(result.redirectUrl).toBe(
        "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-777"
      )
      expect(result.reference).toBe("PAYPAL-ORDER-777")
      expect(calls.length).toBe(2)
      expect(calls[0].url).toBe(
        "https://api-m.sandbox.paypal.com/v1/oauth2/token"
      )
      expect(calls[1].url).toBe(
        "https://api-m.sandbox.paypal.com/v2/checkout/orders"
      )
    })

    it("uses production url when environment is production", async () => {
      const prodConfig = {
        ...validConfig,
        environment: "production",
      }

      let orderUrl = ""
      globalThis.fetch = (async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "valid-token" }),
          } as unknown as Response
        }
        if (url.includes("/v2/checkout/orders")) {
          orderUrl = url
          return {
            ok: true,
            status: 201,
            json: async () => ({
              id: "PROD-ORDER-1",
              links: [
                {
                  rel: "approve",
                  href: "https://www.paypal.com/checkoutnow?token=PROD-ORDER-1",
                },
              ],
            }),
          } as unknown as Response
        }
        return { ok: false } as unknown as Response
      }) as typeof fetch

      const result = await paypalProvider.createPayment(
        paymentRequest,
        prodConfig
      )
      expect(orderUrl).toBe("https://api-m.paypal.com/v2/checkout/orders")
      expect(result.reference).toBe("PROD-ORDER-1")
    })
  })

  describe("verifyCallback", () => {
    const fullConfig = {
      webhookId: "WH-123",
      clientId: "client-id-123",
      clientSecret: "client-secret-456",
      authAlgo: "SHA256withRSA",
      certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
      transmissionId: "trans-123",
      transmissionSig: "sig-abc",
      transmissionTime: "2026-09-10T12:00:00Z",
    }

    it("returns false when webhookId is not provided (fail closed)", async () => {
      const verified = await paypalProvider.verifyCallback!(
        { event_type: "PAYMENT.CAPTURE.COMPLETED" },
        {}
      )
      expect(verified).toBe(false)
    })

    it("returns false for unsupported event type", async () => {
      const verified = await paypalProvider.verifyCallback!(
        { event_type: "CUSTOMER.DISPUTE.CREATED" },
        fullConfig
      )
      expect(verified).toBe(false)
    })

    it("returns false when required transmission headers or secrets are missing", async () => {
      const verified = await paypalProvider.verifyCallback!(
        { event_type: "PAYMENT.CAPTURE.COMPLETED" },
        { webhookId: "WH-123" }
      )
      expect(verified).toBe(false)
    })

    it("calls PayPal verification API and returns true on SUCCESS", async () => {
      let calledVerifyEndpoint = false
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "test-token" }),
          } as unknown as Response
        }
        if (url.includes("/v1/notifications/verify-webhook-signature")) {
          calledVerifyEndpoint = true
          const body = JSON.parse(String(init?.body || "{}"))
          expect(body.webhook_id).toBe("WH-123")
          expect(body.auth_algo).toBe("SHA256withRSA")
          return {
            ok: true,
            json: async () => ({ verification_status: "SUCCESS" }),
          } as unknown as Response
        }
        return { ok: false } as unknown as Response
      }) as typeof fetch

      const verified = await paypalProvider.verifyCallback!(
        { event_type: "PAYMENT.CAPTURE.COMPLETED" },
        fullConfig
      )
      expect(verified).toBe(true)
      expect(calledVerifyEndpoint).toBe(true)
    })

    it("returns false when PayPal verification fails", async () => {
      globalThis.fetch = (async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "test-token" }),
          } as unknown as Response
        }
        if (url.includes("/v1/notifications/verify-webhook-signature")) {
          return {
            ok: true,
            json: async () => ({ verification_status: "FAILURE" }),
          } as unknown as Response
        }
        return { ok: false } as unknown as Response
      }) as typeof fetch

      const verified = await paypalProvider.verifyCallback!(
        { event_type: "PAYMENT.CAPTURE.COMPLETED" },
        fullConfig
      )
      expect(verified).toBe(false)
    })
  })
})
