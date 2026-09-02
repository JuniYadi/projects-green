import { describe, expect, it } from "bun:test"
import { invoiceExplainTool } from "./invoice-explain.tool"

describe("invoiceExplainTool", () => {
  it("has valid tool metadata", () => {
    expect(invoiceExplainTool.name).toBe("billing.invoice_explain")
  })
})
