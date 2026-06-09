import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { ConfirmationsTab } from "./confirmations-tab"

describe("ConfirmationsTab", () => {
  it("calls POST approve when Approve is clicked", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return new Response(
          JSON.stringify({
            ok: true,
            data: [
              {
                id: "pc-1",
                amount: 100000,
                currency: "IDR",
                bankAccountId: "ba-1",
                bankName: "BCA",
                accountNumber: "123456",
                status: "pending",
                submittedAt: "2026-06-09T00:00:00Z",
              },
            ],
          }),
          { status: 200 }
        )
      },
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<ConfirmationsTab />)
    fireEvent.click(await view.findByRole("button", { name: "Approve" }))

    expect(
      calls.some(
        (call) =>
          call.url === "/api/portal/payments/confirmations/pc-1/approve" &&
          call.init?.method === "POST"
      )
    ).toBe(true)
  })

  it("calls POST reject when Reject is clicked", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return new Response(
          JSON.stringify({
            ok: true,
            data: [
              {
                id: "pc-1",
                amount: 100000,
                currency: "IDR",
                bankAccountId: "ba-1",
                bankName: "BCA",
                accountNumber: "123456",
                status: "pending",
                submittedAt: "2026-06-09T00:00:00Z",
              },
            ],
          }),
          { status: 200 }
        )
      },
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<ConfirmationsTab />)
    fireEvent.click(await view.findByRole("button", { name: "Reject" }))

    expect(
      calls.some(
        (call) =>
          call.url === "/api/portal/payments/confirmations/pc-1/reject" &&
          call.init?.method === "POST"
      )
    ).toBe(true)
  })
})
