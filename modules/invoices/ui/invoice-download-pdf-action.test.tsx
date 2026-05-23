import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"

const originalFetch = globalThis.fetch
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

describe("InvoiceDownloadPdfAction", () => {
  beforeEach(() => {
    URL.createObjectURL = mock(() => "blob:mock") as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = mock(() => undefined) as unknown as typeof URL.revokeObjectURL
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it("downloads PDF when API succeeds", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
        },
      })
    }) as unknown as typeof fetch

    const clickMock = mock(() => {})
    const appendMock = mock(() => {})
    const removeMock = mock(() => {})
    const originalCreateElement = document.createElement.bind(document)

    const createElementSpy = mock((tagName: string) => {
      if (tagName === "a") {
        return {
          href: "",
          download: "",
          click: clickMock,
          remove: removeMock,
        }
      }

      return originalCreateElement(tagName)
    })

    document.createElement = createElementSpy as unknown as typeof document.createElement

    const originalAppend = document.body.append.bind(document.body)
    document.body.append = appendMock as unknown as typeof document.body.append

    const view = render(
      <InvoiceDownloadPdfAction
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
      />
    )

    fireEvent.click(view.getByRole("button", { name: "Download PDF" }))

    await waitFor(() => {
      expect(clickMock).toHaveBeenCalled()
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock")
    })

    document.createElement = originalCreateElement
    document.body.append = originalAppend
  })

  it("shows error message when API fails", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Invoice PDF is unavailable.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }) as unknown as typeof fetch

    const view = render(
      <InvoiceDownloadPdfAction
        invoiceId="inv_1"
        invoiceNumber="INV-2026-0001"
      />
    )

    fireEvent.click(view.getByRole("button", { name: "Download PDF" }))

    await waitFor(() => {
      expect(view.getByText("Invoice PDF is unavailable.")).toBeTruthy()
    })
  })
})
