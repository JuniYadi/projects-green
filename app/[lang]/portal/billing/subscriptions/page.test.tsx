import { describe, expect, it, mock, beforeEach } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import React from "react"
const mockGetAdminSubscriptions = mock<
  (params?: Record<string, unknown>) => Promise<{
    ok: true
    subscriptions: Array<Record<string, unknown>>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => ({
  ok: true,
  subscriptions: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
}))

mock.module("@/lib/billing-client", () => ({
  getAdminSubscriptions: mockGetAdminSubscriptions,
}))

mock.module("@/components/ui/select", () => {
  const options = [
    "all",
    "ACTIVE",
    "SUSPENDED",
    "CANCELLED",
    "APP_HOSTING",
    "VPN",
    "WHATSAPP",
    "MONTHLY",
    "QUARTERLY",
    "SEMI_ANNUAL",
    "ANNUAL",
  ].map((value) => React.createElement("option", { key: value, value }, value))
  const Select = (props: {
    value: string
    onValueChange: (value: string) => void
  }) =>
    React.createElement(
      "select",
      {
        value: props.value,
        role: "combobox",
        onChange: (event: { target: { value: string } }) =>
          props.onValueChange(event.target.value),
      },
      options
    )

  return {
    Select,
    SelectContent: () => null,
    SelectItem: () => null,
    SelectTrigger: () => null,
    SelectValue: () => null,
  }
})

const BillingSubscriptionsPage = (await import("./page")).default

const baseSub = {
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
}

const responseFor = (
  subscriptions: Array<Record<string, unknown>>,
  total = subscriptions.length,
  totalPages = 1
) => ({
  ok: true as const,
  subscriptions,
  pagination: { page: 1, limit: 20, total, totalPages },
})

describe("BillingSubscriptionsPage", () => {
  beforeEach(() => {
    mockGetAdminSubscriptions.mockReset()
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([]))
  })

  it("renders the page heading", () => {
    const view = render(<BillingSubscriptionsPage />)
    expect(view.getByText("Subscriptions")).toBeTruthy()
  })

  it("renders the loading state", () => {
    mockGetAdminSubscriptions.mockImplementation(() => new Promise(() => {}))
    const view = render(<BillingSubscriptionsPage />)
    expect(
      view.container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("renders the error state", async () => {
    mockGetAdminSubscriptions.mockRejectedValue(new Error("Network error"))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() => expect(view.getByText("Network error")).toBeTruthy())
  })

  it("renders the empty state", async () => {
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(
        view.getAllByText("No subscriptions found.").length
      ).toBeGreaterThan(0)
    )
  })

  it("renders a subscription row with org link", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getAllByText("org_1").length).toBeGreaterThan(0)
    )
  })

  it("renders service status badge", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getAllByText("ACTIVE").length).toBeGreaterThan(0)
    )
  })

  it("renders payment status badge for charged order", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getAllByText("Charged").length).toBeGreaterThan(0)
    )
  })

  it("renders invoice status badge", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getAllByText("PAID").length).toBeGreaterThan(0)
    )
  })

  it("filters by status using the server-side filter", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    fireEvent.change(view.getAllByRole("combobox")[0], {
      target: { value: "ACTIVE" },
    })
    await waitFor(() =>
      expect(mockGetAdminSubscriptions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" })
      )
    )
  })

  it("filters by product using client-side filter", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getAllByText("APP_HOSTING").length).toBeGreaterThan(0)
    )
    fireEvent.change(view.getAllByRole("combobox")[1], {
      target: { value: "APP_HOSTING" },
    })
    expect(view.getAllByText("APP_HOSTING").length).toBeGreaterThan(0)
  })

  it("filters by billing period using client-side filter", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getAllByText("APP_HOSTING").length).toBeGreaterThan(0)
    )
    const periodSelect = view.getAllByRole("combobox")[2]
    fireEvent.change(periodSelect, { target: { value: "MONTHLY" } })
    expect((periodSelect as HTMLSelectElement).value).toBe("MONTHLY")
  })

  it("searches by organization id", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub]))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() =>
      expect(view.getAllByText("org_1").length).toBeGreaterThan(0)
    )
    fireEvent.input(view.getByPlaceholderText("Search org, product, plan…"), {
      target: { value: "org_1" },
    })
    expect(view.getAllByText("org_1").length).toBeGreaterThan(0)
  })

  it("shows pagination controls when there are multiple pages", async () => {
    mockGetAdminSubscriptions.mockResolvedValue(responseFor([baseSub], 50, 3))
    const view = render(<BillingSubscriptionsPage />)
    await waitFor(() => expect(view.getByText("Page 1 of 3")).toBeTruthy())
    expect(view.getByText("Previous")).toBeTruthy()
    expect(view.getByText("Next")).toBeTruthy()
  })
})
