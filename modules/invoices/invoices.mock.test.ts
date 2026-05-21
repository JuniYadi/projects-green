import { describe, expect, it } from "bun:test"

import {
  getInvoiceListItemById,
  INVOICE_FLOW_STATE_REGISTRY,
  INVOICE_INTEGRATION_TODOS,
  INVOICE_LIST_ROWS,
  resolveInvoiceViewScenarioState,
} from "@/modules/invoices/invoices.mock"

describe("invoice mock contracts", () => {
  it("covers all scenarios for each invoice flow", () => {
    expect(Object.keys(INVOICE_FLOW_STATE_REGISTRY)).toEqual([
      "view",
      "download",
      "payment",
      "cancel_request",
    ])

    expect(Object.keys(INVOICE_FLOW_STATE_REGISTRY.view)).toEqual([
      "loading",
      "success",
      "failure",
      "empty",
    ])
    expect(Object.keys(INVOICE_FLOW_STATE_REGISTRY.download)).toEqual([
      "loading",
      "success",
      "failure",
      "empty",
    ])
    expect(Object.keys(INVOICE_FLOW_STATE_REGISTRY.payment)).toEqual([
      "loading",
      "success",
      "failure",
      "empty",
    ])
    expect(Object.keys(INVOICE_FLOW_STATE_REGISTRY.cancel_request)).toEqual([
      "loading",
      "success",
      "failure",
      "empty",
    ])
  })

  it("contains mock table data and integration placeholders", () => {
    expect(INVOICE_LIST_ROWS.length).toBeGreaterThan(0)
    expect(INVOICE_LIST_ROWS.some((item) => item.status === "pending")).toBe(
      true
    )

    expect(INVOICE_INTEGRATION_TODOS.view.length).toBeGreaterThan(0)
    expect(INVOICE_INTEGRATION_TODOS.download.length).toBeGreaterThan(0)
    expect(INVOICE_INTEGRATION_TODOS.payment.length).toBeGreaterThan(0)
    expect(INVOICE_INTEGRATION_TODOS.cancel_request.length).toBeGreaterThan(0)
  })

  it("resolves view state by invoice id and scenario", () => {
    const successState = resolveInvoiceViewScenarioState({
      invoiceId: "invoice_41",
      scenario: "success",
    })
    if (successState.scenario !== "success") {
      throw new Error("expected success scenario")
    }

    expect(successState.data.id).toBe("invoice_41")

    const emptyState = resolveInvoiceViewScenarioState({
      invoiceId: "invoice_missing",
      scenario: "success",
    })
    expect(emptyState.scenario).toBe("empty")
  })

  it("finds invoice rows by id", () => {
    expect(getInvoiceListItemById("invoice_42")?.invoiceNumber).toBe(
      "INV-2026-0042"
    )
    expect(getInvoiceListItemById("unknown")).toBeNull()
  })
})
