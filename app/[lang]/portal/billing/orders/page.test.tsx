import { describe, expect, it, mock, beforeEach } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import React from "react"
const mockGetAdminOrders = mock<
  (params?: Record<string, unknown>) => Promise<{
    ok: true
    orders: Array<Record<string, unknown>>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => ({
  ok: true,
  orders: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
}))

mock.module("@/lib/billing-client", () => ({
  getAdminOrders: mockGetAdminOrders,
  billingPeriodLabel: (period: string) => period,
}))

mock.module("@/components/ui/select", () => {
  const options = [
    "",
    "PENDING",
    "CHARGED",
    "FULFILLED",
    "FAILED",
    "CANCELLED",
    "MONTHLY",
    "QUARTERLY",
    "SEMI_ANNUAL",
    "ANNUAL",
  ].map((value) =>
    React.createElement(
      "option",
      { key: value || "all", value },
      value || "All"
    )
  )
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

const BillingOrdersPage = (await import("./page")).default

const baseOrder = {
  id: "ord_1",
  organizationId: "org_1",
  billingAccountId: "ba_1",
  serviceSubscriptionId: "sub_1",
  billingInvoiceId: "inv_1",
  status: "CHARGED",
  currency: "IDR",
  subtotalAmount: "150000.00",
  totalAmount: "150000.00",
  idempotencyKey: "key_1",
  chargedAt: "2026-01-01T00:00:00.000Z",
  fulfilledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  line: {
    id: "line_1",
    pricingId: "pricing_1",
    packageCode: "APP_HOSTING",
    planCode: "STANDARD",
    regionCode: "ID",
    billingPeriod: "MONTHLY",
    chargeUnit: "SUBSCRIPTION",
    quantity: "1",
    unitPrice: "150000.00",
    amount: "150000.00",
    currency: "IDR",
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-02-01T00:00:00.000Z",
  },
  subscription: {
    id: "sub_1",
    status: "ACTIVE",
    packageCode: "APP_HOSTING",
    planCode: "STANDARD",
    currentPeriodStart: "2026-01-01T00:00:00.000Z",
    currentPeriodEnd: "2026-02-01T00:00:00.000Z",
  },
  invoice: {
    id: "inv_1",
    invoiceNumber: "INV-001",
    status: "PAID",
    paidAt: "2026-01-01T00:00:00.000Z",
  },
}

const responseFor = (
  orders: Array<Record<string, unknown>>,
  total = orders.length,
  totalPages = 1
) => ({
  ok: true as const,
  orders,
  pagination: { page: 1, limit: 50, total, totalPages },
})

describe("BillingOrdersPage", () => {
  beforeEach(() => {
    mockGetAdminOrders.mockReset()
    mockGetAdminOrders.mockResolvedValue(responseFor([]))
  })

  it("renders the page heading", () => {
    const view = render(<BillingOrdersPage />)
    expect(view.getByText("Orders")).toBeTruthy()
  })

  it("renders the loading state", () => {
    mockGetAdminOrders.mockImplementation(() => new Promise(() => {}))
    const view = render(<BillingOrdersPage />)
    expect(view.getByText("Loading orders…")).toBeTruthy()
  })

  it("renders the error state", async () => {
    mockGetAdminOrders.mockRejectedValue(new Error("Network error"))
    const view = render(<BillingOrdersPage />)
    await waitFor(() => expect(view.getByText("Network error")).toBeTruthy())
  })

  it("renders the empty state", async () => {
    const view = render(<BillingOrdersPage />)
    await waitFor(() =>
      expect(view.getAllByText("No orders found.").length).toBeGreaterThan(0)
    )
  })

  it("renders an order row with product and amount", async () => {
    mockGetAdminOrders.mockResolvedValue(responseFor([baseOrder]))
    const view = render(<BillingOrdersPage />)
    await waitFor(() => {
      expect(view.getAllByText("APP_HOSTING").length).toBeGreaterThan(0)
      expect(view.getAllByText("STANDARD").length).toBeGreaterThan(0)
    })
  })

  it("renders charge, fulfillment, and invoice status", async () => {
    mockGetAdminOrders.mockResolvedValue(responseFor([baseOrder]))
    const view = render(<BillingOrdersPage />)
    await waitFor(() =>
      expect(view.getAllByText("APP_HOSTING").length).toBeGreaterThan(0)
    )
    expect(view.queryAllByText("CHARGED").length).toBeGreaterThan(0)
    expect(view.getByText(/Pending/)).toBeTruthy()
    expect(view.getByText(/INV-001/)).toBeTruthy()
    expect(view.getByText(/PAID/)).toBeTruthy()
  })

  it("has visible filter controls and CSV export", () => {
    const view = render(<BillingOrdersPage />)
    expect(view.getByPlaceholderText("Package code")).toBeTruthy()
    expect(view.getAllByRole("combobox")).toHaveLength(2)
    expect(view.getByRole("button", { name: "Export CSV" })).toBeTruthy()
    expect(view.container.querySelectorAll('input[type="date"]')).toHaveLength(
      2
    )
  })

  it("shows pagination controls when there are multiple pages", async () => {
    mockGetAdminOrders.mockResolvedValue(responseFor([baseOrder], 50, 3))
    const view = render(<BillingOrdersPage />)
    await waitFor(() => expect(view.getByText(/50 total orders/)).toBeTruthy())
    expect(view.getByText(/1 of 3/)).toBeTruthy()
    expect(view.getByText("Previous")).toBeTruthy()
    expect(view.getByText("Next")).toBeTruthy()
  })

  it("applies status filter to API call", async () => {
    mockGetAdminOrders.mockResolvedValue(responseFor([baseOrder]))
    const view = render(<BillingOrdersPage />)
    fireEvent.change(view.getAllByRole("combobox")[0], {
      target: { value: "FULFILLED" },
    })
    await waitFor(() =>
      expect(mockGetAdminOrders).toHaveBeenCalledWith(
        expect.objectContaining({ status: "FULFILLED" })
      )
    )
  })

  it("applies package code filter to API call", async () => {
    mockGetAdminOrders.mockResolvedValue(responseFor([baseOrder]))
    const view = render(<BillingOrdersPage />)
    fireEvent.change(view.getByPlaceholderText("Package code"), {
      target: { value: "APP_HOSTING" },
    })
    fireEvent.input(view.getByPlaceholderText("Package code"), {
      target: { value: "APP_HOSTING" },
    })
    await waitFor(() =>
      expect(mockGetAdminOrders).toHaveBeenCalledWith(
        expect.objectContaining({ packageCode: "APP_HOSTING" })
      )
    )
  })

  it("applies billing period filter to API call", async () => {
    mockGetAdminOrders.mockResolvedValue(responseFor([baseOrder]))
    const view = render(<BillingOrdersPage />)
    fireEvent.change(view.getAllByRole("combobox")[1], {
      target: { value: "QUARTERLY" },
    })
    await waitFor(() =>
      expect(mockGetAdminOrders).toHaveBeenCalledWith(
        expect.objectContaining({ billingPeriod: "QUARTERLY" })
      )
    )
  })

  it("applies date range filters to API call", async () => {
    mockGetAdminOrders.mockResolvedValue(responseFor([baseOrder]))
    const view = render(<BillingOrdersPage />)
    const dateInputs = view.container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: "2026-01-01" } })
    fireEvent.input(dateInputs[0], { target: { value: "2026-01-01" } })
    fireEvent.change(dateInputs[1], { target: { value: "2026-12-31" } })
    fireEvent.input(dateInputs[1], { target: { value: "2026-12-31" } })
    await waitFor(() =>
      expect(mockGetAdminOrders).toHaveBeenCalledWith(
        expect.objectContaining({ from: "2026-01-01", to: "2026-12-31" })
      )
    )
  })
})
