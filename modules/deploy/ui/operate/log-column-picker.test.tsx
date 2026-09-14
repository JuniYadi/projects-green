import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, mock } from "bun:test"
import { LogColumnPicker } from "./log-column-picker"

describe("LogColumnPicker", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders trigger button and shows column count badge", () => {
    const handleToggle = mock()
    const handleReset = mock()

    const { getByRole, getByText } = render(
      <LogColumnPicker
        availableFields={["http.status", "duration_ms"]}
        selectedColumns={["http.status"]}
        onToggleColumn={handleToggle}
        onResetColumns={handleReset}
      />
    )

    const trigger = getByRole("button", { name: /kolom/i })
    expect(trigger).toBeTruthy()
    expect(getByText("+1")).toBeTruthy()
  })

  it("opens popover on click and toggles field on checkbox click", () => {
    const handleToggle = mock()
    const handleReset = mock()

    const { getByRole, getByText } = render(
      <LogColumnPicker
        availableFields={["http.status", "duration_ms"]}
        selectedColumns={[]}
        onToggleColumn={handleToggle}
        onResetColumns={handleReset}
      />
    )

    const trigger = getByRole("button", { name: /kolom/i })
    fireEvent.click(trigger)

    expect(getByText("Kustomisasi Kolom Tabel")).toBeTruthy()
    expect(getByText("http.status")).toBeTruthy()
    expect(getByText("duration_ms")).toBeTruthy()

    fireEvent.click(getByText("http.status"))
    expect(handleToggle).toHaveBeenCalledWith("http.status")
  })

  it("triggers reset columns callback when reset is clicked", () => {
    const handleToggle = mock()
    const handleReset = mock()

    const { getByRole, getByTitle } = render(
      <LogColumnPicker
        availableFields={["http.status", "duration_ms"]}
        selectedColumns={["http.status"]}
        onToggleColumn={handleToggle}
        onResetColumns={handleReset}
      />
    )

    const trigger = getByRole("button", { name: /kolom/i })
    fireEvent.click(trigger)

    const resetBtn = getByTitle("Reset ke kolom bawaan")
    fireEvent.click(resetBtn)
    expect(handleReset).toHaveBeenCalledTimes(1)
  })
})
