import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

const pushMock = mock((href: string) => {
  void href
})

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

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
    pushMock.mockClear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("routes manual bank transfer top-up to the invoice detail page", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
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
    }) as unknown as typeof fetch

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

  it("redirects to the Duitku payment gateway URL for VA top-up", async () => {
    const locationStub = { href: "" } as Location
    Object.defineProperty(globalThis.window, "location", {
      configurable: true,
      value: locationStub,
    })

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
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
    }) as unknown as typeof fetch

    const view = render(<TopupFormEnhanced />)

    await waitFor(() =>
      expect(view.getByText("Virtual Account")).toBeInTheDocument()
    )

    fireEvent.click(view.getByDisplayValue("VA"))
    fireEvent.click(view.getByRole("button", { name: /create invoice/i }))

    await waitFor(
      () =>
        expect(locationStub.href).toBe("https://duitku.test/pay/inv_99"),
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
