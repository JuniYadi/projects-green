import "@/test/register"
import { describe, expect, it } from "bun:test"
import { render, screen } from "@testing-library/react"
import { QuotaProgressBar } from "./quota-progress-bar"

describe("QuotaProgressBar", () => {
  it("renders used and total values with labels", () => {
    render(
      <QuotaProgressBar
        used={500}
        total={1000}
        label="Monthly Messages"
        usedLabel="terpakai"
        quotaLabel="kuota"
      />
    )

    expect(screen.getByText("Monthly Messages")).toBeDefined()
    expect(screen.getByText("50%")).toBeDefined()
    expect(screen.getByText("500 terpakai")).toBeDefined()
    expect(screen.getByText("1,000 kuota")).toBeDefined()
  })

  it("handles zero total gracefully", () => {
    render(<QuotaProgressBar used={0} total={0} label="Zero Quota" />)

    expect(screen.getByText("Zero Quota")).toBeDefined()
    expect(screen.getByText("0%")).toBeDefined()
  })

  it("renders correctly above 100 percent", () => {
    render(<QuotaProgressBar used={1200} total={1000} label="Over Quota" />)

    expect(screen.getByText("Over Quota")).toBeDefined()
    expect(screen.getByText("100%")).toBeDefined()
  })

  it("hides percent indicator when showPercent is false", () => {
    render(
      <QuotaProgressBar
        used={250}
        total={1000}
        label="Hidden Percent"
        showPercent={false}
      />
    )

    expect(screen.getByText("Hidden Percent")).toBeDefined()
    expect(screen.queryByText("25%")).toBeNull()
  })
})
