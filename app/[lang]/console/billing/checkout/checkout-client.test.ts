import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockQuotePost = mock()
const mockCheckoutPost = mock()

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      billing: {
        checkout: {
          quote: { post: mockQuotePost },
          post: mockCheckoutPost,
        },
      },
    },
  },
}))

// Import after mock.module so checkout-client captures the mocked Eden client.
const { getCheckoutQuote, submitCheckout } = await import("./checkout-client")

const input = {
  pricingId: "pricing-1",
  quantity: 2,
  addonIds: ["addon-1"],
  voucherCode: "WELCOME10",
  quoteToken: "quote-token",
  mode: "PURCHASE" as const,
  idempotencyKey: "idem-1",
}

beforeEach(() => {
  mockQuotePost.mockClear()
  mockCheckoutPost.mockClear()
  mockQuotePost.mockResolvedValue({ data: undefined, error: undefined })
  mockCheckoutPost.mockResolvedValue({ data: undefined, error: undefined })
})

describe("getCheckoutQuote", () => {
  it("returns a successful quote and forwards the checkout input", async () => {
    const quote = {
      quoteId: "quote-1",
      quoteToken: "token-1",
      pricingId: "pricing-1",
      packageCode: "APP_HOSTING",
      planCode: "STARTER",
      currency: "USD",
      billingPeriod: "MONTHLY",
      quantity: "2",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      subtotal: "20.00",
      discount: "2.00",
      firstPayment: "18.00",
      nextRenewal: "20.00",
      addons: [],
      voucher: null,
      expiresAt: "2026-08-06T00:15:00.000Z",
    }
    mockQuotePost.mockResolvedValueOnce({ data: quote })

    await expect(getCheckoutQuote(input)).resolves.toEqual({
      ok: true,
      ...quote,
    })
    expect(mockQuotePost).toHaveBeenCalledWith(input)
  })

  it("normalizes an Eden error payload", async () => {
    mockQuotePost.mockResolvedValueOnce({
      data: undefined,
      error: { value: { error: "INVALID_QUOTE", message: "Quote expired" } },
    })

    await expect(getCheckoutQuote(input)).resolves.toEqual({
      ok: false,
      error: "INVALID_QUOTE",
      message: "Quote expired",
    })
  })

  it("uses fallback fields when Eden gives an empty error payload", async () => {
    mockQuotePost.mockResolvedValueOnce({
      data: undefined,
      error: { value: {} },
    })

    await expect(getCheckoutQuote(input)).resolves.toEqual({
      ok: false,
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred.",
    })
  })
})

describe("submitCheckout", () => {
  it("returns a successful checkout result and forwards the input", async () => {
    const checkout = {
      orderId: "order-1",
      status: "CHARGED" as const,
      subscriptionId: "sub-1",
      invoiceId: "invoice-1",
      invoiceLineId: "line-1",
      subtotal: "20.00",
      discount: "2.00",
      firstPayment: "18.00",
      nextRenewal: "20.00",
      currency: "USD",
      billingPeriod: "MONTHLY",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
    }
    mockCheckoutPost.mockResolvedValueOnce({ data: { ok: true, ...checkout } })

    await expect(submitCheckout(input)).resolves.toEqual({
      ok: true,
      ...checkout,
    })
    expect(mockCheckoutPost).toHaveBeenCalledWith(input)
  })

  it("normalizes an Eden error payload with missing fields", async () => {
    mockCheckoutPost.mockResolvedValueOnce({
      data: undefined,
      error: { value: { message: "Payment was declined" } },
    })

    await expect(submitCheckout(input)).resolves.toEqual({
      ok: false,
      error: "UNKNOWN_ERROR",
      message: "Payment was declined",
    })
  })

  it("normalizes an Eden response without error metadata", async () => {
    mockCheckoutPost.mockResolvedValueOnce({ data: undefined })

    await expect(submitCheckout(input)).resolves.toEqual({
      ok: false,
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred.",
    })
  })
})
