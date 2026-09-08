import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
import * as React from "react"

import { TimeRangeDropdown } from "./time-range-dropdown"
import { type TimeRangeSelection, format24hDateTime } from "@/lib/time-range"

describe("TimeRangeDropdown (Grafana Style)", () => {
  it("renders trigger with current preset label", () => {
    const value: TimeRangeSelection = { type: "preset", preset: "1h" }
    const onChange = mock(() => {})

    const { getByText } = render(
      <TimeRangeDropdown value={value} onChange={onChange} />
    )

    expect(getByText("Last 1 hour")).toBeInTheDocument()
  })

  it("renders trigger with custom range formatted label", () => {
    const fromSec = 1788860000
    const toSec = 1788867200
    const value: TimeRangeSelection = {
      type: "custom",
      from: fromSec,
      to: toSec,
    }
    const onChange = mock(() => {})

    const expectedLabel = `${format24hDateTime(fromSec * 1000)} - ${format24hDateTime(toSec * 1000)}`

    const { getByText } = render(
      <TimeRangeDropdown value={value} onChange={onChange} />
    )

    expect(getByText(expectedLabel)).toBeInTheDocument()
  })

  it("disables trigger button when disabled prop is true", () => {
    const value: TimeRangeSelection = { type: "preset", preset: "1h" }
    const onChange = mock(() => {})

    const { getByRole } = render(
      <TimeRangeDropdown value={value} onChange={onChange} disabled={true} />
    )

    const trigger = getByRole("button", { name: /Last 1 hour/i })
    expect(trigger).toBeDisabled()
  })

  it("opens Grafana popover on click and selecting a preset calls onChange", () => {
    const value: TimeRangeSelection = { type: "preset", preset: "1h" }
    const onChange = mock(() => {})

    const { getByText, getAllByText } = render(
      <TimeRangeDropdown value={value} onChange={onChange} />
    )

    const trigger = getByText("Last 1 hour")
    fireEvent.click(trigger)

    expect(getByText("Absolute time range")).toBeInTheDocument()

    const presetOption = getAllByText("Last 5 minutes")[0]
    fireEvent.click(presetOption)

    expect(onChange).toHaveBeenCalledWith({
      type: "preset",
      preset: "5m",
    })
  })

  it("applies custom range from the popover inputs", () => {
    const value: TimeRangeSelection = { type: "preset", preset: "1h" }
    const onChange = mock(() => {})

    const { getByText, getByLabelText } = render(
      <TimeRangeDropdown value={value} onChange={onChange} />
    )

    const trigger = getByText("Last 1 hour")
    fireEvent.click(trigger)

    const fromInput = getByLabelText("From") as HTMLInputElement
    const toInput = getByLabelText("To") as HTMLInputElement

    fireEvent.change(fromInput, { target: { value: "2026-09-08T10:00" } })
    fireEvent.change(toInput, { target: { value: "2026-09-08T12:00" } })

    const applyButton = getByText("Apply time range")
    fireEvent.click(applyButton)

    const expectedFrom = Math.floor(
      new Date("2026-09-08T10:00").getTime() / 1000
    )
    const expectedTo = Math.floor(new Date("2026-09-08T12:00").getTime() / 1000)

    expect(onChange).toHaveBeenCalledWith({
      type: "custom",
      from: expectedFrom,
      to: expectedTo,
    })
  })

  it("renders manual refresh button and calls onRefresh when clicked", () => {
    const value: TimeRangeSelection = { type: "preset", preset: "1h" }
    const onChange = mock(() => {})
    const onRefresh = mock(() => {})

    const { getByTestId } = render(
      <TimeRangeDropdown
        value={value}
        onChange={onChange}
        onRefresh={onRefresh}
      />
    )

    const refreshBtn = getByTestId("telemetry-refresh-button")
    expect(refreshBtn).toBeInTheDocument()

    fireEvent.click(refreshBtn)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it("renders auto-refresh dropdown with current interval label", () => {
    const value: TimeRangeSelection = { type: "preset", preset: "1h" }
    const onChange = mock(() => {})
    const onIntervalChange = mock(() => {})

    const { getByTestId, getByText } = render(
      <TimeRangeDropdown
        value={value}
        onChange={onChange}
        refreshInterval={30_000}
        onRefreshIntervalChange={onIntervalChange}
      />
    )

    const trigger = getByTestId("auto-refresh-trigger")
    expect(trigger).toBeInTheDocument()
    expect(getByText("30s")).toBeInTheDocument()
  })
})
