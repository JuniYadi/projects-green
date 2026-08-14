import { beforeEach, describe, expect, it, mock } from "bun:test"
import { act, fireEvent, render, waitFor } from "@testing-library/react"

const mockUseAdminSubscriptionsQuery = mock()
const mockUseSearchParams = mock()

mock.module("@/hooks/use-billing-data", () => ({
  useAdminSubscriptionsQuery: mockUseAdminSubscriptionsQuery,
}))
mock.module("next/navigation", () => ({
  useSearchParams: mockUseSearchParams,
}))

const { BillingSubscriptionsPage } = await import("./page")

const baseSubscription = {
  id: "sub_1",
  organizationId: "org_1",
  packageCode: "APP_HOSTING",
  planCode: "STANDARD",
  regionCode: "ID",
  billingMode: "PACKAGE",
  type: "APP_HOSTING",
  status: "ACTIVE",
  allocatedConfig: null,
  monthlyRateIdr: "150000",
  billingPeriod: "MONTHLY",
  periodMonths: 1,
  periodPrice: "150000.00",
  currency: "IDR",
  quantity: "1",
  currentPeriodStart: "2026-01-01T00:00:00.000Z",
  currentPeriodEnd: "2026-02-01T00:00:00.000Z",
  orderId: "ord_1",
  orderStatus: "CHARGED",
  billingInvoiceId: "inv_1",
  invoiceStatus: "PAID",
  fulfillment: null,
  vpnSubscriptionId: null,
}

beforeEach(() => {
  mockUseAdminSubscriptionsQuery.mockReset()
  mockUseSearchParams.mockReset()
  mockUseSearchParams.mockReturnValue(new URLSearchParams())
  mockUseAdminSubscriptionsQuery.mockReturnValue({
    data: {
      ok: true,
      subscriptions: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
    isLoading: false,
    error: null,
  })
})

describe("BillingSubscriptionsPage", () => {
  it("renders the async empty state", async () => {
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getByText("No subscriptions found.")).toBeTruthy()
    )
  })

  it("renders service, payment, invoice, and organization data", async () => {
    mockUseAdminSubscriptionsQuery.mockReturnValueOnce({
      data: {
        ok: true,
        subscriptions: [baseSubscription],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    })
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() => expect(view.getByText("org_1")).toBeTruthy())
    expect(view.getByText("ACTIVE")).toBeTruthy()
    expect(view.getByText("Charged")).toBeTruthy()
    expect(view.getByText("PAID")).toBeTruthy()
  })

  it("links only related VPN subscriptions to VPN operations", async () => {
    mockUseAdminSubscriptionsQuery.mockReturnValueOnce({
      data: {
        ok: true,
        subscriptions: [
          {
            ...baseSubscription,
            packageCode: "VPN",
            vpnSubscriptionId: "vpn_1",
          },
          baseSubscription,
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    })
    const view = render(<BillingSubscriptionsPage />)

    const links = await view.findAllByRole("link", {
      name: "Open VPN operations",
    })
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute("href")).toBe(
      "/portal/vpn/subscriptions/vpn_1"
    )
  })

  it("opens the commercial record targeted by a VPN handoff", async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({ subscriptionId: "sub_1" })
    )
    mockUseAdminSubscriptionsQuery.mockReturnValueOnce({
      data: {
        ok: true,
        subscriptions: [baseSubscription],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    })

    const view = render(<BillingSubscriptionsPage />)

    await waitFor(() =>
      expect(
        view.getByRole("dialog", { name: "Subscription detail drawer" })
      ).toBeTruthy()
    )
    expect(view.getByText("sub_1")).toBeTruthy()
  })
  it("opens a lifecycle detail drawer for a selected subscription", async () => {
    mockUseAdminSubscriptionsQuery.mockReturnValueOnce({
      data: {
        ok: true,
        subscriptions: [{ ...baseSubscription, cancelAtPeriodEnd: true }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    })
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() => expect(view.getByText("org_1")).toBeTruthy())

    await act(async () => {
      fireEvent.click(view.getAllByText("APP_HOSTING")[0])
    })
    expect(
      view.getByRole("dialog", { name: "Subscription detail drawer" })
    ).toBeTruthy()
    expect(view.getByText(/cancellation scheduled/i)).toBeTruthy()
  })
  it("exposes search and lifecycle filters", async () => {
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(
        view.getByPlaceholderText("Search org, product, plan…")
      ).toBeTruthy()
    )
    expect(view.getByText("All statuses")).toBeTruthy()
    expect(view.getByText("All products")).toBeTruthy()
    expect(view.getByText("All periods")).toBeTruthy()
  })

  it("shows pagination when multiple pages exist", async () => {
    mockUseAdminSubscriptionsQuery.mockReturnValueOnce({
      data: {
        ok: true,
        subscriptions: [baseSubscription],
        pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
      },
      isLoading: false,
      error: null,
    })
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() => expect(view.getByText("Page 1 of 3")).toBeTruthy())
    expect(view.getByText("Next")).toBeTruthy()
  })
})
