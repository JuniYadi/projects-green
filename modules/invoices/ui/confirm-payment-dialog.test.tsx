import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { ConfirmPaymentDialog } from "@/modules/invoices/ui/confirm-payment-dialog"
import type { PaymentConfirmationDTO } from "@/modules/invoices/invoices.types"

const baseConfirmation: PaymentConfirmationDTO = {
  id: "pc_1",
  bankAccountId: "ba_1",
  bankName: "Bank Central Asia",
  accountName: "Main Account",
  amount: 150000,
  currency: "IDR",
  senderName: "Alice",
  senderBankName: "BCA",
  senderAccount: "123456",
  screenshotUrl: "https://example.com/screenshot.png",
  notes: "Payment for invoice",
  status: "PENDING",
  rejectReason: null,
  reviewedAt: null,
  paymentDateTime: "2026-06-01T10:00:00.000Z",
  createdAt: "2026-06-01T09:00:00.000Z",
}

const originalFetch = globalThis.fetch

describe("ConfirmPaymentDialog", () => {
  let onOpenChange: ReturnType<typeof mock>
  let onActionComplete: ReturnType<typeof mock>

  beforeEach(() => {
    onOpenChange = mock(() => {})
    onActionComplete = mock(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders confirmation details when open", () => {
    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    expect(view.getByText("Approve Payment")).toBeTruthy()
    expect(view.getByText("Bank Central Asia")).toBeTruthy()
    expect(view.getByText("Alice")).toBeTruthy()
    expect(view.getByText("BCA")).toBeTruthy()
    expect(view.getByText(/150,000/)).toBeTruthy()
    expect(view.getByText("View Screenshot")).toBeTruthy()
    expect(view.getByText("Payment for invoice")).toBeTruthy()
  })

  it("renders without optional fields", () => {
    const minimal: PaymentConfirmationDTO = {
      ...baseConfirmation,
      senderName: null,
      senderBankName: null,
      senderAccount: null,
      screenshotUrl: null,
      notes: null,
    }

    const view = render(
      <ConfirmPaymentDialog
        confirmation={minimal}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    expect(view.getByText("Approve Payment")).toBeTruthy()
    expect(view.getByText("Bank Central Asia")).toBeTruthy()
    expect(view.queryByText("View Screenshot")).toBeNull()
  })

  it("shows approve/reject buttons when canManage is true", () => {
    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    expect(view.getByText("Approve")).toBeTruthy()
    expect(view.getByText("Reject")).toBeTruthy()
  })

  it("hides approve/reject buttons when canManage is false", () => {
    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={false}
        onActionComplete={onActionComplete}
      />
    )

    expect(view.queryByText("Approve")).toBeNull()
    expect(view.queryByText("Reject")).toBeNull()
  })

  it("shows reject reason textarea when Reject is clicked", () => {
    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Reject"))

    expect(view.getByText("Reject Payment")).toBeTruthy()
    expect(view.getByRole("textbox", { name: /rejection reason/i })).toBeTruthy()
    expect(view.getByText("Back")).toBeTruthy()
    expect(view.getByText("Confirm Reject")).toBeTruthy()
  })

  it("approve flow calls API and closes dialog on success", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Approve"))
    fireEvent.click(view.getByText("Confirm Approve"))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(onActionComplete).toHaveBeenCalled()
    })
  })

  it("shows error when API returns failure", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ ok: false, message: "Already processed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }) as unknown as typeof fetch

    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Approve"))
    fireEvent.click(view.getByText("Confirm Approve"))

    await waitFor(() => {
      expect(view.getByText("Already processed")).toBeTruthy()
    })

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("shows generic error when API returns non-ok without message", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Approve"))
    fireEvent.click(view.getByText("Confirm Approve"))

    await waitFor(() => {
      expect(view.getByText(/Failed to approve confirmation/)).toBeTruthy()
    })
  })

  it("shows error when fetch throws", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Network error")
    }) as unknown as typeof fetch

    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Approve"))
    fireEvent.click(view.getByText("Confirm Approve"))

    await waitFor(() => {
      expect(view.getByText("Network error")).toBeTruthy()
    })
  })

  it("shows error when fetch throws non-Error", async () => {
    globalThis.fetch = mock(async () => {
      throw "string error"
    }) as unknown as typeof fetch

    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Approve"))
    fireEvent.click(view.getByText("Confirm Approve"))

    await waitFor(() => {
      expect(view.getByText(/Unable to approve confirmation/)).toBeTruthy()
    })
  })

  it("resets state when Back is clicked", () => {
    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Reject"))
    expect(view.getByText("Reject Payment")).toBeTruthy()

    fireEvent.click(view.getByText("Back"))
    expect(view.getByText("Approve")).toBeTruthy()
    expect(view.getByText("Reject")).toBeTruthy()
  })

  it("disables Confirm Reject when reason is empty", () => {
    const view = render(
      <ConfirmPaymentDialog
        confirmation={baseConfirmation}
        open={true}
        onOpenChange={onOpenChange}
        canManage={true}
        onActionComplete={onActionComplete}
      />
    )

    fireEvent.click(view.getByText("Reject"))

    const confirmButton = view.getByText("Confirm Reject")
    expect(confirmButton).toBeDisabled()
  })
})
