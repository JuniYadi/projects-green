import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import { useParams } from "next/navigation"

import ProductDetailPage from "./page"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const whatsappProductResponse = {
  product: {
    code: "WHATSAPP",
    name: "WhatsApp",
    description: "WhatsApp Business messaging platform",
    plans: [
      {
        id: "plan-wa-starter",
        code: "WA_STARTER",
        name: "Starter",
        description: "Entry-level WhatsApp plan",
        resources: { devices: "2", conversations: "500", apiCalls: "1000" },
        offers: [
          {
            id: "offer-wa-starter-monthly",
            billingPeriod: "MONTHLY",
            periodMonths: 1,
            periodPrice: "99000",
            currency: "IDR",
            chargeUnit: "SUBSCRIPTION",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            effectiveTo: null,
          },
          {
            id: "offer-wa-starter-quarterly",
            billingPeriod: "QUARTERLY",
            periodMonths: 3,
            periodPrice: "267300",
            currency: "IDR",
            chargeUnit: "SUBSCRIPTION",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            effectiveTo: null,
          },
        ],
      },
      {
        id: "plan-wa-pro",
        code: "WA_PRO",
        name: "Professional",
        description: "Professional WhatsApp plan",
        resources: { devices: "5", conversations: "2000", apiCalls: "5000" },
        offers: [
          {
            id: "offer-wa-pro-monthly",
            billingPeriod: "MONTHLY",
            periodMonths: 1,
            periodPrice: "299000",
            currency: "IDR",
            chargeUnit: "SUBSCRIPTION",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            effectiveTo: null,
          },
        ],
      },
    ],
  },
  currency: "IDR",
}

describe("ProductDetailPage", () => {
  beforeEach(() => {
    ;(useParams as ReturnType<typeof mock>).mockReturnValue({
      lang: "en",
      product: "whatsapp",
    })
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/billing/catalog/WHATSAPP")) {
        return jsonResponse(whatsappProductResponse)
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("shows loading skeleton while fetching product", () => {
    const view = render(<ProductDetailPage />)
    const skeletons = view.container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders back link to services", async () => {
    const view = render(<ProductDetailPage />)

    await waitFor(() =>
      expect(view.getByText(/back to services/i)).toBeInTheDocument()
    )
    expect(view.getByText(/back to services/i).closest("a")).toHaveAttribute(
      "href",
      "/console/billing/services"
    )
  })

  it("renders product name and description", async () => {
    const view = render(<ProductDetailPage />)

    await waitFor(() =>
      expect(view.getByText(/whatsapp plans/i)).toBeInTheDocument()
    )
    expect(
      view.getByText(/compare plans and pricing for whatsapp/i)
    ).toBeInTheDocument()
  })

  it("displays the currency from the API response", async () => {
    const view = render(<ProductDetailPage />)

    await waitFor(() => expect(view.getByText("IDR")).toBeInTheDocument())
  })

  it("renders plan cards with names and prices", async () => {
    const view = render(<ProductDetailPage />)

    await waitFor(() => expect(view.getByText("Starter")).toBeInTheDocument())
    expect(view.getByText("Professional")).toBeInTheDocument()
    // Monthly price for Starter plan
    expect(view.getAllByText(/99,000/i).length).toBeGreaterThan(0)
  })

  it("renders plan resources as badges", async () => {
    const view = render(<ProductDetailPage />)

    await waitFor(() => expect(view.getByText("Starter")).toBeInTheDocument())
    expect(view.getByText(/devices: 2/i)).toBeInTheDocument()
    expect(view.getByText(/conversations: 500/i)).toBeInTheDocument()
  })

  it("renders all plans with their lowest available billing term without requiring term selection", async () => {
    const view = render(<ProductDetailPage />)

    await waitFor(() => expect(view.getByText("Starter")).toBeInTheDocument())
    expect(view.getByText("Professional")).toBeInTheDocument()
    // Starter has monthly 99,000
    expect(view.getByText(/99,000/i)).toBeInTheDocument()
    // Professional has monthly 299,000
    expect(view.getByText(/299,000/i)).toBeInTheDocument()
    // No term selector buttons
    expect(view.queryByRole("button", { name: "Quarterly" })).toBeNull()
  })

  it("renders lowest available term when a plan only has quarterly pricing", async () => {
    const customResponse = {
      product: {
        code: "WHATSAPP",
        name: "WhatsApp",
        description: "WhatsApp Business messaging platform",
        plans: [
          {
            id: "plan-wa-starter",
            code: "WA_STARTER",
            name: "Starter",
            resources: {},
            offers: [
              {
                id: "offer-wa-starter-quarterly",
                billingPeriod: "QUARTERLY",
                periodMonths: 3,
                periodPrice: "267300",
                currency: "IDR",
                chargeUnit: "SUBSCRIPTION",
                effectiveFrom: "2026-01-01T00:00:00.000Z",
                effectiveTo: null,
              },
            ],
          },
        ],
      },
      currency: "IDR",
    }

    globalThis.fetch = mock(async () =>
      jsonResponse(customResponse)
    ) as unknown as typeof fetch
    const view = render(<ProductDetailPage />)

    await waitFor(() => expect(view.getByText("Starter")).toBeInTheDocument())
    expect(view.getByText(/267,300/i)).toBeInTheDocument()
    expect(view.getByText(/\/ quarterly/i)).toBeInTheDocument()
  })

  it("renders checkout links with correct query params on plan cards", async () => {
    const view = render(<ProductDetailPage />)

    await waitFor(() => expect(view.getByText("Starter")).toBeInTheDocument())

    // Find checkout button for Starter plan — Monthly offer
    const checkoutLinks = view.getAllByText(/subscribe now/i)
    expect(checkoutLinks.length).toBeGreaterThan(0)

    // Verify at least one link contains correct params
    const starterLink = checkoutLinks.find((l) =>
      l.closest("a")?.href.includes("offer-wa-starter-monthly")
    )
    expect(starterLink).toBeTruthy()
    const href = starterLink?.closest("a")?.href ?? ""
    expect(href).toContain("pricingId=offer-wa-starter-monthly")
    expect(href).toContain("product=WHATSAPP")
    expect(href).toContain("plan=WA_STARTER")
    expect(href).toContain("billingPeriod=MONTHLY")
    expect(href).toContain("price=99000")
    expect(href).toContain("currency=IDR")
  })

  it("shows error state on fetch failure", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: false, message: "Server error" }, 500)
    ) as unknown as typeof fetch

    const view = render(<ProductDetailPage />)

    await waitFor(() =>
      expect(view.getByText(/something went wrong/i)).toBeInTheDocument()
    )
  })
})
