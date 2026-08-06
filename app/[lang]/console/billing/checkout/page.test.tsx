import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import { useSearchParams } from "next/navigation"

import CheckoutPage from "./page"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
const checkoutPreview = {
  ok: true,
  quoteId: "quote-1",
  quoteToken: "quote-token-1",
  pricingId: "offer-wa-starter-monthly",
  packageCode: "WHATSAPP",
  planCode: "WA_STARTER",
  currency: "IDR",
  billingPeriod: "MONTHLY",
  quantity: "1",
  periodStart: "2026-08-06T00:00:00.000Z",
  periodEnd: "2026-09-06T00:00:00.000Z",
  subtotal: "99000",
  discount: "0",
  firstPayment: "99000",
  nextRenewal: "2026-09-06T00:00:00.000Z",
  addons: [],
  availableAddons: [],
  voucher: null,
  expiresAt: "2026-08-06T00:15:00.000Z",
}

function mockCheckoutFetch(body: unknown, status = 200) {
  let callCount = 0
  return mock(async () => {
    if (callCount++ === 0) return jsonResponse(checkoutPreview)
    return jsonResponse(body, status)
  }) as unknown as typeof fetch
}

describe("Billing CheckoutPage", () => {
  beforeEach(() => {
    ;(useSearchParams as ReturnType<typeof mock>).mockReturnValue(
      new URLSearchParams({
        pricingId: "offer-wa-starter-monthly",
        product: "WHATSAPP",
        plan: "WA_STARTER",
        billingPeriod: "MONTHLY",
        price: "99000",
        currency: "IDR",
      })
    )
    globalThis.fetch = mockCheckoutFetch(
      { ok: false, error: "UNHANDLED", message: "Unhandled" },
      500
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("shows confirmation checkbox gated before submit", async () => {
    const view = render(<CheckoutPage />)

    await waitFor(() =>
      expect(
        view.getByLabelText(/i confirm this purchase/i)
      ).toBeInTheDocument()
    )

    expect(view.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  it("enables submit when confirmation is checked", async () => {
    const view = render(<CheckoutPage />)

    await waitFor(() =>
      expect(
        view.getByLabelText(/i confirm this purchase/i)
      ).toBeInTheDocument()
    )

    const checkbox = view.getByLabelText(/i confirm this purchase/i)
    fireEvent.click(checkbox)

    await waitFor(() =>
      expect(view.getByRole("button", { name: /confirm/i })).toBeEnabled()
    )
  })

  it("shows retry and add balance buttons on insufficient balance", async () => {
    globalThis.fetch = mockCheckoutFetch(
      {
        ok: false,
        error: "INSUFFICIENT_BALANCE",
        message:
          "Insufficient balance. Please top up your account and try again.",
      },
      422
    )

    const view = render(<CheckoutPage />)

    await waitFor(() =>
      expect(view.getByRole("button", { name: /confirm/i })).toBeInTheDocument()
    )
    const submitButton = view.getByRole("button", { name: /confirm/i })
    expect(submitButton).toBeDisabled()

    const checkbox = view.getByLabelText(/i confirm this purchase/i)
    fireEvent.click(checkbox)

    await waitFor(() =>
      expect(view.getByRole("button", { name: /confirm/i })).toBeEnabled()
    )
    fireEvent.click(view.getByRole("button", { name: /confirm/i }))

    await waitFor(() =>
      expect(view.getByText(/insufficient balance/i)).toBeInTheDocument()
    )

    expect(view.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: /add balance/i })
    ).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: /choose another plan/i })
    ).toBeInTheDocument()
  })

  it("shows unsupported product message on fulfillment failure", async () => {
    globalThis.fetch = mockCheckoutFetch(
      {
        ok: false,
        error: "FULFILLMENT_NOT_SUPPORTED",
        message:
          "The product for this pricing plan is not yet available for purchase. Fulfillment is not configured for this product type.",
      },
      422
    )

    const view = render(<CheckoutPage />)
    await waitFor(() =>
      expect(
        view.getByLabelText(/i confirm this purchase/i)
      ).toBeInTheDocument()
    )
    const checkbox = view.getByLabelText(/i confirm this purchase/i)
    fireEvent.click(checkbox)
    await waitFor(() =>
      expect(view.getByRole("button", { name: /confirm/i })).toBeEnabled()
    )
    fireEvent.click(view.getByRole("button", { name: /confirm/i }))

    await waitFor(() =>
      expect(
        view.getByText(/not yet available for purchase/i)
      ).toBeInTheDocument()
    )
  })
  it("explains a balance-credit currency mismatch without consuming a claim", async () => {
    globalThis.fetch = mockCheckoutFetch(
      {
        ok: false,
        error: "BILLING_CURRENCY_MISMATCH",
        message: "Voucher currency does not match the billing account.",
      },
      400
    )

    const view = render(<CheckoutPage />)
    await waitFor(() =>
      expect(
        view.getByRole("button", { name: /apply voucher/i })
      ).toBeInTheDocument()
    )
    fireEvent.change(view.getByLabelText("Voucher code"), {
      target: { value: "CREDIT-IDR" },
    })
    fireEvent.click(view.getByRole("button", { name: /apply voucher/i }))

    await waitFor(() =>
      expect(
        view.getByText(/must match your billing account currency/i)
      ).toBeInTheDocument()
    )
    expect(
      view.queryByText(/voucher claim was not consumed/i)
    ).toBeInTheDocument()
  })
})
