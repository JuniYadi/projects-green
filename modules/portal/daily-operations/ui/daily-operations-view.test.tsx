import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type {
  DailyOperationsDTO,
  DailyOperationsMetricDTO,
} from "../daily-operations.dto"
import { DailyOperationsView } from "./daily-operations-view"

const metric = (
  overrides: Partial<DailyOperationsMetricDTO> &
    Pick<DailyOperationsMetricDTO, "key" | "label" | "href">
): DailyOperationsMetricDTO => ({
  priority: "HIGH",
  count: 0,
  oldestAt: null,
  ageMinutes: null,
  message: "Antrean bersih",
  available: true,
  ...overrides,
})

const overview: DailyOperationsDTO = {
  generatedAt: "2026-08-31T12:00:00.000Z",
  actionRequired: [
    metric({
      key: "payments-awaiting-confirmation",
      label: "Pembayaran menunggu konfirmasi",
      href: "/portal/billing/payments?status=PENDING",
      count: 2,
      ageMinutes: 90,
      oldestAt: "2026-08-31T10:30:00.000Z",
      message: "2 pembayaran menunggu konfirmasi",
    }),
    metric({
      key: "failed-or-building-deployments",
      label: "Deployment gagal atau sedang dibangun",
      href: "/portal/app/clusters",
    }),
    metric({
      key: "support-tickets-needing-response",
      label: "Tiket dukungan menunggu respons",
      href: "/portal/support-tickets?status=OPEN",
      count: 1,
      ageMinutes: 5,
      oldestAt: "2026-08-31T11:55:00.000Z",
      message: "1 tiket menunggu respons",
    }),
    metric({
      key: "overdue-or-open-invoices",
      label: "Invoice terbuka atau jatuh tempo",
      href: "/portal/billing/invoices?status=OVERDUE",
      available: false,
      message: "Antrean ini tidak dapat dimuat",
    }),
  ],
  queueSummary: [
    metric({
      key: "new-orders",
      label: "order baru dalam 24 jam",
      href: "/portal/billing/orders",
      priority: "INFO",
      count: 3,
      message: "3 order baru",
    }),
    metric({
      key: "new-invoices",
      label: "invoice baru dalam 24 jam",
      href: "/portal/billing/invoices",
      priority: "INFO",
    }),
  ],
  paymentsAwaitingConfirmation: {} as DailyOperationsMetricDTO,
  failedDeployments: {} as DailyOperationsMetricDTO,
  supportTickets: {} as DailyOperationsMetricDTO,
  overdueInvoices: {} as DailyOperationsMetricDTO,
  newOrders: {} as DailyOperationsMetricDTO,
  newInvoices: {} as DailyOperationsMetricDTO,
}

describe("DailyOperationsView", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders action queues, clean state, age, and direct localized CTAs", () => {
    render(
      <DailyOperationsView
        overview={overview}
        locale="id"
        localizedHrefs={{
          "payments-awaiting-confirmation":
            "/id/portal/billing/payments?status=PENDING",
          "failed-or-building-deployments": "/id/portal/app/clusters",
          "support-tickets-needing-response":
            "/id/portal/support-tickets?status=OPEN",
          "overdue-or-open-invoices":
            "/id/portal/billing/invoices?status=OVERDUE",
          "new-orders": "/id/portal/billing/orders",
          "new-invoices": "/id/portal/billing/invoices",
          "/portal/documentations": "/id/portal/documentations",
          "/portal/support-tickets": "/id/portal/support-tickets",
          "/portal/billing": "/id/portal/billing",
          "/portal/app": "/id/portal/app",
        }}
      />
    )

    expect(
      screen.getByRole("heading", { name: "Portal — Operasional hari ini" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Perlu tindakan" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Pembayaran menunggu konfirmasi")
    ).toBeInTheDocument()
    expect(
      screen.getByText("2 pembayaran menunggu konfirmasi")
    ).toBeInTheDocument()
    expect(screen.getAllByText("1 jam lalu").length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        "Antrean bersih — tidak ada deployment gagal atau sedang dibangun"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText("Antrean ini tidak dapat dimuat")
    ).toBeInTheDocument()

    const paymentLink = screen.getAllByRole("link", {
      name: /Tinjau antrean/,
    })[0]
    expect(paymentLink).toHaveAttribute(
      "href",
      "/id/portal/billing/payments?status=PENDING"
    )
  })

  it("renders queue summary and workspace entry points", () => {
    render(<DailyOperationsView overview={overview} locale="id" />)

    expect(
      screen.getByRole("heading", { name: "Ringkasan antrean" })
    ).toBeInTheDocument()
    expect(screen.getByText("3 order baru")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Akses Cepat" })
    ).toBeInTheDocument()
    expect(screen.getByText("Documentation Registry")).toBeInTheDocument()
    expect(screen.getByText("Support Tickets")).toBeInTheDocument()
    expect(screen.getByText("Billing")).toBeInTheDocument()
    expect(screen.getByText("App Hosting")).toBeInTheDocument()
  })
})
