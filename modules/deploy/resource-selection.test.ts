import { describe, expect, it } from "bun:test"

import { computeHourlyCost } from "./deploy-pricing"
import { resolveResourceSelection } from "./resource-selection"

describe("resolveResourceSelection", () => {
  it("resolves fixed plan resources and pricing", () => {
    expect(resolveResourceSelection({ resourcePlanId: "starter" })).toEqual({
      cpu: 100,
      memory: 256,
      hourlyCost: 0.02,
    })
    expect(resolveResourceSelection({ resourcePlanId: "pro" })).toEqual({
      cpu: 500,
      memory: 1024,
      hourlyCost: 0.08,
    })
  })

  it("computes PAYG pricing from the selected resources", () => {
    const selection = {
      resourcePlanId: "payg" as const,
      cpu: 500,
      memory: 1024,
    }
    expect(resolveResourceSelection(selection).hourlyCost).toBe(
      computeHourlyCost(selection)
    )
  })

  it("rejects PAYG resources outside the base limits", () => {
    expect(() =>
      resolveResourceSelection({
        resourcePlanId: "payg",
        cpu: 5000,
        memory: 1024,
      })
    ).toThrow("RESOURCE_SELECTION_INVALID")
  })
})
