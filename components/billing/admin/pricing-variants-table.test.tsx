import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { PricingVariantsTable } from "./pricing-variants-table"
import type { AdminPricing } from "@/lib/billing-client"

const row: AdminPricing = {
  id: "price-1",
  planId: "plan-1",
  regionId: "region-1",
  packageCode: "VPN",
  planCode: "VPN_BASIC",
  regionCode: "ID",
  type: "BUNDLE",
  billingMode: "PACKAGE",
  billingPeriod: "ANNUAL",
  periodPrice: "1200000",
  currency: "IDR",
  chargeUnit: "SUBSCRIPTION",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveTo: null,
  isActive: true,
}

describe("PricingVariantsTable", () => {
  it("renders complete period price without monthly wording", () => {
    const view = render(
      <PricingVariantsTable pricing={[row]} onDeactivate={() => undefined} />
    )
    expect(view.getByText("Annual")).toBeInTheDocument()
    expect(view.getByText(/IDR 1\.200\.000,00/)).toBeInTheDocument()
    expect(view.queryByText(/Price \/ month/i)).toBeNull()
  })
})
