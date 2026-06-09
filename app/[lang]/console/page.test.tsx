import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
}))

let invoicesPayload: {
  ok: boolean
  invoices: Array<{ id?: string; totalAmountIdr: number; status: string }>
} = {
  ok: true,
  invoices: [{ id: "inv_1", totalAmountIdr: 75000, status: "PAID" }],
}

const mockFetch = mock((input: string | URL | Request) => {
  const url = input.toString()
  const payload = url.includes("/api/billing/account")
    ? { ok: true, formattedBalance: "IDR 250,000", accountAge: "3 months" }
    : url.includes("/api/usage")
      ? { success: true, data: { totalSpend: 125000, period: "June 2026" } }
      : url.includes("/api/billing/invoices")
        ? invoicesPayload
        : { ok: true, tickets: [{ id: "ticket_1" }, { id: "ticket_2" }] }

  return Promise.resolve({
    json: () => Promise.resolve(payload),
  } as Response)
})

global.fetch = mockFetch as unknown as typeof fetch

describe("ConsolePage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
    invoicesPayload = {
      ok: true,
      invoices: [{ id: "inv_1", totalAmountIdr: 75000, status: "PAID" }],
    }
  })

  it("renders static header text", async () => {
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    // Static header text renders in initial client render
    expect(container.textContent).toContain("Console")
    expect(container.textContent).toContain("Current Balance")
    expect(container.textContent).toContain("Spent This Month")
    expect(container.textContent).toContain("Last Invoice")
    expect(container.textContent).toContain("Open Tickets")

    await waitFor(() => {
      expect(container.textContent).toContain("IDR 250,000")
      expect(container.textContent).toContain("Account age: 3 months")
      expect(container.textContent).toContain("IDR 125.000")
      expect(container.textContent).toContain("Period: June 2026")
      expect(container.textContent).toContain("IDR 75000")
      expect(container.textContent).toContain("Status: PAID")
      expect(container.textContent).toContain("2")
      expect(container.textContent).toContain("Awaiting response")
    })
  })

  it("links Last Invoice to the latest invoice detail and Open Tickets to filtered list", async () => {
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    await waitFor(() => {
      expect(
        container.querySelector('a[href="/id/console/billing/invoices/inv_1"]'),
      ).not.toBeNull()
      expect(
        container.querySelector(
          'a[href="/id/console/support-tickets?status=open"]',
        ),
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
        container.querySelector('a[href="/id/console/billing/invoices"]'),
      ).not.toBeNull()
    })
  })
})
