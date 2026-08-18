import { describe, expect, it } from "bun:test"

import type { ProductPlanEditorForm } from "./catalog-editor.types"
import { validateProductPublish } from "./catalog-editor.types"

const plan = (
  offers: ProductPlanEditorForm["offers"]
): ProductPlanEditorForm => ({
  id: "plan-1",
  code: "STANDARD",
  name: "Standard",
  resources: {},
  isActive: true,
  enabledTerms: ["MONTHLY", "ANNUAL"],
  offers,
})

describe("product publish pricing contract", () => {
  it("blocks publish when every enabled currency and term cell is not positive", () => {
    const result = validateProductPublish(
      {
        basics: {
          name: "App Hosting",
          description: "Managed hosting",
        },
        plans: [
          plan([
            {
              id: "offer-idr-monthly",
              billingPeriod: "MONTHLY",
              periodPrice: "100",
              currency: "IDR",
              chargeUnit: "SUBSCRIPTION",
              effectiveFrom: "2026-01-01",
              effectiveTo: "",
              isActive: true,
            },
          ]),
        ],
      },
      ["IDR", "USD"]
    )

    expect(result.valid).toBe(false)
    expect(result.invalidTabs).toContain("plans")
    expect(result.missingPrices).toEqual([
      { planId: "plan-1", currency: "IDR", billingPeriod: "ANNUAL" },
      { planId: "plan-1", currency: "USD", billingPeriod: "MONTHLY" },
      { planId: "plan-1", currency: "USD", billingPeriod: "ANNUAL" },
    ])
  })
  it("blocks publish when every plan is inactive", () => {
    const result = validateProductPublish(
      {
        basics: { name: "App Hosting", description: "Managed hosting" },
        plans: [{ ...plan([]), isActive: false }],
      },
      ["IDR"]
    )

    expect(result).toEqual({
      valid: false,
      invalidTabs: ["plans"],
      missingPrices: [],
    })
  })

  it("blocks publish when enabled currencies are empty", () => {
    const result = validateProductPublish(
      {
        basics: { name: "App Hosting", description: "Managed hosting" },
        plans: [plan([])],
      },
      []
    )

    expect(result).toEqual({
      valid: false,
      invalidTabs: ["plans"],
      missingPrices: [],
    })
  })

  it("allows publish only when all enabled matrix cells are explicit and positive", () => {
    const result = validateProductPublish(
      {
        basics: {
          name: "App Hosting",
          description: "Managed hosting",
        },
        plans: [
          plan(
            ["IDR", "USD"].flatMap((currency) =>
              ["MONTHLY", "ANNUAL"].map((billingPeriod) => ({
                id: `${currency}-${billingPeriod}`,
                billingPeriod: billingPeriod as "MONTHLY" | "ANNUAL",
                periodPrice: "100",
                currency,
                chargeUnit: "SUBSCRIPTION" as const,
                effectiveFrom: "2026-01-01",
                effectiveTo: "",
                isActive: true,
              }))
            )
          ),
        ],
      },
      ["IDR", "USD"]
    )

    expect(result).toEqual({ valid: true, invalidTabs: [], missingPrices: [] })
  })

  it("blocks publish when plan names or codes are blank or duplicated", () => {
    const result = validateProductPublish(
      {
        basics: {
          name: "App Hosting",
          description: "Managed hosting",
        },
        plans: [
          plan([
            {
              id: "offer-1",
              billingPeriod: "MONTHLY",
              periodPrice: "100",
              currency: "IDR",
              chargeUnit: "SUBSCRIPTION",
              effectiveFrom: "2026-01-01",
              effectiveTo: "",
              isActive: true,
            },
          ]),
          {
            ...plan([]),
            id: "plan-2",
            code: "STANDARD",
            name: "",
          },
        ],
      },
      ["IDR"]
    )

    expect(result.valid).toBe(false)
    expect(result.invalidTabs).toContain("plans")
  })
})
