import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { PodMultiSeriesSparkline } from "./pod-multi-series-sparkline"

describe("PodMultiSeriesSparkline", () => {
  it("renders multi-series paths and legend for multiple pods", () => {
    const view = render(
      <PodMultiSeriesSparkline
        labels={["01:00", "01:30", "02:00"]}
        unit="vCPU"
        limit={1.0}
        series={[
          {
            id: "pod-0",
            name: "hermes-deploy-0",
            color: "#10b981",
            values: [0.12, 0.18, 0.15],
          },
          {
            id: "pod-1",
            name: "hermes-deploy-1",
            color: "#38bdf8",
            values: [0.05, 0.08, 0.06],
          },
        ]}
      />
    )

    expect(view.getByText(/hermes-deploy-0/)).toBeDefined()
    expect(view.getByText(/hermes-deploy-1/)).toBeDefined()
    expect(view.getByText(/Limit: 1/)).toBeDefined()
    expect(view.getByText("01:00")).toBeDefined()
    expect(view.getByText("02:00")).toBeDefined()
  })

  it("handles empty series cleanly without crashing", () => {
    const view = render(<PodMultiSeriesSparkline labels={[]} series={[]} />)
    expect(view.getByText("No telemetry data available")).toBeDefined()
  })
})
