import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

const { AdjustmentTable } = await import("./adjustment-table")

describe("AdjustmentTable", () => {
  it("renders the empty state when no adjustments are provided", () => {
    const view = render(<AdjustmentTable adjustments={[]} />)
    expect(view.getByText("No adjustments found.")).toBeTruthy()
  })

  it("renders a CREDIT USD row with positive sign, reason, and Admin label", () => {
    const view = render(
      <AdjustmentTable
        adjustments={[
          {
            id: "adj_1",
            type: "CREDIT",
            amountIdr: "12.50",
            currency: "USD",
            reason: "Refund issued",
            createdByWorkosUserId: "user_admin_1",
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ]}
      />
    )

    expect(view.getByText("CREDIT")).toBeTruthy()
    expect(view.getByText("+USD 12.50")).toBeTruthy()
    expect(view.getByText("Refund issued")).toBeTruthy()
    expect(view.getAllByText("Admin").length).toBeGreaterThan(0)
  })

  it("renders a DEBIT IDR row with negative sign, N/A reason, and System label", () => {
    const view = render(
      <AdjustmentTable
        adjustments={[
          {
            id: "adj_2",
            type: "DEBIT",
            amountIdr: "5000",
            currency: "IDR",
            reason: null,
            createdByWorkosUserId: null,
            createdAt: "2026-07-02T00:00:00.000Z",
          },
        ]}
      />
    )

    expect(view.getByText("DEBIT")).toBeTruthy()
    expect(view.getByText("-IDR 5.000,00")).toBeTruthy()
    expect(view.getByText("N/A")).toBeTruthy()
    expect(view.getByText("System")).toBeTruthy()
  })
})
