import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockFetch = mock((input: string | URL | Request) => {
  const url = input.toString()
  const payload = url.includes("/api/billing/account")
    ? { ok: true, formattedBalance: "IDR 250,000", accountAge: "3 months" }
    : url.includes("/api/usage")
      ? { success: true, data: { totalSpend: 125000, period: "June 2026" } }
      : url.includes("/api/billing/invoices")
        ? { ok: true, invoices: [{ totalAmountIdr: 75000, status: "PAID" }] }
        : { ok: true, tickets: [{ id: "ticket_1" }, { id: "ticket_2" }] }

  return Promise.resolve({
    json: () => Promise.resolve(payload),
  } as Response)
})

global.fetch = mockFetch as unknown as typeof fetch

describe("ConsolePage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
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
})
