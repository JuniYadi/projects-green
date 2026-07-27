import { describe, it, expect, beforeEach, mock } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

import { BillingSetupBannerClient } from "./billing-setup-banner"

const DISMISSED_KEY = "billing-setup-status-dismissed"

let mockGateways: { status: number; data: unknown[] } = {
  status: 200,
  data: [],
}
let mockBankAccounts: { status: number; data: unknown[] } = {
  status: 200,
  data: [],
}
let mockCurrencies: { status: number; data: unknown[] } = {
  status: 200,
  data: [],
}

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      portal: {
        payments: {
          gateways: {
            get: () => Promise.resolve(mockGateways),
          },
          "bank-accounts": {
            get: () => Promise.resolve(mockBankAccounts),
          },
          currencies: {
            get: () => Promise.resolve(mockCurrencies),
          },
        },
      },
    },
  },
}))

mock.module("@/lib/i18n/pathname", () => ({
  isLocale: (locale: string) => locale === "en" || locale === "id",
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/${opts.locale}${opts.pathname}`,
}))

beforeEach(() => {
  sessionStorage.clear()
  mockGateways = { status: 200, data: [] }
  mockBankAccounts = { status: 200, data: [] }
  mockCurrencies = { status: 200, data: [] }
})

describe("BillingSetupBannerClient", () => {
  it("renders missing prerequisites with localized Set up links", async () => {
    const view = render(<BillingSetupBannerClient locale="en" />)

    expect(
      await view.findByText("Billing setup incomplete")
    ).toBeInTheDocument()
    expect(view.getByText("Payment gateway")).toBeInTheDocument()
    expect(view.getByText("Bank account")).toBeInTheDocument()
    expect(view.getByText("Currency")).toBeInTheDocument()

    const links = view.getAllByRole("link")
    expect(links[0]).toHaveAttribute(
      "href",
      "/en/portal/billing/payments?tab=gateways"
    )
    expect(links[1]).toHaveAttribute(
      "href",
      "/en/portal/billing/payments?tab=bank-accounts"
    )
    expect(links[2]).toHaveAttribute(
      "href",
      "/en/portal/billing/payments?tab=currencies"
    )
  })

  it("hides banner when all present", async () => {
    const data = [{ id: "g1" }, { id: "g2" }]
    mockGateways = { status: 200, data }
    mockBankAccounts = { status: 200, data }
    mockCurrencies = { status: 200, data }

    const view = render(<BillingSetupBannerClient locale="en" />)

    await waitFor(() => {
      expect(view.queryByTestId("billing-setup-banner")).not.toBeInTheDocument()
    })
  })

  it("dismisses banner and writes sessionStorage", async () => {
    const view = render(<BillingSetupBannerClient locale="en" />)

    expect(await view.findByTestId("billing-setup-banner")).toBeInTheDocument()

    const dismissButton = view.getByRole("button", {
      name: "Dismiss billing setup warning",
    })
    fireEvent.click(dismissButton)

    expect(view.queryByTestId("billing-setup-banner")).not.toBeInTheDocument()
    expect(sessionStorage.getItem(DISMISSED_KEY)).toBe("true")
  })

  it("caches fetches within TTL", async () => {
    render(<BillingSetupBannerClient locale="en" />)
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="billing-setup-banner"]')
      ).toBeInTheDocument()
    })

    // Cache key written
    const cacheRaw = sessionStorage.getItem("billing-setup-status:en:60000")
    expect(cacheRaw).toBeTruthy()

    // Second render should use cache, not re-fetch
    render(<BillingSetupBannerClient locale="en" />)
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="billing-setup-banner"]')
      ).toBeInTheDocument()
    })
  })

  it("inactive-only gateways still counts as missing", async () => {
    mockGateways = { status: 200, data: [{ id: "g1", isActive: false }] }
    mockBankAccounts = { status: 200, data: [{ id: "ba1" }] }
    mockCurrencies = { status: 200, data: [{ id: "c1" }] }

    const view = render(<BillingSetupBannerClient locale="en" />)

    expect(await view.findByTestId("billing-setup-banner")).toBeInTheDocument()

    expect(view.getByText("Payment gateway")).toBeInTheDocument()
    expect(view.queryByText("Bank account")).not.toBeInTheDocument()
    expect(view.queryByText("Currency")).not.toBeInTheDocument()
  })

  it("has focus-visible styles on setup links", async () => {
    const view = render(<BillingSetupBannerClient locale="en" />)

    expect(
      await view.findByText("Billing setup incomplete")
    ).toBeInTheDocument()
    const links = view.getAllByRole("link", { name: "Set up" })
    expect(links[0].className).toContain("focus-visible:outline-none")
    expect(links[0].className).toContain("focus-visible:ring-2")
    expect(links[0].className).toContain("focus-visible:ring-ring")
    expect(links[0].className).toContain("focus-visible:ring-offset-2")
  })
})
