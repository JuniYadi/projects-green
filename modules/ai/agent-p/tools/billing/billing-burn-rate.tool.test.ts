import { describe, expect, it } from "bun:test"
import { billingBurnRateTool } from "./billing-burn-rate.tool"

describe("billingBurnRateTool", () => {
  it("has valid tool metadata", () => {
    expect(billingBurnRateTool.name).toBe("billing.burn_rate")
  })
})
