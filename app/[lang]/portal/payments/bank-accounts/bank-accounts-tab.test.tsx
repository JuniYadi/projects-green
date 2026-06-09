import { describe, expect, it } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { BankAccountsTab } from "./bank-accounts-tab"

describe("BankAccountsTab", () => {
  it("calls PATCH toggle when Set Default is clicked", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return new Response(
          JSON.stringify({
            ok: true,
            data: [
              {
                id: "ba-1",
                bankName: "BCA",
                accountNumber: "123456",
                accountHolder: "Test",
                isVerified: true,
                isDefault: false,
                createdAt: "2026-06-09",
              },
            ],
          }),
          { status: 200 }
        )
      },
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<BankAccountsTab />)
    fireEvent.click(await view.findByRole("button", { name: "Set Default" }))

    expect(
      calls.some(
        (call) =>
          call.url === "/api/portal/payments/bank-accounts/ba-1/toggle" &&
          call.init?.method === "PATCH"
      )
    ).toBe(true)
  })

  it("opens edit form and submits updates via PUT", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        if (!init) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "ba-1",
                  bankName: "BCA",
                  accountNumber: "123456",
                  accountHolder: "Test",
                  isVerified: true,
                  isDefault: false,
                  createdAt: "2026-06-09",
                },
              ],
            }),
            { status: 200 }
          )
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<BankAccountsTab />)
    fireEvent.click(await view.findByRole("button", { name: "Edit" }))
    fireEvent.change(view.getByLabelText("Bank name"), {
      target: { value: "BNI" },
    })
    fireEvent.click(view.getByRole("button", { name: "Save bank account" }))

    expect(
      calls.some(
        (call) =>
          call.url === "/api/portal/payments/bank-accounts/ba-1" &&
          call.init?.method === "PUT"
      )
    ).toBe(true)
  })
})
