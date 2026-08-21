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
        categories: [
          {
            category: "MARKETING",
            quotaCredit: "1.50",
            configured: true,
          },
          {
            category: "UTILITY",
            quotaCredit: "1.00",
            configured: false,
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
      expect(view.getByText("MARKETING")).toBeInTheDocument()
      expect(view.getByText("UTILITY")).toBeInTheDocument()
    })
  })
})
