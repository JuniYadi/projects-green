import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { BalanceCard } from "./balance-card"

describe("BalanceCard", () => {
  const defaultProps = {
    balanceIdr: "100000.00",
    formattedBalance: "IDR 100,000.00",
    isAboveWarn: true,
    accountAge: "5 days",
  }

  it("renders balance with correct formatted value", () => {
    const { getByText } = render(<BalanceCard {...defaultProps} />)

    expect(getByText("IDR 100,000.00")).toBeInTheDocument()
  })

  it("renders account age", () => {
    const { getByText } = render(<BalanceCard {...defaultProps} />)

    expect(getByText("Account age: 5 days")).toBeInTheDocument()
  })

  it("does not show warning when isAboveWarn is true", () => {
    const { queryByText } = render(<BalanceCard {...defaultProps} />)

    expect(
      queryByText(/Your balance is running low/i)
    ).not.toBeInTheDocument()
  })

  it("shows warning banner when isAboveWarn is false", () => {
    const { getByText } = render(
      <BalanceCard {...defaultProps} isAboveWarn={false} />
    )

    expect(getByText(/Your balance is running low/i)).toBeInTheDocument()
  })

  it("applies green color for balance >= 10,000", () => {
    const { getByText } = render(<BalanceCard {...defaultProps} />)

    const balance = getByText("IDR 100,000.00")
    expect(balance.className).toContain("green")
  })

  it("applies yellow color for balance between 1,000 and 10,000", () => {
    const { getByText } = render(
      <BalanceCard
        {...defaultProps}
        balanceIdr="5000.00"
        formattedBalance="IDR 5,000.00"
      />
    )

    const balance = getByText("IDR 5,000.00")
    expect(balance.className).toContain("yellow")
  })

  it("applies red color for balance < 1,000", () => {
    const { getByText } = render(
      <BalanceCard
        {...defaultProps}
        balanceIdr="500.00"
        formattedBalance="IDR 500.00"
      />
    )

    const balance = getByText("IDR 500.00")
    expect(balance.className).toContain("red")
  })
})
