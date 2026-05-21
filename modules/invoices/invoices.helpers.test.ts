import { describe, expect, it } from "bun:test"

import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  resolveInvoiceFlowState,
} from "@/modules/invoices/invoices.helpers"
import { INVOICE_FLOW_STATE_REGISTRY } from "@/modules/invoices/invoices.mock"

describe("invoice helpers", () => {
  it("resolves flow scenarios from shared registry", () => {
    const state = resolveInvoiceFlowState(
      INVOICE_FLOW_STATE_REGISTRY,
      "payment",
      "failure"
    )

    expect(state.flow).toBe("payment")
    expect(state.scenario).toBe("failure")
    if (state.scenario !== "failure") {
      throw new Error("expected failure scenario")
    }
    expect(state.code).toBe("INVOICE_PAYMENT_OPTIONS_FAILED")
  })

  it("formats invoice label, currency, and date consistently", () => {
    expect(getInvoiceStatusLabel("cancel_requested")).toBe("Cancel Requested")
    expect(formatInvoiceCurrency(149)).toBe("$149.00")
    expect(formatInvoiceDate("2026-03-03")).toBe("Mar 03, 2026")
  })
})
