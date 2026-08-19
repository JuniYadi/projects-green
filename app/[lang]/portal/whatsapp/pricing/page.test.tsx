if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

import "@/test/register"
import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const mockRatesGet = mock(async () => ({
  data: {
    ok: true,
    quotaRates: [
      {
        id: "quota-id",
        category: "MARKETING",
        country: "ID",
        quotaCredit: "1.5",
        description: "Indonesia marketing",
        effectiveFrom: "2025-01-01T00:00:00.000Z",
        effectiveTo: null,
        isActive: true,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "quota-us",
        category: "UTILITY",
        country: "US",
        quotaCredit: "2",
        description: null,
        effectiveFrom: "2025-01-01T00:00:00.000Z",
        effectiveTo: null,
        isActive: true,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ],
    basePrices: [
      {
        id: "base-id",
        category: "MARKETING",
        country: "ID",
        basePrice: "100",
        metaCost: null,
        currency: "IDR",
        effectiveFrom: "2025-01-01T00:00:00.000Z",
        effectiveTo: null,
        isActive: true,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "base-us",
        category: "UTILITY",
        country: "US",
        basePrice: "200",
        metaCost: "50",
        currency: "IDR",
        effectiveFrom: "2025-01-01T00:00:00.000Z",
        effectiveTo: null,
        isActive: true,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ],
  },
  error: null,
}))
const mockQuotaRatePost = mock(async (_payload: unknown) => ({
  data: { ok: true },
  error: null,
}))
const mockBasePricePost = mock(async (_payload: unknown) => ({
  data: { ok: true },
  error: null,
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        whatsapp: {
          pricing: {
            rates: { get: mockRatesGet },
            "quota-rate": { post: mockQuotaRatePost },
            "base-price": { post: mockBasePricePost },
          },
        },
      },
    },
  },
}))

import WhatsAppPricingPage from "./page"

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <WhatsAppPricingPage />
    </QueryClientProvider>
  )
}

describe("PortalWhatsappPricingPage", () => {
  beforeEach(() => {
    cleanup()
    mockRatesGet.mockClear()
    mockQuotaRatePost.mockClear()
    mockBasePricePost.mockClear()
  })

  it("renders overview cards and both pricing tables", async () => {
    const view = renderPage()

    expect(
      view.getByRole("heading", { name: "WhatsApp Pricing & Quota Matrix" })
    ).toBeInTheDocument()
    expect(view.getByText("Base Allowance")).toBeInTheDocument()
    expect(view.getByText("Tax & Margins")).toBeInTheDocument()

    await waitFor(() => {
      expect(
        view.getByText("Category Quota Deductions (Quota Mode)")
      ).toBeInTheDocument()
      expect(
        view.getByText("PAYG Base Prices & Tier Matrix")
      ).toBeInTheDocument()
      expect(view.getAllByText("ID").length).toBeGreaterThan(0)
    })
  })

  it("filters both tables by country and category", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(view.getByText("-1.5 credits")).toBeInTheDocument()
    )

    // Country select
    const countryCombobox = view.getByRole("combobox", { name: "Country" })
    await act(async () => {
      fireEvent.click(countryCombobox)
    })

    const usOption = Array.from(
      document.body.querySelectorAll('[role="option"]')
    ).find((o) => o.textContent?.trim() === "US")
    expect(usOption).toBeDefined()
    await act(async () => {
      fireEvent.click(usOption!)
    })

    await waitFor(() => {
      expect(view.getAllByText("US").length).toBeGreaterThan(0)
      expect(view.queryByText("Indonesia marketing")).not.toBeInTheDocument()
      expect(view.queryByText("Rp 100")).not.toBeInTheDocument()
    })

    // Category select
    const categoryCombobox = view.getByRole("combobox", { name: "Category" })
    await act(async () => {
      fireEvent.click(categoryCombobox)
    })
    const utilityOption = Array.from(
      document.body.querySelectorAll('[role="option"]')
    ).find((o) => o.textContent?.trim() === "UTILITY")
    expect(utilityOption).toBeDefined()
    await act(async () => {
      fireEvent.click(utilityOption!)
    })

    expect(view.getByText("Rp 200")).toBeInTheDocument()
    expect(view.queryByText("Rp 100")).not.toBeInTheDocument()
  })

  it("opens the quota dialog and submits a validated quota rate", async () => {
    const user = userEvent.setup()
    const view = renderPage()
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Add Quota Rate" })).toBeEnabled()
    )

    await user.click(view.getByRole("button", { name: "Add Quota Rate" }))
    expect(
      view.getByRole("heading", { name: "Add Quota Rate" })
    ).toBeInTheDocument()

    await user.type(view.getByRole("textbox", { name: "Country" }), "SG")
    const categorySelect = view.getByRole("combobox", {
      name: "Quota category",
    })
    await act(async () => {
      fireEvent.click(categorySelect)
    })
    const authOption = Array.from(
      document.body.querySelectorAll('[role="option"]')
    ).find((o) => o.textContent?.trim() === "AUTHENTICATION")
    expect(authOption).toBeDefined()
    await act(async () => {
      fireEvent.click(authOption!)
    })
    await user.type(view.getByLabelText("Quota Credit deduction"), "3")
    await user.type(view.getByLabelText("Effective From"), "2026-08-19")
    await user.type(
      view.getByLabelText("Description (optional)"),
      "Singapore auth"
    )
    await user.click(view.getByRole("button", { name: "Save Quota Rate" }))

    await waitFor(() =>
      expect(mockQuotaRatePost).toHaveBeenCalledWith({
        category: "AUTHENTICATION",
        country: "SG",
        quotaCredit: 3,
        description: "Singapore auth",
        effectiveFrom: "2026-08-19",
      })
    )
    await waitFor(() =>
      expect(
        view.queryByRole("heading", { name: "Add Quota Rate" })
      ).not.toBeInTheDocument()
    )
  })

  it("opens the base price dialog and submits optional meta cost", async () => {
    const user = userEvent.setup()
    const view = renderPage()
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Add Base Price" })).toBeEnabled()
    )

    await user.click(view.getByRole("button", { name: "Add Base Price" }))
    expect(
      view.getByRole("heading", { name: "Add Base Price" })
    ).toBeInTheDocument()
    await user.type(view.getByRole("textbox", { name: "Country" }), "MY")
    const bpCategorySelect = view.getByRole("combobox", {
      name: "Base price category",
    })
    await act(async () => {
      fireEvent.click(bpCategorySelect)
    })
    const serviceOption = Array.from(
      document.body.querySelectorAll('[role="option"]')
    ).find((o) => o.textContent?.trim() === "SERVICE")
    expect(serviceOption).toBeDefined()
    await act(async () => {
      fireEvent.click(serviceOption!)
    })
    await user.type(view.getByLabelText("Base Price"), "500")
    await user.type(view.getByLabelText("Meta Cost (optional)"), "75")
    await user.type(view.getByLabelText("Effective From"), "2026-08-20")
    await user.click(view.getByRole("button", { name: "Save Base Price" }))

    await waitFor(() =>
      expect(mockBasePricePost).toHaveBeenCalledWith({
        category: "SERVICE",
        country: "MY",
        basePrice: 500,
        metaCost: 75,
        currency: "IDR",
        effectiveFrom: "2026-08-20",
      })
    )
  })
  it("rejects invalid quota form values before mutating", async () => {
    const user = userEvent.setup()
    const view = renderPage()
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Add Quota Rate" })).toBeEnabled()
    )
    await user.click(view.getByRole("button", { name: "Add Quota Rate" }))
    await user.type(view.getByRole("textbox", { name: "Country" }), "I")
    await user.click(view.getByRole("button", { name: "Save Quota Rate" }))
    expect(mockQuotaRatePost).not.toHaveBeenCalled()
    expect(view.getByRole("alert")).toHaveTextContent(
      "Country must be a two-letter ISO code"
    )
  })
})
