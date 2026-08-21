import "@/test/register"
import { describe, it, expect, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
const mockPricing = mock(() =>
  Promise.resolve({
    ok: true,
    devices: [
      {
        deviceId: "device-1",
        phoneNumber: "+6281234567890",
        country: "ID",
        rateTier: "BASE",
        quotaRemaining: 10,
        categories: [
          {
            category: "MARKETING",
            quotaCredit: "1.50",
            configured: true,
            description: "Marketing template",
            currency: "IDR",
            overagePrice: "770",
            tierPrices: {
              BASE: "770",
              TIER_1: "741",
              TIER_2: "711",
              TIER_3: "682",
            },
          },
          {
            category: "UTILITY",
            quotaCredit: "1.00",
            configured: false,
            description: null,
            currency: "IDR",
            overagePrice: "469",
            tierPrices: {
              BASE: "469",
              TIER_1: "451",
              TIER_2: "433",
              TIER_3: "415",
            },
          },
        ],
      },
    ],
    overage: {
      unitPrice: "150.00",
      currency: "IDR",
      configured: true,
    },
  })
)

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  usePathname: () => "/en/console/whatsapp/pricing",
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    messages: {
      pricing: mockPricing,
    },
    usage: {
      ledger: mock(() =>
        Promise.resolve({
          ok: true,
          data: [],
          total: 0,
          totalPages: 1,
          summary: {
            totalCredits: 0,
            totalRefundedCredits: 0,
            activeCredits: 0,
          },
        })
      ),
    },
    devices: {
      list: mock(() => Promise.resolve({ ok: true, devices: [] })),
    },
  },
}))

import WhatsAppPricingPage from "./page"

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("WhatsAppPricingPage", () => {
  beforeEach(() => {
    mockPricing.mockClear()
  })

  it("renders heading, compact pricing details, and ledger section", async () => {
    const view = renderWithQuery(<WhatsAppPricingPage />)
    expect(view.getByText(/WhatsApp Pricing/i)).toBeInTheDocument()
    expect(
      view.getByText(/Transaction & Deduction Ledger/i)
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(view.getAllByText("MARKETING").length).toBeGreaterThanOrEqual(1)
      expect(view.getAllByText("UTILITY").length).toBeGreaterThanOrEqual(1)
      expect(view.getByText("Rp 770")).toBeInTheDocument()
      expect(view.getByText("Rp 741")).toBeInTheDocument()
    })
  })

  it("handles exhausted device quota banner display", async () => {
    mockPricing.mockResolvedValueOnce({
      ok: true,
      devices: [
        {
          deviceId: "device-1",
          phoneNumber: "+6281234567890",
          country: "ID",
          rateTier: "BASE",
          quotaRemaining: 0,
          categories: [],
        },
      ],
      overage: {
        unitPrice: "",
        currency: "",
        configured: false,
      },
    })
    const view = renderWithQuery(<WhatsAppPricingPage />)
    await waitFor(() => {
      expect(view.getByText(/Quota Credit \(Exhausted\)/i)).toBeInTheDocument()
    })
  })

  it("formats USD currency appropriately for non-IDR rates", async () => {
    mockPricing.mockResolvedValueOnce({
      ok: true,
      devices: [
        {
          deviceId: "device-us",
          phoneNumber: "+14155550100",
          country: "US",
          rateTier: "BASE",
          quotaRemaining: 10,
          categories: [
            {
              category: "MARKETING",
              quotaCredit: "1.50",
              configured: true,
              description: "Marketing template",
              currency: "USD",
              overagePrice: "0.05",
              tierPrices: {
                BASE: "0.05",
                TIER_1: "0.04",
                TIER_2: "0.03",
                TIER_3: "0.02",
              },
            },
          ],
        },
      ],
      overage: {
        unitPrice: "0.05",
        currency: "USD",
        configured: true,
      },
    })
    const view = renderWithQuery(<WhatsAppPricingPage />)
    await waitFor(() => {
      expect(view.getByText("$0.05")).toBeInTheDocument()
      expect(view.getByText("$0.04")).toBeInTheDocument()
    })
  })

  it("formats EUR and GBP currencies appropriately with fractional precision", async () => {
    mockPricing.mockResolvedValueOnce({
      ok: true,
      devices: [
        {
          deviceId: "device-eu",
          phoneNumber: "+4915123456789",
          country: "DE",
          rateTier: "BASE",
          quotaRemaining: 10,
          categories: [
            {
              category: "MARKETING",
              quotaCredit: "1.50",
              configured: true,
              description: "Marketing template",
              currency: "EUR",
              overagePrice: "12.50",
              tierPrices: {
                BASE: "12.50",
                TIER_1: "11.25",
                TIER_2: "10.00",
                TIER_3: "8.75",
              },
            },
          ],
        },
      ],
      overage: {
        unitPrice: "12.50",
        currency: "EUR",
        configured: true,
      },
    })
    const view = renderWithQuery(<WhatsAppPricingPage />)
    await waitFor(() => {
      expect(view.getByText(/12,50\s*€/)).toBeInTheDocument()
      expect(view.getByText(/11,25\s*€/)).toBeInTheDocument()
    })
  })
})
