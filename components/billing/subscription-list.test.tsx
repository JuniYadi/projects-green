import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import { SubscriptionList } from "./subscription-list"
const mockSubscriptions = [
  {
    id: "sub-1",
    packageCode: "WHATSAPP",
    planCode: "WHATSAPP_STANDARD",
    regionCode: "GLOBAL",
    billingMode: "SUBSCRIPTION",
    type: "STANDARD",
    status: "ACTIVE",
    allocatedConfig: null,
    monthlyRateIdr: "299000.00",
    periodPrice: "299000.00",
    billingPeriod: "MONTHLY",
    currentPeriodEnd: "2026-07-15T00:00:00Z",
    orderId: "ord-1",
    orderStatus: "CHARGED",
    billingInvoiceId: "inv-1",
    invoiceStatus: "PAID",
  },
  {
    id: "sub-2",
    packageCode: "VPN",
    planCode: "VPN_PREMIUM",
    regionCode: "SG",
    billingMode: "SUBSCRIPTION",
    type: "STANDARD",
    status: "SUSPENDED",
    allocatedConfig: null,
    monthlyRateIdr: "50000.00",
    periodPrice: "50000.00",
    billingPeriod: "MONTHLY",
    currentPeriodEnd: "2026-06-01T00:00:00Z",
    orderId: null,
    orderStatus: null,
    billingInvoiceId: null,
    invoiceStatus: null,
  },
  {
    id: "sub-3",
    packageCode: "APP_HOSTING",
    planCode: "APP_STARTER",
    regionCode: "GLOBAL",
    billingMode: "SUBSCRIPTION",
    type: "STANDARD",
    status: "CANCELLED",
    allocatedConfig: null,
    monthlyRateIdr: "150000.00",
    periodPrice: "150000.00",
    billingPeriod: "QUARTERLY",
    currentPeriodEnd: "2026-05-01T00:00:00Z",
    orderId: null,
    orderStatus: null,
    billingInvoiceId: null,
    invoiceStatus: null,
  },
  {
    id: "sub-4",
    packageCode: "WHATSAPP",
    planCode: "WHATSAPP_BUSINESS",
    regionCode: "GLOBAL",
    billingMode: "SUBSCRIPTION",
    type: "BUSINESS",
    status: "ACTIVE",
    allocatedConfig: null,
    monthlyRateIdr: "599000.00",
    periodPrice: "599000.00",
    billingPeriod: "MONTHLY",
    currentPeriodEnd: "2026-08-05T00:00:00Z",
    orderId: "ord-4",
    orderStatus: "CHARGED",
    billingInvoiceId: "inv-4",
    invoiceStatus: "OVERDUE",
  },
]

describe("SubscriptionList", () => {
  it("renders all subscriptions without filters", () => {
    const view = render(<SubscriptionList subscriptions={mockSubscriptions} />)
    expect(view.getAllByText("WHATSAPP").length).toBe(4)
    expect(view.getAllByText("VPN").length).toBe(2)
    expect(view.getAllByText("APP_HOSTING").length).toBe(2)
  })

  it("filters by search term matching packageCode", () => {
    const view = render(<SubscriptionList subscriptions={mockSubscriptions} />)
    const searchInput = view.getByPlaceholderText("Search subscriptions...")
    fireEvent.change(searchInput, { target: { value: "VPN" } })
    fireEvent.input(searchInput, { target: { value: "VPN" } })

    expect(view.getAllByText("VPN").length).toBe(2)
    expect(view.queryByText("APP_HOSTING")).not.toBeInTheDocument()
  })
  it("renders a status filter control", () => {
    const view = render(<SubscriptionList subscriptions={mockSubscriptions} />)
    expect(view.getByRole("combobox")).toBeInTheDocument()
  })

  it("shows empty state when no subscriptions match", () => {
    const view = render(<SubscriptionList subscriptions={[]} />)
    expect(view.getByText("No subscriptions found")).toBeInTheDocument()
  })

  it("shows loading skeleton when isLoading is true", () => {
    const view = render(
      <SubscriptionList subscriptions={[]} isLoading={true} />
    )
    expect(view.queryAllByRole("status")).toHaveLength(0)
    expect(
      view.container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("shows error state with retry button", () => {
    const onRetry = mock(() => {})
    const view = render(
      <SubscriptionList
        subscriptions={[]}
        error="Something went wrong"
        onRetry={onRetry}
      />
    )
    expect(view.getByText("Something went wrong")).toBeInTheDocument()
    expect(view.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  it("renders exact renewal date for ACTIVE subscription", () => {
    const futureSubscription = [
      { ...mockSubscriptions[0], currentPeriodEnd: "2099-07-15T00:00:00Z" },
    ]
    const view = render(<SubscriptionList subscriptions={futureSubscription} />)
    expect(view.getAllByText("Renews on July 15, 2099").length).toBe(2)
  })

  it("renders expired date for past subscription", () => {
    const view = render(<SubscriptionList subscriptions={mockSubscriptions} />)
    expect(view.getAllByText("Expired on June 1, 2026").length).toBe(2)
  })

  it("shows 'Renew now' next action for ACTIVE subscription expiring within 7 days", () => {
    const expiringSoon = [
      {
        ...mockSubscriptions[0],
        currentPeriodEnd: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    ]
    const view = render(<SubscriptionList subscriptions={expiringSoon} />)
    expect(view.getAllByText("Renew now").length).toBe(2)
  })

  it("shows 'Pay invoice' next action for ACTIVE subscription with OVERDUE invoice", () => {
    const overdueSub = [mockSubscriptions[3]]
    const view = render(<SubscriptionList subscriptions={overdueSub} />)
    expect(view.getAllByText("Pay invoice").length).toBe(2)
  })

  it("shows 'Contact support' next action for SUSPENDED subscription", () => {
    const suspendedSub = [mockSubscriptions[1]]
    const view = render(<SubscriptionList subscriptions={suspendedSub} />)
    expect(view.getAllByText("Contact support").length).toBe(2)
  })

  it("shows 'No action needed' for CANCELLED subscription", () => {
    const cancelledSub = [mockSubscriptions[2]]
    const view = render(<SubscriptionList subscriptions={cancelledSub} />)
    expect(view.getAllByText("No action needed").length).toBe(2)
  })

  it("shows status badges with correct text", () => {
    const view = render(<SubscriptionList subscriptions={mockSubscriptions} />)
    expect(view.getAllByText("Active").length).toBe(4)
    expect(view.getAllByText("Suspended").length).toBe(2)
    expect(view.getAllByText("Cancelled").length).toBe(2)
  })
  it("gives subscription statuses semantic labels and icons", () => {
    const view = render(<SubscriptionList subscriptions={mockSubscriptions} />)

    expect(view.getAllByLabelText("Status: Active").length).toBe(4)
    expect(
      view.container.querySelectorAll('[aria-hidden="true"]').length
    ).toBeGreaterThanOrEqual(8)
  })

  it("renders term labels correctly", () => {
    const view = render(<SubscriptionList subscriptions={mockSubscriptions} />)
    expect(view.getAllByText("Monthly").length).toBe(6)
    expect(view.getAllByText("Quarterly").length).toBe(2)
  })
})
