import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

import InvoicesPage from "./page"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })

describe("Billing InvoicesPage", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices")) {
        return jsonResponse({ ok: true, invoices: [] })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("shows invoice table controls when the invoice list is empty", async () => {
    const view = render(<InvoicesPage />)

    await waitFor(() =>
      expect(
        view.getByText("No invoices match your filters.")
      ).toBeInTheDocument()
    )

    expect(view.getByLabelText("Search invoices...")).toBeInTheDocument()
    expect(view.getByText("All status")).toBeInTheDocument()
    expect(view.getByRole("button", { name: /columns/i })).toBeInTheDocument()
  })

  it("shows issued date column and hides due date by default", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices")) {
        return jsonResponse({
          ok: true,
          invoices: [
            {
              id: "inv-1",
              invoiceNumber: "INV-2026-001",
              status: "OPEN",
              issuedAt: "2026-05-01T00:00:00.000Z",
              dueAt: "2026-05-15T00:00:00.000Z",
              totalAmountIdr: "299000.00",
              currency: "IDR",
              lines: [],
            },
          ],
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoicesPage />)

    await waitFor(() =>
      expect(
        view.getByRole("columnheader", { name: /issued date/i })
      ).toBeInTheDocument()
    )

    expect(
      view.queryByRole("columnheader", { name: /due date/i })
    ).not.toBeInTheDocument()
    expect(
      view.queryByRole("columnheader", { name: /period/i })
    ).not.toBeInTheDocument()
  })
})
