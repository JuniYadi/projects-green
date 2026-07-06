import { describe, it, expect, beforeEach, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { BillingBalanceGateBanner } from "./billing-balance-gate-banner"

const DISMISSED_KEY = "billing-balance-banner-dismissed"

beforeEach(() => {
  localStorage.clear()
})

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
    const link = view.getByRole("link", { name: "Top up balance" })
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

  it("hides the banner when dismissed", () => {
    const view = render(
      <BillingBalanceGateBanner
        formattedBalance="IDR 0.00"
        topupUrl="/en/console/billing/topup"
        isZero
      />
    )

    // Banner visible initially
    expect(view.getByText("No balance available")).toBeInTheDocument()

    // Click dismiss
    const dismissButton = view.getByRole("button", { name: "Dismiss alert" })
    fireEvent.click(dismissButton)

    // Banner should be hidden
    expect(view.queryByText("No balance available")).not.toBeInTheDocument()
    // localStorage was written
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("true")
  })

  it("stays hidden on re-render when previously dismissed", () => {
    localStorage.setItem(DISMISSED_KEY, "true")

    const view = render(
      <BillingBalanceGateBanner
        formattedBalance="IDR 0.00"
        topupUrl="/en/console/billing/topup"
        isZero
      />
    )

    expect(view.queryByText("No balance available")).not.toBeInTheDocument()
  })

  it("places dismiss above top-up in the right action column", () => {
    const view = render(
      <BillingBalanceGateBanner
        formattedBalance="IDR 0.00"
        topupUrl="/en/console/billing/topup"
        isZero
      />
    )

    const dismissButton = view.getByRole("button", { name: "Dismiss alert" })
    const topupLink = view.getByRole("link", { name: "Top up balance" })
    const actionColumn = dismissButton.parentElement!

    expect(actionColumn).toBe(topupLink.parentElement!)
    expect(actionColumn).toHaveClass("flex")
    expect(actionColumn).toHaveClass("flex-col")
    expect(actionColumn).toHaveClass("items-end")
    expect(actionColumn).toHaveClass("gap-3")
    expect(actionColumn).toHaveClass("!right-3")

    const children = Array.from(actionColumn.children)
    expect(children.indexOf(dismissButton)).toBeLessThan(
      children.indexOf(topupLink)
    )
  })
})
