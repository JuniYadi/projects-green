import { describe, it, expect, beforeEach } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { BillingBalanceGateBanner } from "./billing-balance-gate-banner"
import { enMessages } from "@/lib/i18n/messages/en"
import { idMessages } from "@/lib/i18n/messages/id"

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
        messages={enMessages.console.billing.balanceGate}
      />
    )

    expect(view.getByText("No balance available")).toBeInTheDocument()
    expect(view.getByText(/IDR 0\.00/)).toBeInTheDocument()
    expect(
      view.getByText(
        "Your balance is IDR 0.00. Top up before purchasing a package or your purchase will be declined."
      )
    ).toBeInTheDocument()
    const link = view.getByRole("link", { name: "Top up balance" })
    expect(link).toHaveAttribute("href", "/en/console/billing/topup")
  })

  it("shows the low-balance title when not zero", () => {
    const view = render(
      <BillingBalanceGateBanner
        formattedBalance="IDR 5,000.00"
        topupUrl="/id/console/billing/topup"
        isZero={false}
        messages={idMessages.console.billing.balanceGate}
      />
    )

    expect(view.getByText("Saldo menipis")).toBeInTheDocument()
    expect(view.getByText(/IDR 5,000\.00/)).toBeInTheDocument()
    expect(view.getByRole("link", { name: "Isi ulang saldo" })).toHaveAttribute(
      "href",
      "/id/console/billing/topup"
    )
  })

  it("hides the banner when dismissed", () => {
    const view = render(
      <BillingBalanceGateBanner
        formattedBalance="IDR 0.00"
        topupUrl="/id/console/billing/topup"
        isZero
        messages={idMessages.console.billing.balanceGate}
      />
    )

    // Banner visible initially
    expect(view.getByText("Saldo tidak tersedia")).toBeInTheDocument()

    // Click dismiss
    const dismissButton = view.getByRole("button", {
      name: "Tutup peringatan",
    })
    expect(dismissButton).toHaveAttribute("title", "Tutup")
    fireEvent.click(dismissButton)

    // Banner should be hidden
    expect(view.queryByText("Saldo tidak tersedia")).not.toBeInTheDocument()
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
        messages={enMessages.console.billing.balanceGate}
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
        messages={enMessages.console.billing.balanceGate}
      />
    )

    const dismissButton = view.getByRole("button", { name: "Dismiss alert" })
    const topupLink = view.getByRole("link", { name: "Top up balance" })
    const actionColumn = dismissButton.parentElement!

    expect(actionColumn).toBe(topupLink.parentElement!)
    expect(actionColumn).toHaveClass("flex")
    expect(actionColumn).toHaveClass("flex-row")
    expect(actionColumn).toHaveClass("items-center")
    expect(actionColumn).toHaveClass("gap-2")
    expect(actionColumn).toHaveClass("!right-3")

    const children = Array.from(actionColumn.children)
    expect(children.indexOf(topupLink)).toBeLessThan(
      children.indexOf(dismissButton)
    )
  })
})
