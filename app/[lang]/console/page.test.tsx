import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import React from "react"

// Mock next/navigation
let mockParams = { lang: "en" }
mock.module("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mock() }),
  usePathname: () => "/en/console",
}))

// Mock phosphor icons to avoid rendering heavy SVG
mock.module("@/components/ui/phosphor-icons", () => ({
  ReceiptIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-receipt" {...props} />
  ),
  LifebuoyIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-lifebuoy" {...props} />
  ),
  SquaresFourIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-squares" {...props} />
  ),
  MegaphoneSimpleIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-megaphone" {...props} />
  ),
  ArrowRightIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow-right" {...props} />
  ),
  CheckCircleIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
  WarningCircleIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-warning" {...props} />
  ),
  ClockIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-clock" {...props} />
  ),
  PlusIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-plus" {...props} />
  ),
  BookOpenIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-book" {...props} />
  ),
  ShieldCheckIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-shield" {...props} />
  ),
  RocketLaunchIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-rocket" {...props} />
  ),
  WhatsappLogoIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-whatsapp" {...props} />
  ),
}))

const mockInvoicesGet = mock()
const mockSubscriptionsGet = mock()
const mockSupportTicketsGet = mock()

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      billing: {
        invoices: {
          get: mockInvoicesGet,
        },
        subscriptions: {
          get: mockSubscriptionsGet,
        },
      },
      "support-tickets": {
        get: mockSupportTicketsGet,
      },
    },
  },
}))

import ConsolePage from "@/app/[lang]/console/page"

describe("ConsolePage Actionable Overview", () => {
  beforeEach(() => {
    mockParams = { lang: "en" }
    mockInvoicesGet.mockReset()
    mockSubscriptionsGet.mockReset()
    mockSupportTicketsGet.mockReset()
  })
  it("renders loading state with skeletons initially", () => {
    mockInvoicesGet.mockReturnValue(Promise.withResolvers().promise)
    mockSubscriptionsGet.mockReturnValue(Promise.withResolvers().promise)
    mockSupportTicketsGet.mockReturnValue(Promise.withResolvers().promise)

    const { container } = render(<ConsolePage />)
    expect(screen.getByText("Console")).toBeInTheDocument()
    expect(
      screen.getByText("Overview of your organization billing and activity.")
    ).toBeInTheDocument()
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0
    )
  })

  it("renders populated invoice, active services, tickets, and operational announcements", async () => {
    mockInvoicesGet.mockResolvedValue({
      data: {
        ok: true,
        invoices: [
          {
            id: "inv_123",
            invoiceNumber: "INV-2026-001",
            status: "OPEN",
            totalAmountIdr: "150000.00",
            currency: "IDR",
            issuedAt: "2026-08-01T00:00:00.000Z",
            dueAt: "2026-08-30T00:00:00.000Z",
            paymentUrl: "https://payment.example/pay/inv_123",
          },
        ],
      },
    })

    mockSubscriptionsGet.mockResolvedValue({
      data: {
        ok: true,
        subscriptions: [
          {
            id: "sub_1",
            packageCode: "WHATSAPP-PRO",
            planCode: "MONTHLY",
            status: "ACTIVE",
            currentPeriodEnd: "2026-09-01T00:00:00.000Z",
          },
          {
            id: "sub_2",
            packageCode: "APP_HOSTING",
            planCode: "STARTER",
            status: "ACTIVE",
            currentPeriodEnd: "2026-09-15T00:00:00.000Z",
          },
          {
            id: "sub_3",
            packageCode: "VPN",
            planCode: "STANDARD",
            status: "ACTIVE",
            currentPeriodEnd: "2026-09-20T00:00:00.000Z",
          },
        ],
      },
    })

    mockSupportTicketsGet.mockResolvedValue({
      data: {
        ok: true,
        tickets: [
          {
            id: "tick_1",
            subject: "Domain setup question",
            status: "open",
            priority: "high",
            updatedAt: "2026-08-25T10:00:00.000Z",
          },
        ],
      },
    })

    render(<ConsolePage />)

    await waitFor(() => {
      expect(screen.getByText("#INV-2026-001")).toBeInTheDocument()
    })
    // Services card assertions - categorized by product lines
    expect(screen.getByText("Active Services")).toBeInTheDocument()
    expect(screen.getByText("3 active service(s)")).toBeInTheDocument()
    expect(screen.getByText("WhatsApp Gateway")).toBeInTheDocument()
    expect(screen.getByText("App Hosting")).toBeInTheDocument()
    expect(screen.getByText("Secure VPN")).toBeInTheDocument()
    expect(screen.getByText("WHATSAPP-PRO • MONTHLY")).toBeInTheDocument()
    expect(screen.getByText("APP_HOSTING • STARTER")).toBeInTheDocument()
    expect(screen.getByText("VPN • STANDARD")).toBeInTheDocument()

    // Support card assertions
    expect(screen.getByText("Support & Help")).toBeInTheDocument()
    expect(screen.getByText("Domain setup question")).toBeInTheDocument()
    expect(screen.getByText("1 open ticket(s)")).toBeInTheDocument()

    // Announcements card assertions
    expect(screen.getByText("Announcements & Updates")).toBeInTheDocument()
    expect(screen.getByText("Platform operational")).toBeInTheDocument()
    expect(screen.getByText("Operational")).toBeInTheDocument()
  })

  it("renders empty states when no data is available", async () => {
    mockInvoicesGet.mockResolvedValue({
      data: {
        ok: true,
        invoices: [],
      },
    })

    mockSubscriptionsGet.mockResolvedValue({
      data: {
        ok: true,
        subscriptions: [],
      },
    })

    mockSupportTicketsGet.mockResolvedValue({
      data: {
        ok: true,
        tickets: [],
      },
    })

    render(<ConsolePage />)

    await waitFor(() => {
      expect(screen.getByText("No invoices issued yet")).toBeInTheDocument()
    })

    expect(screen.getByText("No active services yet")).toBeInTheDocument()
    expect(screen.getByText("No active tickets")).toBeInTheDocument()
    expect(screen.getByText("All systems normal")).toBeInTheDocument()
  })

  it("renders Indonesian copy correctly when locale is 'id'", async () => {
    mockParams = { lang: "id" }

    mockInvoicesGet.mockResolvedValue({
      data: {
        ok: true,
        invoices: [],
      },
    })

    mockSubscriptionsGet.mockResolvedValue({
      data: {
        ok: true,
        subscriptions: [],
      },
    })

    mockSupportTicketsGet.mockResolvedValue({
      data: {
        ok: true,
        tickets: [],
      },
    })

    render(<ConsolePage />)

    await waitFor(() => {
      expect(screen.getByText("Invoice Terbaru")).toBeInTheDocument()
    })

    expect(screen.getByText("Konsol")).toBeInTheDocument()
    expect(screen.getByText("Layanan Aktif")).toBeInTheDocument()
    expect(screen.getByText("Dukungan & Bantuan")).toBeInTheDocument()
    expect(screen.getByText("Informasi & Pembaruan")).toBeInTheDocument()
    expect(screen.getByText("Beroperasi")).toBeInTheDocument()
    expect(screen.getByText("Belum ada invoice")).toBeInTheDocument()
    expect(screen.getByText("Belum ada layanan aktif")).toBeInTheDocument()
    expect(screen.getByText("Tidak ada tiket aktif")).toBeInTheDocument()
  })

  it("handles errors gracefully with error states", async () => {
    mockInvoicesGet.mockRejectedValue(new Error("Network failure"))
    mockSubscriptionsGet.mockRejectedValue(new Error("Network failure"))
    mockSupportTicketsGet.mockRejectedValue(new Error("Network failure"))

    render(<ConsolePage />)

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load invoice information.")
      ).toBeInTheDocument()
    })

    expect(
      screen.getByText("Unable to load active services.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Unable to load support tickets.")
    ).toBeInTheDocument()
  })
})
