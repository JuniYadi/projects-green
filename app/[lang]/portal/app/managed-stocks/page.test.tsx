import { describe, expect, it, mock } from "bun:test"
import { render, screen } from "@testing-library/react"

mock.module("@/components/deploy/managed-stocks-list", () => ({
  ManagedStocksList: () => (
    <div data-testid="managed-stocks-list">Stocks List</div>
  ),
}))

describe("ManagedStocksPage", () => {
  it("renders page header and list component", async () => {
    // Test boundary: dynamic import required after mock.module setup
    const pageModule =
      await import("@/app/[lang]/portal/app/managed-stocks/page")
    render(<pageModule.default />)

    expect(screen.getByText("Managed Database Stock Pool")).toBeTruthy()
    expect(
      screen.getByText(
        "Import and manage pre-provisioned database slots for 1-click app deployments."
      )
    ).toBeTruthy()
    expect(screen.getByTestId("managed-stocks-list")).toBeTruthy()
  })
})
