import { describe, it, expect } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { BillingBalanceGateBanner } from "./billing-balance-gate-banner"

describe("BillingBalanceGateBanner", () => {
  it("shows the zero-balance title and top-up link", () => {
    const view = render(
      <BillingBalanceGateBanner
        formattedBalance="IDR 0.00"
        topupUrl="/en/console/billing/topup"
        isZero
      />
    )

    expect(view.getByText("No balance available")).toBeInTheDocument()
    expect(view.getByText(/IDR 0\.00/)).toBeInTheDocument()
    const link = view.getByRole("link", { name: "Top up" })
    expect(link).toHaveAttribute("href", "/en/console/billing/topup")
  })

  it("shows the low-balance title when not zero", () => {
    const view = render(
      <BillingBalanceGateBanner
        formattedBalance="IDR 5,000.00"
        topupUrl="/en/console/billing/topup"
        isZero={false}
      />
    )

    expect(view.getByText("Low balance")).toBeInTheDocument()
    expect(view.getByText(/IDR 5,000\.00/)).toBeInTheDocument()
  })
})
