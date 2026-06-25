import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { MarkPaidDialog } from "@/modules/invoices/ui/mark-paid-dialog"

const originalFetch = globalThis.fetch

describe("MarkPaidDialog", () => {
  let onOpenChange: ReturnType<typeof mock>
  let onSuccess: ReturnType<typeof mock>

  beforeEach(() => {
    onOpenChange = mock(() => {})
    onSuccess = mock(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders form fields when open", () => {
    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    expect(view.getByText("Mark as Paid")).toBeTruthy()
    expect(view.getByText(/INV-2026-0001/)).toBeTruthy()
    expect(view.getByLabelText("Payment Method")).toBeTruthy()
    expect(view.getByLabelText("Reference Number (optional)")).toBeTruthy()
    expect(view.getByLabelText("Notes (optional)")).toBeTruthy()
    expect(view.getByText("Confirm Mark as Paid")).toBeTruthy()
    expect(view.getByText("Cancel")).toBeTruthy()
  })

  it("submits form and closes on success", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ ok: true, invoice: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(view.getByLabelText("Reference Number (optional)"), {
      target: { value: "REF-123" },
    })
    fireEvent.change(view.getByLabelText("Notes (optional)"), {
      target: { value: "Manual payment received" },
    })

    fireEvent.click(view.getByText("Confirm Mark as Paid"))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it("shows error when API returns failure", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ ok: false, message: "Invoice already paid" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }) as unknown as typeof fetch

    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    fireEvent.click(view.getByText("Confirm Mark as Paid"))

    await waitFor(() => {
      expect(view.getByText("Invoice already paid")).toBeTruthy()
    })

    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("shows conflict error on 409", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ ok: false }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    fireEvent.click(view.getByText("Confirm Mark as Paid"))

    await waitFor(() => {
      expect(
        view.getByText("Invoice has already been marked as paid.")
      ).toBeTruthy()
    })
  })

  it("shows generic error when API returns non-ok without message", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    fireEvent.click(view.getByText("Confirm Mark as Paid"))

    await waitFor(() => {
      expect(view.getByText("Failed to mark invoice as paid.")).toBeTruthy()
    })
  })

  it("shows error when fetch throws", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Network down")
    }) as unknown as typeof fetch

    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    fireEvent.click(view.getByText("Confirm Mark as Paid"))

    await waitFor(() => {
      expect(view.getByText("Network down")).toBeTruthy()
    })
  })

  it("shows error when fetch throws non-Error", async () => {
    globalThis.fetch = mock(async () => {
      throw "string error"
    }) as unknown as typeof fetch

    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    fireEvent.click(view.getByText("Confirm Mark as Paid"))

    await waitFor(() => {
      expect(view.getByText("Unable to mark invoice as paid.")).toBeTruthy()
    })
  })

  it("resets state and calls onOpenChange on Cancel", () => {
    const view = render(
      <MarkPaidDialog
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    )

    fireEvent.click(view.getByText("Cancel"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
