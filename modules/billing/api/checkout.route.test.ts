import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import {
  MockAuthContext,
  defaultAuth,
  defaultAuthNoUser,
} from "@/test/helpers/test-auth"

import { createBillingCheckoutRoutes } from "./checkout.route"
import { RecurringPriceResolutionError } from "../pricing/pricing.service"

const mockCreateOrder = mock()
const mockChargeOrder = mock()
const mockFulfillOrder = mock()
const mockQuoteService = { createQuote: mock() }

mock.module("@/modules/billing/orders/order.service", () => ({
  BillingOrderService: class MockBillingOrderService {
    createOrder = mockCreateOrder
    chargeOrder = mockChargeOrder
    fulfillOrder = mockFulfillOrder
  },
}))

function buildApp(
  authContext: MockAuthContext,
  quoteService?: { createQuote: typeof mockQuoteService.createQuote }
) {
  return new Elysia().use(
    createBillingCheckoutRoutes({
      authenticate: async () => authContext,
      quoteService: quoteService as never,
    })
  )
}

function makeRequest(
  app: ReturnType<typeof buildApp>,
  body: Record<string, unknown>
) {
  return app.handle(
    new Request("http://localhost/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

const fulfilledOrderResult = {
  orderId: "order-1",
  status: "FULFILLED" as const,
  subscriptionId: "sub-1",
  invoiceId: "inv-1",
  invoiceLineId: "line-1",
  amount: "50000",
  currency: "IDR",
  billingPeriod: "MONTHLY" as const,
  periodStart: "2026-01-01T00:00:00.000Z",
  periodEnd: "2026-02-01T00:00:00.000Z",
}

describe("POST /billing/checkout", () => {
  beforeEach(() => {
    mockCreateOrder.mockReset()
    mockChargeOrder.mockReset()
    mockFulfillOrder.mockReset()
    mockQuoteService.createQuote.mockReset()
  })

  it("returns a quote with addon and voucher totals", async () => {
    mockQuoteService.createQuote.mockResolvedValueOnce({
      quoteId: "quote-1",
      quoteToken: "quote-token-1",
      pricingId: "pricing-1",
      packageCode: "VPN",
      planCode: "PRO",
      currency: "IDR",
      billingPeriod: "MONTHLY",
      quantity: "1",
      periodStart: "2026-08-06T10:00:00.000Z",
      periodEnd: "2026-09-06T10:00:00.000Z",
      subtotal: "120000",
      discount: "12000",
      firstPayment: "108000",
      nextRenewal: "2026-09-06T10:00:00.000Z",
      addons: [],
      voucher: null,
      expiresAt: "2026-08-06T10:15:00.000Z",
    })
    const app = buildApp(defaultAuth, mockQuoteService)
    const response = await app.handle(
      new Request("http://localhost/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingId: "pricing-1",
          addonIds: ["addon-1"],
          voucherCode: "SAVE10",
          idempotencyKey: "quote-1",
        }),
      })
    )

    expect(response.status).toBe(200)
    expect((await response.json()).firstPayment).toBe("108000")
    expect(mockQuoteService.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        addonIds: ["addon-1"],
        voucherCode: "SAVE10",
      })
    )
  })

  it("uses the quote discount when creating the order", async () => {
    mockQuoteService.createQuote.mockResolvedValueOnce({
      quoteId: "quote-1",
      quoteToken: "quote-token-1",
      pricingId: "pricing-1",
      packageCode: "VPN",
      planCode: "PRO",
      currency: "IDR",
      billingPeriod: "MONTHLY",
      quantity: "1",
      periodStart: "2026-08-06T10:00:00.000Z",
      periodEnd: "2026-09-06T10:00:00.000Z",
      subtotal: "120000",
      discount: "12000",
      firstPayment: "108000",
      nextRenewal: "2026-09-06T10:00:00.000Z",
      addons: [],
      voucher: null,
      expiresAt: "2026-08-06T10:15:00.000Z",
    })
    mockCreateOrder.mockResolvedValueOnce({ ...fulfilledOrderResult })
    mockChargeOrder.mockResolvedValueOnce({ ...fulfilledOrderResult })
    mockFulfillOrder.mockResolvedValueOnce({
      ...fulfilledOrderResult,
      amount: "108000",
    })

    const response = await makeRequest(
      buildApp(defaultAuth, mockQuoteService),
      {
        pricingId: "pricing-1",
        addonIds: ["addon-1"],
        voucherCode: "SAVE10",
        idempotencyKey: "checkout-1",
      }
    )

    expect(response.status).toBe(200)
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        discountAmount: expect.objectContaining({
          toString: expect.any(Function),
        }),
      })
    )
    const createOrderInput = mockCreateOrder.mock.calls[0]?.[0]
    expect(createOrderInput.discountAmount.toString()).toBe("12000")
    expect(createOrderInput.amount.toString()).toBe("120000")
    expect((await response.json()).discount).toBe("12000")
  })

  describe("auth guard", () => {
    it("returns 401 when no user is signed in", async () => {
      const app = buildApp(defaultAuthNoUser)
      const response = await makeRequest(app, {
        pricingId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "key-1",
      })

      expect(response.status).toBe(401)
      const body = (await response.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when no active organization", async () => {
      const app = buildApp({ ...defaultAuth, organizationId: null })
      const response = await makeRequest(app, {
        pricingId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "key-1",
      })

      expect(response.status).toBe(403)
      const body = (await response.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NO_ORGANIZATION")
    })
  })

  describe("validation", () => {
    it("returns 400 when pricingId is missing", async () => {
      const app = buildApp(defaultAuth)
      const response = await makeRequest(app, { idempotencyKey: "key-1" })

      expect(response.status).toBe(400)
      const body = (await response.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 400 when idempotencyKey is missing", async () => {
      const app = buildApp(defaultAuth)
      const response = await makeRequest(app, {
        pricingId: "00000000-0000-4000-8000-000000000001",
      })

      expect(response.status).toBe(400)
      const body = (await response.json()) as { ok: boolean; error: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })
  })

  describe("idempotency", () => {
    it("passes idempotencyKey through to createOrder", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockResolvedValue({
        orderId: "order-1",
        status: "PENDING" as const,
        subscriptionId: null,
        invoiceId: null,
        invoiceLineId: null,
        amount: "50000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockChargeOrder.mockResolvedValue({
        orderId: "order-1",
        status: "CHARGED" as const,
        subscriptionId: null,
        invoiceId: "inv-1",
        invoiceLineId: "line-1",
        amount: "50000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockFulfillOrder.mockResolvedValue(fulfilledOrderResult)

      const response = await makeRequest(app, {
        pricingId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "idem-key-123",
      })

      expect(response.status).toBe(200)
      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: "idem-key-123" })
      )
    })

    it("converts quantity to a Decimal before creating the order", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockResolvedValue({
        orderId: "order-1",
        status: "PENDING" as const,
        subscriptionId: null,
        invoiceId: null,
        invoiceLineId: null,
        amount: "150000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockChargeOrder.mockResolvedValue({
        orderId: "order-1",
        status: "CHARGED" as const,
        subscriptionId: "sub-1",
        invoiceId: "inv-1",
        invoiceLineId: "line-1",
        amount: "150000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockFulfillOrder.mockResolvedValue(fulfilledOrderResult)

      const response = await makeRequest(app, {
        pricingId: "pricing-1",
        quantity: 3,
        idempotencyKey: "key-quantity",
      })

      expect(response.status).toBe(200)
      expect(mockCreateOrder.mock.calls[0]?.[0].quantity.toString()).toBe("3")
    })
  })

  describe("balance failure", () => {
    it("returns 422 when balance is insufficient", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockResolvedValue({
        orderId: "order-1",
        status: "PENDING" as const,
        subscriptionId: null,
        invoiceId: null,
        invoiceLineId: null,
        amount: "50000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockChargeOrder.mockRejectedValue(new Error("INSUFFICIENT_BALANCE"))

      const response = await makeRequest(app, {
        pricingId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "key-1",
      })

      expect(response.status).toBe(422)
      const body = (await response.json()) as {
        ok: boolean
        error: string
        message: string
      }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INSUFFICIENT_BALANCE")
    })
  })

  describe("error mapping", () => {
    it("maps pricing resolution failures to a client error", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockRejectedValue(
        new RecurringPriceResolutionError("PRICE_NOT_FOUND", "missing")
      )

      const response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-1",
      })

      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe("PRICING_NOT_FOUND")
    })

    it("maps missing accounts and unexpected order errors", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockRejectedValueOnce(
        new Error("BILLING_ACCOUNT_NOT_FOUND")
      )
      let response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-1",
      })
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe("BILLING_ACCOUNT_NOT_FOUND")

      mockCreateOrder.mockRejectedValueOnce(new Error("DATABASE_ERROR"))
      response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-2",
      })
      expect(response.status).toBe(500)
      expect((await response.json()).error).toBe("INTERNAL_ERROR")
    })

    it("maps charge failures", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockResolvedValue({
        orderId: "order-1",
        status: "PENDING" as const,
      })
      mockChargeOrder.mockRejectedValueOnce(new Error("CURRENCY_MISMATCH"))

      let response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-1",
      })
      expect(response.status).toBe(422)
      expect((await response.json()).error).toBe("CURRENCY_MISMATCH")

      mockChargeOrder.mockRejectedValueOnce(new Error("ORDER_NOT_CHARGEABLE"))
      response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-2",
      })
      expect(response.status).toBe(409)
      expect((await response.json()).error).toBe("ORDER_NOT_CHARGEABLE")

      mockChargeOrder.mockRejectedValueOnce(new Error("CHARGE_ERROR"))
      response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-3",
      })
      expect(response.status).toBe(500)
      expect((await response.json()).error).toBe("INTERNAL_ERROR")
    })

    it("maps fulfillment lock and unexpected failures", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockResolvedValue({ orderId: "order-1" })
      mockChargeOrder.mockResolvedValue({ orderId: "order-1" })
      mockFulfillOrder.mockRejectedValueOnce(
        new Error("ADVISORY_LOCK_UNAVAILABLE")
      )

      let response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-1",
      })
      expect(response.status).toBe(503)
      expect((await response.json()).error).toBe("SERVICE_UNAVAILABLE")

      mockFulfillOrder.mockRejectedValueOnce(new Error("FULFILLMENT_ERROR"))
      response = await makeRequest(app, {
        pricingId: "pricing-1",
        idempotencyKey: "key-2",
      })
      expect(response.status).toBe(500)
      expect((await response.json()).error).toBe("FULFILLMENT_ERROR")
    })
  })

  describe("unsupported fulfillment", () => {
    it("returns 422 when fulfillment adapter is not found", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockResolvedValue({
        orderId: "order-1",
        status: "PENDING" as const,
        subscriptionId: null,
        invoiceId: null,
        invoiceLineId: null,
        amount: "50000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockChargeOrder.mockResolvedValue({
        orderId: "order-1",
        status: "CHARGED" as const,
        subscriptionId: null,
        invoiceId: "inv-1",
        invoiceLineId: "line-1",
        amount: "50000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockFulfillOrder.mockRejectedValue(
        new Error("FULFILLMENT_ADAPTER_NOT_FOUND: UNKNOWN_PRODUCT")
      )

      const response = await makeRequest(app, {
        pricingId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "key-1",
      })

      expect(response.status).toBe(422)
      const body = (await response.json()) as {
        ok: boolean
        error: string
        message: string
      }
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FULFILLMENT_NOT_SUPPORTED")
    })
  })

  describe("happy path", () => {
    it("returns 200 with full quote DTO on success", async () => {
      const app = buildApp(defaultAuth)
      mockCreateOrder.mockResolvedValue({
        orderId: "order-1",
        status: "PENDING" as const,
        subscriptionId: null,
        invoiceId: null,
        invoiceLineId: null,
        amount: "50000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockChargeOrder.mockResolvedValue({
        orderId: "order-1",
        status: "CHARGED" as const,
        subscriptionId: null,
        invoiceId: "inv-1",
        invoiceLineId: "line-1",
        amount: "50000",
        currency: "IDR",
        billingPeriod: "MONTHLY" as const,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      })
      mockFulfillOrder.mockResolvedValue(fulfilledOrderResult)

      const response = await makeRequest(app, {
        pricingId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "key-1",
      })

      expect(response.status).toBe(200)
      const body = (await response.json()) as Record<string, unknown>
      expect(body.ok).toBe(true)
      expect(body.orderId).toBe("order-1")
      expect(body.status).toBe("FULFILLED")
      expect(body.subscriptionId).toBe("sub-1")
      expect(body.invoiceId).toBe("inv-1")
      expect(body.discount).toBe("0")
      expect(body.currency).toBe("IDR")
      expect(body.nextRenewal).toBe("2026-02-01T00:00:00.000Z")
    })
  })
})
