import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor, fireEvent } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mock() })),
}))

import { useParams } from "next/navigation"
import ServicesPage from "./page"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const catalogResponse = {
  products: [
    {
      code: "WHATSAPP",
      name: "WhatsApp",
      description: "WhatsApp Business messaging",
      plans: [
        {
          id: "plan-wa-1",
          code: "WA_STARTER",
          name: "Starter",
          resources: { devices: "2", conversations: "500" },
          offers: [
            {
              id: "offer-wa-1",
              billingPeriod: "MONTHLY",
              periodMonths: 1,
              periodPrice: "99000",
              currency: "IDR",
              chargeUnit: "SUBSCRIPTION",
              effectiveFrom: "2026-01-01T00:00:00.000Z",
              effectiveTo: null,
            },
          ],
        },
      ],
    },
    {
      code: "VPN",
      name: "VPN",
      description: "Virtual Private Network",
      plans: [
        {
          id: "plan-vpn-1",
          code: "VPN_BASIC",
          name: "Basic",
          resources: { bandwidth: "10Gbps", locations: "5" },
          offers: [
            {
              id: "offer-vpn-1",
              billingPeriod: "MONTHLY",
              periodMonths: 1,
              periodPrice: "49000",
              currency: "IDR",
              chargeUnit: "SUBSCRIPTION",
              effectiveFrom: "2026-01-01T00:00:00.000Z",
              effectiveTo: null,
            },
          ],
        },
      ],
    },
    {
      code: "APP_HOSTING",
      name: "App Hosting",
      description: "Application hosting platform",
      plans: [],
    },
  ],
  currency: "IDR",
}

describe("ServicesPage", () => {
  beforeEach(() => {
    ;(useParams as ReturnType<typeof mock>).mockReturnValue({ lang: "en" })
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/billing/catalog")) {
        return jsonResponse(catalogResponse)
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("shows loading skeleton while fetching catalog", () => {
    globalThis.fetch = mock(
      () => new Promise<Response>(() => {})
    ) as unknown as typeof fetch
    const view = render(<ServicesPage />)
    const skeletons = view.container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders product cards after loading", async () => {
    const view = render(<ServicesPage />)

    await waitFor(() => expect(view.getByText("WhatsApp")).toBeInTheDocument())
    expect(view.getByText("VPN")).toBeInTheDocument()
    expect(view.getByText("App Hosting")).toBeInTheDocument()
  })

  it("displays the currency from the API response", async () => {
    const view = render(<ServicesPage />)

    await waitFor(() => expect(view.getByText("IDR")).toBeInTheDocument())
  })

  it("filters products by search query", async () => {
    const view = render(<ServicesPage />)

    await waitFor(() => expect(view.getByText("WhatsApp")).toBeInTheDocument())

    const inputEl = view.getByRole("searchbox") as HTMLInputElement
    fireEvent.change(inputEl, { target: { value: "vpn" } })
    fireEvent.input(inputEl, { target: { value: "vpn" } })

    await waitFor(() => {
      expect(view.queryByText("WhatsApp")).not.toBeInTheDocument()
      expect(view.getByText("VPN")).toBeInTheDocument()
    })
  })

  it("shows empty state when no products match search", async () => {
    const view = render(<ServicesPage />)

    await waitFor(() => expect(view.getByText("WhatsApp")).toBeInTheDocument())

    const inputEl = view.getByRole("searchbox") as HTMLInputElement
    fireEvent.change(inputEl, {
      target: { value: "nonexistent product xyz" },
    })
    fireEvent.input(inputEl, {
      target: { value: "nonexistent product xyz" },
    })

    await waitFor(() => {
      expect(view.getByText(/no services found/i)).toBeInTheDocument()
    })
  })

  it("shows product links to product detail pages", async () => {
    const view = render(<ServicesPage />)

    await waitFor(() => expect(view.getByText("WhatsApp")).toBeInTheDocument())

    const whatsappLink = view
      .getAllByText(/view plans/i)
      .find((el) => el.closest("a")?.getAttribute("href")?.includes("whatsapp"))
    expect(whatsappLink).toBeTruthy()
    expect(whatsappLink?.closest("a")?.getAttribute("href")).toBe(
      "/en/console/billing/services/whatsapp"
    )

    const vpnLink = view
      .getAllByText(/view plans/i)
      .find((el) => el.closest("a")?.getAttribute("href")?.includes("vpn"))
    expect(vpnLink?.closest("a")?.getAttribute("href")).toBe(
      "/en/console/billing/services/vpn"
    )
  })

  it("shows error state and retry button on fetch failure", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: false, message: "Server error" }, 500)
    ) as unknown as typeof fetch

    const view = render(<ServicesPage />)

    await waitFor(() =>
      expect(view.getByText(/something went wrong/i)).toBeInTheDocument()
    )
    expect(view.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })
})
