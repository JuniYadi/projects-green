import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

const pushMock = mock((href: string) => {
  void href
})

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { TopupFormEnhanced } from "./topup-form-enhanced"

const originalFetch = globalThis.fetch
const originalLocation = globalThis.window?.location

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

describe("TopupFormEnhanced", () => {
  beforeEach(() => {
    ;(useRouter as ReturnType<typeof mock>).mockReturnValue({
      push: pushMock,
      replace: () => {},
      refresh: () => {},
    })
    ;(usePathname as ReturnType<typeof mock>).mockReturnValue(
      "/en/console/billing/topup"
    )
    pushMock.mockClear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("routes manual bank transfer top-up to the invoice detail page", async () => {
    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/payments/topup/methods")) {
          return jsonResponse({
            ok: true,
            currency: "IDR",
            config: {
              symbol: "Rp",
              ratePerBase: 18000,
              baseCode: "USD",
              presets: [180000, 450000, 900000, 1800000, 4500000],
              minTopup: 50000,
              maxTopup: 200000000,
            },
            methods: { MANUAL_BANK: true, VA: false, QRIS: false },
          })
        }
        if (url.includes("/api/payments/topup/bank-accounts")) {
          return jsonResponse({
            ok: true,
            data: [
              {
                id: "bank_1",
                bankCode: "BCA",
                bankName: "BCA",
                accountNumber: "123",
                accountName: "Acme",
                isActive: true,
                isDefault: true,
              },
            ],
          })
        }
        if (url.includes("/api/payments/topup") && init?.method === "POST") {
          return jsonResponse({ ok: true, invoice: { id: "inv_42" } })
        }
        return jsonResponse({ ok: false, message: "Unhandled" }, 500)
      }
    ) as unknown as typeof fetch

    const view = render(<TopupFormEnhanced />)

    await waitFor(() =>
      expect(view.getByText("Manual Bank Transfer")).toBeInTheDocument()
    )
    // VA/QRIS are not available, so they should not render.
    expect(view.queryByText("Virtual Account")).not.toBeInTheDocument()
    expect(view.queryByText("QRIS")).not.toBeInTheDocument()

    fireEvent.click(view.getByRole("button", { name: /create invoice/i }))

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/console/billing/invoices/inv_42")
    )
    // Must not route to the confirm page directly.
    expect(pushMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/payments/confirm")
    )
  })

  it("renders PayPal for USD accounts and redirects to the PayPal URL", async () => {
    const locationStub = { href: "" } as Location
    Object.defineProperty(globalThis.window, "location", {
      configurable: true,
      value: locationStub,
    })

    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/payments/topup/methods")) {
          return jsonResponse({
            ok: true,
            currency: "USD",
            config: {
              symbol: "$",
              ratePerBase: 1,
              baseCode: "USD",
              presets: [10, 25, 50, 100, 250],
              minTopup: 10,
              maxTopup: 10000,
            },
            methods: {
              MANUAL_BANK: true,
              VA: false,
              QRIS: false,
              PAYPAL: true,
            },
          })
        }
        if (url.includes("/api/payments/topup/bank-accounts")) {
          return jsonResponse({ ok: true, data: [] })
        }
        if (url.includes("/api/payments/topup") && init?.method === "POST") {
          return jsonResponse({
            ok: true,
            invoice: { id: "inv_paypal" },
            paymentUrl: "https://paypal.test/checkout/inv_paypal",
          })
        }
        return jsonResponse({ ok: false, message: "Unhandled" }, 500)
      }
    ) as unknown as typeof fetch

    const view = render(<TopupFormEnhanced currency="USD" />)

    await waitFor(() => expect(view.getByText("PayPal")).toBeInTheDocument())
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/payments/topup/methods?currency=USD",
      expect.objectContaining({ cache: "no-store" })
    )
    expect(view.queryByText("Virtual Account")).not.toBeInTheDocument()
    expect(view.queryByText("QRIS")).not.toBeInTheDocument()

    fireEvent.click(view.getByDisplayValue("PAYPAL"))
    fireEvent.click(view.getByRole("button", { name: /create invoice/i }))

    await waitFor(
      () =>
        expect(locationStub.href).toBe(
          "https://paypal.test/checkout/inv_paypal"
        ),
      { timeout: 1000 }
    )

    if (originalLocation) {
      Object.defineProperty(globalThis.window, "location", {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it("selects the first available gateway method when manual bank is unavailable", async () => {
    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/payments/topup/methods")) {
          return jsonResponse({
            ok: true,
            currency: "IDR",
            config: {
              symbol: "Rp",
              ratePerBase: 18000,
              baseCode: "USD",
              presets: [180000, 450000],
              minTopup: 50000,
              maxTopup: 200000000,
            },
            methods: {
              MANUAL_BANK: false,
              VA: true,
              QRIS: true,
              PAYPAL: false,
            },
          })
        }
        if (url.includes("/api/payments/topup/bank-accounts")) {
          return jsonResponse({ ok: true, data: [] })
        }
        if (url.includes("/api/payments/topup") && init?.method === "POST") {
          return jsonResponse({
            ok: true,
            invoice: { id: "inv_gateway" },
            paymentUrl: "https://gateway.test/pay/inv_gateway",
          })
        }
        return jsonResponse({ ok: false, message: "Unhandled" }, 500)
      }
    ) as unknown as typeof fetch

    const view = render(<TopupFormEnhanced />)

    await waitFor(() => expect(view.getByDisplayValue("VA")).toBeChecked())
    expect(view.queryByText("Manual Bank Transfer")).not.toBeInTheDocument()
    expect(
      view.queryByText("No bank accounts available. Please contact support.")
    ).not.toBeInTheDocument()

    fireEvent.click(view.getByRole("button", { name: /create invoice/i }))

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/payments/topup",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ amount: 180000, paymentMethod: "VA" }),
        })
      )
    )
  })

  it("disables invoice creation when no payment methods are available", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/payments/topup/methods")) {
        return jsonResponse({
          ok: true,
          currency: "IDR",
          config: {
            symbol: "Rp",
            ratePerBase: 18000,
            baseCode: "USD",
            presets: [180000, 450000],
            minTopup: 50000,
            maxTopup: 200000000,
          },
          methods: {
            MANUAL_BANK: false,
            VA: false,
            QRIS: false,
            PAYPAL: false,
          },
        })
      }
      if (url.includes("/api/payments/topup/bank-accounts")) {
        return jsonResponse({ ok: true, data: [] })
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<TopupFormEnhanced />)

    await waitFor(() =>
      expect(
        view.getByText(/No payment methods are available/i)
      ).toBeInTheDocument()
    )
    expect(view.getByRole("button", { name: /create invoice/i })).toBeDisabled()
    expect(view.queryByText("Manual Bank Transfer")).not.toBeInTheDocument()
  })

  it("redirects to the Duitku payment gateway URL for VA top-up", async () => {
    const locationStub = { href: "" } as Location
    Object.defineProperty(globalThis.window, "location", {
      configurable: true,
      value: locationStub,
    })

    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/payments/topup/methods")) {
          return jsonResponse({
            ok: true,
            currency: "IDR",
            config: {
              symbol: "Rp",
              ratePerBase: 18000,
              baseCode: "USD",
              presets: [180000, 450000, 900000, 1800000, 4500000],
              minTopup: 50000,
              maxTopup: 200000000,
            },
            methods: { MANUAL_BANK: true, VA: true, QRIS: true },
          })
        }
        if (url.includes("/api/payments/topup/bank-accounts")) {
          return jsonResponse({ ok: true, data: [] })
        }
        if (url.includes("/api/payments/topup") && init?.method === "POST") {
          return jsonResponse({
            ok: true,
            invoice: { id: "inv_99" },
            paymentUrl: "https://duitku.test/pay/inv_99",
          })
        }
        return jsonResponse({ ok: false, message: "Unhandled" }, 500)
      }
    ) as unknown as typeof fetch

    const view = render(<TopupFormEnhanced />)

    await waitFor(() =>
      expect(view.getByText("Virtual Account")).toBeInTheDocument()
    )

    fireEvent.click(view.getByDisplayValue("VA"))
    fireEvent.click(view.getByRole("button", { name: /create invoice/i }))

    await waitFor(
      () => expect(locationStub.href).toBe("https://duitku.test/pay/inv_99"),
      { timeout: 1000 }
    )

    if (originalLocation) {
      Object.defineProperty(globalThis.window, "location", {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
