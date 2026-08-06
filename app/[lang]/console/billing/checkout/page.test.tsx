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
    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: false, error: "UNHANDLED", message: "Unhandled" }, 500)
    ) as unknown as typeof fetch
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

    expect(
      view.getByRole("button", { name: /confirm purchase/i })
    ).toBeDisabled()
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
      expect(
        view.getByRole("button", { name: /confirm purchase/i })
      ).toBeEnabled()
    )
  })

  it("shows retry and add balance buttons on insufficient balance", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse(
        {
          ok: false,
          error: "INSUFFICIENT_BALANCE",
          message:
            "Insufficient balance. Please top up your account and try again.",
        },
        422
      )
    ) as unknown as typeof fetch

    const view = render(<CheckoutPage />)

    const submitButton = view.getByRole("button", { name: /confirm purchase/i })
    expect(submitButton).toBeDisabled()

    const checkbox = view.getByLabelText(/i confirm this purchase/i)
    fireEvent.click(checkbox)

    await waitFor(() =>
      expect(
        view.getByRole("button", { name: /confirm purchase/i })
      ).toBeEnabled()
    )
    fireEvent.click(view.getByRole("button", { name: /confirm purchase/i }))

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
    globalThis.fetch = mock(async () =>
      jsonResponse(
        {
          ok: false,
          error: "FULFILLMENT_NOT_SUPPORTED",
          message:
            "The product for this pricing plan is not yet available for purchase. Fulfillment is not configured for this product type.",
        },
        422
      )
    ) as unknown as typeof fetch

    const view = render(<CheckoutPage />)
    const checkbox = view.getByLabelText(/i confirm this purchase/i)
    fireEvent.click(checkbox)
    await waitFor(() =>
      expect(
        view.getByRole("button", { name: /confirm purchase/i })
      ).toBeEnabled()
    )
    fireEvent.click(view.getByRole("button", { name: /confirm purchase/i }))

    await waitFor(() =>
      expect(
        view.getByText(/not yet available for purchase/i)
      ).toBeInTheDocument()
    )
  })
})
