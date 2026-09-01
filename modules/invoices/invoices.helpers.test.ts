import { describe, expect, it } from "bun:test"

import {
  DEFAULT_INVOICE_SORT,
  formatInvoiceCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  getInvoiceStatusToneClass,
  getNextRenewalDate,
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
  it("falls back to USD for an invalid currency code", () => {
    expect(formatInvoiceCurrency(149.5, "not-a-currency")).toBe("$149.50")
  })
  it("returns a fallback label, tone, and warning for unknown status", () => {
    const originalWarn = console.warn
    const calls: unknown[][] = []
    console.warn = (...args: unknown[]) => {
      calls.push(args)
    }
    try {
      expect(getInvoiceStatusLabel("ISSUED_RAW")).toBe("Unknown")
      expect(getInvoiceStatusToneClass("ISSUED_RAW")).toBe(
        "border-slate-500/20 bg-slate-500/10 text-slate-600"
      )
      expect(calls.length).toBeGreaterThan(0)
    } finally {
      console.warn = originalWarn
    }
  })

  it("returns defined metadata for every known status", () => {
    for (const status of [
      "draft",
      "open",
      "paid",
      "canceled",
      "uncollectible",
    ]) {
      expect(getInvoiceStatusLabel(status as never)).not.toBe("Unknown")
      expect(getInvoiceStatusToneClass(status as never)).toContain("border-")
    }
  })

  it("computes next renewal date correctly from periodEnd", () => {
    expect(getNextRenewalDate(null)).toBeNull()
    expect(getNextRenewalDate("2026-09-30T23:59:59.999Z")).toBe(
      "2026-10-01T00:00:00.000Z"
    )
    expect(getNextRenewalDate("2026-09-30")).toBe("2026-10-01T00:00:00.000Z")
  })
  it("returns null for an invalid periodEnd date", () => {
    expect(getNextRenewalDate("not-a-date")).toBeNull()
  })
})
