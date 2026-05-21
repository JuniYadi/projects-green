import { describe, expect, it } from "bun:test"

import {
  resolveInvoicePdfPlaceholderEndpoint,
  runInvoicePdfDownloadPlaceholder,
} from "@/modules/invoices/invoice-download-placeholder"

describe("invoice download placeholder", () => {
  it("resolves endpoint template per invoice id", () => {
    expect(resolveInvoicePdfPlaceholderEndpoint("invoice_41")).toBe(
      "/api/invoices/invoice_41/pdf"
    )
  })

  it("returns success, failure, and disabled mock outcomes", async () => {
    const success = await runInvoicePdfDownloadPlaceholder({
      invoiceId: "invoice_41",
      invoiceNumber: "INV-2026-0041",
      outcome: "success",
      delayMs: 0,
    })
    expect(success.status).toBe("success")

    const failure = await runInvoicePdfDownloadPlaceholder({
      invoiceId: "invoice_41",
      invoiceNumber: "INV-2026-0041",
      outcome: "failure",
      delayMs: 0,
    })
    expect(failure.status).toBe("failure")
    if (failure.status !== "failure") {
      throw new Error("expected failure status")
    }
    expect(failure.code).toBe("INVOICE_PDF_PLACEHOLDER_FAILED")

    const disabled = await runInvoicePdfDownloadPlaceholder({
      invoiceId: "invoice_41",
      invoiceNumber: "INV-2026-0041",
      outcome: "disabled",
      delayMs: 0,
    })
    expect(disabled.status).toBe("disabled")
  })
})
