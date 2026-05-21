import { describe, expect, it } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import type { InvoiceDownloadData } from "@/modules/invoices/invoices.types"
import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"

const DOWNLOAD_DATA: InvoiceDownloadData = {
  invoice: {
    id: "invoice_41",
    invoiceNumber: "INV-2026-0041",
    issuedAt: "2026-03-03",
    dueAt: "2026-03-17",
    totalAmount: 149,
    currency: "USD",
    status: "pending",
  },
  availableFormats: ["pdf"],
  defaultFormat: "pdf",
}

describe("InvoiceDownloadPdfAction", () => {
  it("handles idle to success transition", async () => {
    const view = render(
      <InvoiceDownloadPdfAction
        invoiceId="invoice_41"
        downloadData={DOWNLOAD_DATA}
        mockDelayMs={0}
      />
    )

    expect(
      view.getByText("Ready to trigger mocked PDF download flow.")
    ).toBeTruthy()
    fireEvent.click(view.getByRole("button", { name: "Download PDF (Mock)" }))

    await waitFor(() => {
      expect(
        view.getByText("Mock PDF request for INV-2026-0041 completed.")
      ).toBeTruthy()
    })
  })

  it("handles failure and disabled outcomes", async () => {
    const view = render(
      <InvoiceDownloadPdfAction
        invoiceId="invoice_41"
        downloadData={DOWNLOAD_DATA}
        mockDelayMs={0}
      />
    )

    fireEvent.click(view.getByRole("button", { name: "Failure" }))
    fireEvent.click(view.getByRole("button", { name: "Download PDF (Mock)" }))

    await waitFor(() => {
      expect(
        view.getByText(
          "[INVOICE_PDF_PLACEHOLDER_FAILED] Mock request for INV-2026-0041 failed before file delivery."
        )
      ).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Disabled" }))
    fireEvent.click(view.getByRole("button", { name: "Download PDF (Mock)" }))

    await waitFor(() => {
      expect(
        view.getByText(
          "Mock download for INV-2026-0041 is disabled by scenario."
        )
      ).toBeTruthy()
    })

    const downloadButton = view.getByRole("button", {
      name: "Download PDF (Mock)",
    }) as HTMLButtonElement
    expect(downloadButton.disabled).toBe(true)
  })
})
