import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
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
      href: "/portal/app/deployments?status=FAILED,BUILDING",
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
    const { getByRole, getByText, getAllByText, getAllByRole } = render(
      <DailyOperationsView
        overview={overview}
        locale="id"
        localizedHrefs={{
          "payments-awaiting-confirmation":
            "/id/portal/billing/payments?status=PENDING",
          "failed-or-building-deployments":
            "/id/portal/app/deployments?status=FAILED,BUILDING",
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
      getByRole("heading", { name: "Portal — Operasional hari ini" })
    ).toBeInTheDocument()
    expect(getByRole("heading", { name: "Perlu tindakan" })).toBeInTheDocument()
    expect(getByText("Pembayaran menunggu konfirmasi")).toBeInTheDocument()
    expect(getByText("2 pembayaran menunggu konfirmasi")).toBeInTheDocument()
    expect(getAllByText("1 jam lalu").length).toBeGreaterThan(0)
    expect(
      getByText(
        "Antrean bersih — tidak ada deployment gagal atau sedang dibangun"
      )
    ).toBeInTheDocument()
    expect(getByText("Antrean ini tidak dapat dimuat")).toBeInTheDocument()

    const paymentLink = getAllByRole("link", {
      name: /Tinjau antrean/,
    })[0]
    expect(paymentLink).toHaveAttribute(
      "href",
      "/id/portal/billing/payments?status=PENDING"
    )
  })

  it("renders queue summary and workspace entry points", () => {
    const { getByRole, getByText } = render(
      <DailyOperationsView overview={overview} locale="id" />
    )

    expect(
      getByRole("heading", { name: "Ringkasan antrean" })
    ).toBeInTheDocument()
    expect(getByText("3 order baru")).toBeInTheDocument()
    expect(getByText("Tercatat")).toBeInTheDocument()
    expect(getByText("Tidak ada")).toBeInTheDocument()
    expect(getByText("Tidak ada invoice baru dalam 24 jam")).toBeInTheDocument()
    expect(getByRole("heading", { name: "Akses Cepat" })).toBeInTheDocument()
    expect(getByText("Documentation Registry")).toBeInTheDocument()
    expect(getByText("Support Tickets")).toBeInTheDocument()
    expect(getByText("Billing")).toBeInTheDocument()
    expect(getByText("App Hosting")).toBeInTheDocument()
  })
})
