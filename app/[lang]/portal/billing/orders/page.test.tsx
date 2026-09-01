import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockGetAdminOrders = mock()
const mockCancelAdminOrder = mock()
const mockFulfillAdminOrder = mock()

mock.module("@/lib/billing-client", () => ({
  getAdminOrders: mockGetAdminOrders,
  cancelAdminOrder: mockCancelAdminOrder,
  fulfillAdminOrder: mockFulfillAdminOrder,
  billingPeriodLabel: (period: string) => period,
}))

const { BillingOrdersPage } = await import("./page")

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
  subscription: null,
  invoice: {
    id: "inv_1",
    invoiceNumber: "INV-001",
    status: "PAID",
    paidAt: "2026-01-01T00:00:00.000Z",
  },
}

const emptyResult = {
  ok: true as const,
  orders: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
}

beforeEach(() => {
  mockGetAdminOrders.mockReset()
  mockCancelAdminOrder.mockReset()
  mockFulfillAdminOrder.mockReset()
  mockGetAdminOrders.mockResolvedValue(emptyResult)
  mockCancelAdminOrder.mockResolvedValue({ ok: true, data: {} })
  mockFulfillAdminOrder.mockResolvedValue({ ok: true, data: {} })
})

describe("BillingOrdersPage", () => {
  it("renders an async empty state", async () => {
    const view = render(<BillingOrdersPage />)
    await waitFor(() => expect(view.getByText("No orders found.")).toBeTruthy())
  })

  it("renders order and charge data", async () => {
    mockGetAdminOrders.mockResolvedValueOnce({
      ok: true,
      orders: [baseOrder],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    const view = render(<BillingOrdersPage />)
    await waitFor(() => expect(view.getByText("APP_HOSTING")).toBeTruthy())
    expect(view.getByText("STANDARD")).toBeTruthy()
    expect(view.getByText("CHARGED")).toBeTruthy()
  })

  it("shows filter controls", async () => {
    const view = render(<BillingOrdersPage />)
    await waitFor(() => expect(view.getByText("Status")).toBeTruthy())
    expect(view.getByText("Product")).toBeTruthy()
    expect(view.getByText("Billing Period")).toBeTruthy()
    expect(view.getByPlaceholderText("Package code…")).toBeTruthy()
  })

  it("shows CSV export and pagination controls", async () => {
    mockGetAdminOrders.mockResolvedValueOnce({
      ok: true,
      orders: [baseOrder],
      pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
    })
    const view = render(<BillingOrdersPage />)
    await waitFor(() => expect(view.getByText("Export CSV")).toBeTruthy())
    expect(view.getByText("Page 1 of 3")).toBeTruthy()
    expect(view.getByText("Next")).toBeTruthy()
  })
})
