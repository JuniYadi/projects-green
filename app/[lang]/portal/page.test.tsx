import { describe, expect, it, mock } from "bun:test"
import { render, screen } from "@testing-library/react"

import PortalPage from "./page"

const mockGetOverview = mock()

mock.module(
  "@/modules/portal/daily-operations/daily-operations.service",
  () => ({
    dailyOperationsService: {
      getOverview: mockGetOverview,
    },
  })
)

describe("PortalPage", () => {
  it("renders daily operations overview for operators", async () => {
    mockGetOverview.mockResolvedValueOnce({
      generatedAt: new Date().toISOString(),
      actionRequired: [
        {
          key: "paymentsAwaitingConfirmation",
          label: "Payment Confirmation",
          priority: "HIGH",
          count: 2,
          href: "/portal/billing/payments?status=PENDING",
          oldestAt: new Date(Date.now() - 30 * 60000).toISOString(),
          ageMinutes: 30,
          message: "2 payments awaiting confirmation",
          available: true,
        },
      ],
      queueSummary: [
        {
          key: "newOrders",
          label: "New Orders (24h)",
          priority: "INFO",
          count: 5,
          href: "/portal/billing/orders",
          oldestAt: null,
          ageMinutes: null,
          message: "5 new orders",
          available: true,
        },
      ],
      paymentsAwaitingConfirmation: {
        key: "paymentsAwaitingConfirmation",
        label: "Payment Confirmation",
        priority: "HIGH",
        count: 2,
        href: "/portal/billing/payments?status=PENDING",
        oldestAt: new Date(Date.now() - 30 * 60000).toISOString(),
        ageMinutes: 30,
        message: "2 payments awaiting confirmation",
        available: true,
      },
      failedDeployments: {
        key: "failedDeployments",
        label: "Failed Deployments",
        priority: "HIGH",
        count: 0,
        href: "/portal/app",
        oldestAt: null,
        ageMinutes: null,
        message: "Clean queue",
        available: true,
      },
      supportTickets: {
        key: "supportTickets",
        label: "Open Tickets",
        priority: "HIGH",
        count: 0,
        href: "/portal/support-tickets",
        oldestAt: null,
        ageMinutes: null,
        message: "Clean queue",
        available: true,
      },
      overdueInvoices: {
        key: "overdueInvoices",
        label: "Overdue Invoices",
        priority: "HIGH",
        count: 0,
        href: "/portal/billing/invoices",
        oldestAt: null,
        ageMinutes: null,
        message: "Clean queue",
        available: true,
      },
      newOrders: {
        key: "newOrders",
        label: "New Orders (24h)",
        priority: "INFO",
        count: 5,
        href: "/portal/billing/orders",
        oldestAt: null,
        ageMinutes: null,
        message: "5 new orders",
        available: true,
      },
      newInvoices: {
        key: "newInvoices",
        label: "New Invoices (24h)",
        priority: "INFO",
        count: 0,
        href: "/portal/billing/invoices",
        oldestAt: null,
        ageMinutes: null,
        message: "Clean queue",
        available: true,
      },
    })

    const Page = await PortalPage({
      params: Promise.resolve({ lang: "en" }),
    })
    render(Page)

    expect(screen.getByText("Portal — Daily Operations")).toBeInTheDocument()
    expect(screen.getByText("Payment Confirmation")).toBeInTheDocument()
    expect(screen.getByText("New Orders (24h)")).toBeInTheDocument()
  })
})
