import { describe, expect, it } from "bun:test"

import {
  DEFAULT_INVOICE_SORT,
  formatInvoiceCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  INVOICE_STATUS_FILTER_OPTIONS,
} from "@/modules/invoices/invoices.helpers"

describe("invoice helpers", () => {
  it("exposes list defaults and status filter options", () => {
    expect(DEFAULT_INVOICE_SORT).toEqual({
      sortBy: "issuedAt",
      sortDir: "desc",
    })

    expect(INVOICE_STATUS_FILTER_OPTIONS).toEqual([
      { value: "draft", label: "Draft" },
      { value: "open", label: "Open" },
      { value: "paid", label: "Paid" },
      { value: "canceled", label: "Canceled" },
      { value: "uncollectible", label: "Uncollectible" },
    ])
  })

  it("formats invoice labels, currency, and date consistently", () => {
    expect(getInvoiceStatusLabel("canceled")).toBe("Canceled")
    expect(formatInvoiceCurrency(149.5, "USD")).toBe("$149.50")
    expect(formatInvoiceDate("2026-05-21T00:00:00.000Z", "en-US")).toBe(
      "May 21, 2026"
    )
    expect(formatInvoiceDate(null, "en-US")).toBe("-")
  })
})
