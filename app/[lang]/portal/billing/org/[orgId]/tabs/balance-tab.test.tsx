import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

const orgDetail = {
  ok: true as const,
  org: {
    orgId: "org_usd",
    orgName: "USD Org",
    balance: "5000.00",
    currency: "USD",
    status: "ACTIVE",
    createdAt: "2026-07-01T00:00:00.000Z",
    subscriptions: [],
    contacts: 0,
    monthlySpend: "0.00",
    recentInvoices: [],
  },
}

const { BalanceTab } = await import("./balance-tab")

describe("BalanceTab", () => {
  it("renders a healthy USD balance with green color and no warning", () => {
    const view = render(
      <BalanceTab
        orgId="org_usd"
        orgDetail={{
          ...orgDetail,
          org: { ...orgDetail.org, balance: "5000.00" },
        }}
      />
    )

    expect(view.getByText("USD 5,000.00")).toBeTruthy()
    const balanceEl = view.container.querySelector(".text-3xl")
    expect(balanceEl?.className).toMatch(/text-green-600|dark:text-green-400/)
    expect(view.queryByText("Balance is running low")).toBeNull()
  })

  it("renders the low-balance warning for a small USD balance", () => {
    const view = render(
      <BalanceTab
        orgId="org_usd"
        orgDetail={{
          ...orgDetail,
          org: { ...orgDetail.org, balance: "0.50" },
        }}
      />
    )

    expect(view.getByText("USD 0.50")).toBeTruthy()
    expect(
      view.getByText(
        "Balance is running low. Top up to avoid service interruption."
      )
    ).toBeTruthy()
  })

  it("renders the empty invoices state for an IDR org", () => {
    const view = render(
      <BalanceTab
        orgId="org_idr"
        orgDetail={{
          ...orgDetail,
          org: {
            ...orgDetail.org,
            orgId: "org_idr",
            currency: "IDR",
            balance: "50000.00",
            recentInvoices: [],
          },
        }}
      />
    )

    expect(view.getByText("No invoices found.")).toBeTruthy()
  })
})
