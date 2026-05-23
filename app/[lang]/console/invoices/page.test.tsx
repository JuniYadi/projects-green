import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

import InvoicesPage from "@/app/[lang]/console/invoices/page"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

describe("InvoicesPage", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/invoices")) {
        return jsonResponse({
          ok: true,
          invoices: [
            {
              id: "inv_1",
              invoiceNumber: "INV-2026-0001",
              issuedAt: "2026-05-02T00:00:00.000Z",
              dueAt: "2026-05-17T00:00:00.000Z",
              totalAmount: 110,
              currency: "USD",
              status: "open",
            },
          ],
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders invoice table from API data", async () => {
    const ui = await InvoicesPage({
      params: Promise.resolve({ lang: "en" }),
    })
    const view = render(ui)

    expect(view.getByRole("heading", { name: "Invoices" })).toBeTruthy()
    expect(view.getByText("Billing History")).toBeTruthy()

    await waitFor(() => {
      expect(
        view.getByRole("link", { name: "INV-2026-0001" }).getAttribute("href")
      ).toBe("/en/console/invoices/inv_1")
    })
  })
})
