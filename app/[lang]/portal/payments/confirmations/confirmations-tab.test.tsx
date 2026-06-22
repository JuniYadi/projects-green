import { describe, expect, it } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { ConfirmationsTab } from "./confirmations-tab"

const confirmationPayload = [
  {
    id: "pc-1",
    amount: 100000,
    currency: "IDR",
    bankAccountId: "ba-1",
    bankName: "BCA",
    accountName: "PT Projects Green",
    accountNumber: "123456",
    status: "pending",
    submittedAt: "2026-06-09T00:00:00Z",
    notes: "Transfer received",
  },
]

describe("ConfirmationsTab", () => {
  it("renders confirmations in a filterable table and opens a review modal", async () => {
    globalThis.fetch = Object.assign(
      async () =>
        new Response(JSON.stringify(confirmationPayload), {
          status: 200,
        }),
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<ConfirmationsTab />)

    expect(await view.findByRole("table")).toBeInTheDocument()
    expect(
      view.getByRole("columnheader", { name: /amount/i })
    ).toBeInTheDocument()
    expect(
      view.getByRole("columnheader", { name: /bank account/i })
    ).toBeInTheDocument()
    expect(view.getByLabelText("Filter confirmations...")).toBeInTheDocument()

    fireEvent.click(view.getByRole("button", { name: "Review" }))

    expect(await view.findByRole("dialog")).toBeInTheDocument()
    expect(view.getByText("PT Projects Green")).toBeInTheDocument()
    expect(view.getAllByText("Transfer received").length).toBeGreaterThan(0)
  })

  it("approves a payment only from the review modal", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify(confirmationPayload), {
          status: 200,
        })
      },
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<ConfirmationsTab />)
    fireEvent.click(await view.findByRole("button", { name: "Review" }))
    fireEvent.click(
      await view.findByRole("button", { name: "Approve received payment" })
    )

    await waitFor(() => {
      expect(
        calls.some(
          (call) =>
            new URL(call.url, "http://localhost").pathname ===
              "/api/portal/payments/confirmations/pc-1/approve" &&
            call.init?.method === "POST"
        )
      ).toBe(true)
    })
  })

  it("requires a rejection reason and sends it to the API", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify(confirmationPayload), {
          status: 200,
        })
      },
      { preconnect: () => {} }
    ) as typeof fetch

    const view = render(<ConfirmationsTab />)
    fireEvent.click(await view.findByRole("button", { name: "Review" }))
    fireEvent.input(await view.findByLabelText("Rejection reason"), {
      target: { value: "Amount does not match bank statement" },
    })
    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "Reject payment" })
      ).not.toBeDisabled()
    })
    fireEvent.click(view.getByRole("button", { name: "Reject payment" }))

    await waitFor(() => {
      const rejectCall = calls.find(
        (call) =>
          new URL(call.url, "http://localhost").pathname ===
            "/api/portal/payments/confirmations/pc-1/reject" &&
          call.init?.method === "POST"
      )
      expect(rejectCall).toBeDefined()
      expect(JSON.parse(String(rejectCall?.init?.body))).toEqual({
        action: "reject",
        reason: "Amount does not match bank statement",
      })
    })
  })
})
