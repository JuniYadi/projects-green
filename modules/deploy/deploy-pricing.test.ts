import { describe, expect, it } from "bun:test"

import {
  computeHourlyCost,
  computeHourlyCostDecimal,
  FIXED_PLAN_HOURLY_COST,
} from "./deploy-pricing"

describe("deploy-pricing", () => {
  it("returns the flat rate for fixed plans", () => {
    expect(computeHourlyCost({ resourcePlanId: "starter" })).toBe(
      FIXED_PLAN_HOURLY_COST.starter
    )
    expect(computeHourlyCost({ resourcePlanId: "pro" })).toBe(
      FIXED_PLAN_HOURLY_COST.pro
    )
  })

  it("scales PAYG cost with cpu and memory", () => {
    // 100m CPU * 0.00005 + 256MiB * 0.00001 = 0.005 + 0.00256 = 0.00756
    expect(computeHourlyCost({ resourcePlanId: "payg", cpu: 100, memory: 256 })).toBe(
      0.0076
    )
    // Larger compute costs more
    const small = computeHourlyCost({ resourcePlanId: "payg", cpu: 100, memory: 256 })
    const large = computeHourlyCost({ resourcePlanId: "payg", cpu: 2000, memory: 4096 })
    expect(large).toBeGreaterThan(small)
  })

  it("falls back to safe PAYG defaults for missing/invalid compute", () => {
    const withDefaults = computeHourlyCost({ resourcePlanId: "payg" })
    const explicit = computeHourlyCost({
      resourcePlanId: "payg",
      cpu: 100,
      memory: 256,
    })
    expect(withDefaults).toBe(explicit)

    expect(
      computeHourlyCost({ resourcePlanId: "payg", cpu: 0, memory: -5 })
    ).toBe(explicit)
  })

  it("produces a Decimal matching the numeric helper", () => {
    const decimal = computeHourlyCostDecimal({
      resourcePlanId: "payg",
      cpu: 500,
      memory: 1024,
    })
    const numeric = computeHourlyCost({
      resourcePlanId: "payg",
      cpu: 500,
      memory: 1024,
    })
    expect(decimal.toNumber()).toBe(numeric)
  })
})
