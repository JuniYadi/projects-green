import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

let currentLocale: "en" | "id" = "en"
mock.module("next/navigation", () => ({
  useParams: () => ({ lang: currentLocale }),
}))

let accountPayload: {
  ok: boolean
  currency: string
  formattedBalance: string
  accountAge: string
  error?: string
} = {
  ok: true,
  currency: "USD",
  formattedBalance: "USD 250.00",
  accountAge: "3 months",
}

const failedRequestPaths = new Set<string>()

let invoicesPayload: {
  ok: boolean
  invoices: Array<{
    id?: string
    totalAmountIdr: number
    currency?: string
    status: string
  }>
} = {
  ok: true,
  invoices: [
    {
      id: "inv_1",
      totalAmountIdr: 75000,
      currency: "USD",
      status: "PAID",
    },
  ],
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const originalFetch = globalThis.fetch
const mockFetch = mock((input: string | URL | Request) => {
  const url = input.toString()
  const method = input instanceof Request ? input.method : "GET"

  if (url.includes("/api/billing/account")) {
    if (failedRequestPaths.has("/api/billing/account")) {
      return jsonResponse({ ok: false, error: "Raw API exception" })
    }

    return jsonResponse(accountPayload)
  }

  if (url.includes("/api/billing/usage")) {
    if (failedRequestPaths.has("/api/billing/usage")) {
      return jsonResponse({ success: false, error: "Raw API exception" })
    }

    return jsonResponse({
      success: true,
      data: { totalSpend: 125000, period: "June 2026" },
    })
  }

  if (url.includes("/api/billing/invoices")) {
    if (failedRequestPaths.has("/api/billing/invoices")) {
      return jsonResponse({ ok: false, error: "Raw API exception" })
    }

    return jsonResponse(invoicesPayload)
  }

  if (url.includes("/api/support-tickets") && method === "GET") {
    if (failedRequestPaths.has("/api/support-tickets")) {
      return jsonResponse({ ok: false, error: "Raw API exception" })
    }

    return jsonResponse({
      ok: true,
      tickets: [{ id: "ticket_1" }, { id: "ticket_2" }],
    })
  }

  return jsonResponse({
    ok: true,
    tickets: [{ id: "ticket_1" }, { id: "ticket_2" }],
  })
})

describe("ConsolePage", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch as unknown as typeof fetch
    mockFetch.mockClear()
    currentLocale = "en"
    failedRequestPaths.clear()
    accountPayload = {
      ok: true,
      currency: "USD",
      formattedBalance: "USD 250.00",
      accountAge: "3 months",
    }
    invoicesPayload = {
      ok: true,
      invoices: [
        {
          id: "inv_1",
          totalAmountIdr: 75000,
          currency: "USD",
          status: "PAID",
        },
      ],
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders English dashboard copy", async () => {
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    expect(container.textContent).toContain("Console")
    expect(container.textContent).toContain("Current Balance")
    expect(container.textContent).toContain("Spent This Month")
    expect(container.textContent).toContain("Last Invoice")
    expect(container.textContent).toContain("Open Tickets")

    await waitFor(() => {
      expect(container.textContent).toContain("USD 250.00")
      expect(container.textContent).toContain("Account age: 3 months")
      expect(container.textContent).toContain("USD 125,000.00")
      expect(container.textContent).toContain("Period: June 2026")
      expect(container.textContent).toContain("USD 75,000.00")
      expect(container.textContent).not.toMatch(/IDR (125|75)/)
      expect(container.textContent).toContain("Status: PAID")
      expect(container.textContent).toContain("2")
    })
  })

  it("renders Indonesian dashboard copy and localized links", async () => {
    currentLocale = "id"
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    expect(container.textContent).toContain("Konsol")
    expect(container.textContent).toContain("Saldo Saat Ini")
    expect(container.textContent).toContain("Pengeluaran Bulan Ini")
    expect(container.textContent).toContain("Invoice Terakhir")
    expect(container.textContent).toContain("Tiket Terbuka")

    await waitFor(() => {
      expect(container.textContent).toContain("Usia akun: 3 months")
      expect(container.textContent).toContain("Periode: June 2026")
      expect(container.textContent).toContain("Status: PAID")
      expect(container.textContent).not.toContain("Current Balance")
      expect(container.textContent).not.toContain("Spent This Month")
      expect(container.textContent).not.toContain("Last Invoice")
      expect(container.textContent).not.toContain("Open Tickets")
      expect(
        container.querySelector('a[href="/id/console/billing/invoices/inv_1"]')
      ).not.toBeNull()
      expect(
        container.querySelector(
          'a[href="/id/console/support-tickets?status=open"]'
        )
      ).not.toBeNull()
    })
  })

  it("formats every money card for an IDR organization", async () => {
    accountPayload = {
      ok: true,
      currency: "IDR",
      formattedBalance: "IDR 250.000,00",
      accountAge: "3 months",
    }
    invoicesPayload.invoices[0].currency = "IDR"
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    await waitFor(() => {
      expect(container.textContent).toContain("IDR 250.000,00")
      expect(container.textContent).toContain("IDR 125.000,00")
      expect(container.textContent).toContain("IDR 75.000,00")
    })
  })

  it("uses invoice currency when the account request fails", async () => {
    accountPayload = {
      ok: false,
      currency: "",
      formattedBalance: "",
      accountAge: "",
    }
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    await waitFor(() => {
      expect(container.textContent).toContain("USD 125,000.00")
      expect(container.textContent).toContain("USD 75,000.00")
    })
  })

  it("uses stable locale-specific copy for failed dashboard requests", async () => {
    currentLocale = "id"
    failedRequestPaths.add("/api/billing/account")
    failedRequestPaths.add("/api/billing/usage")
    failedRequestPaths.add("/api/billing/invoices")
    failedRequestPaths.add("/api/support-tickets")

    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    await waitFor(() => {
      expect(container.textContent).toContain("Tidak Tersedia")
      expect(container.textContent).not.toContain("Raw API exception")
    })
  })

  it("links Last Invoice to the latest invoice detail and Open Tickets to filtered list", async () => {
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    await waitFor(() => {
      expect(
        container.querySelector('a[href="/en/console/billing/invoices/inv_1"]')
      ).not.toBeNull()
      expect(
        container.querySelector(
          'a[href="/en/console/support-tickets?status=open"]'
        )
      ).not.toBeNull()
    })
  })

  it("links Last Invoice to the invoice list when no invoice exists", async () => {
    invoicesPayload = { ok: true, invoices: [] }
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    await waitFor(() => {
      expect(container.textContent).toContain("No invoices yet")
      expect(
        container.querySelector('a[href="/en/console/billing/invoices"]')
      ).not.toBeNull()
    })
  })

  it("uses Indonesian empty-invoice copy and link", async () => {
    currentLocale = "id"
    invoicesPayload = { ok: true, invoices: [] }
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    await waitFor(() => {
      expect(container.textContent).toContain("Belum ada invoice")
      expect(
        container.querySelector('a[href="/id/console/billing/invoices"]')
      ).not.toBeNull()
    })
  })
})
