import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import {
  ClusterTelemetrySparkline,
  type SparklineDataPoint,
} from "./cluster-telemetry-sparkline"

const mockData: SparklineDataPoint[] = [
  { label: "13:00", value: 120, limit: 500 },
  { label: "13:10", value: 240, limit: 500 },
  { label: "13:20", value: 180, limit: 500 },
  { label: "13:30", value: 310, limit: 500 },
  { label: "13:40", value: 290, limit: 500 },
]

const mockDualData: SparklineDataPoint[] = [
  { label: "10:00", value: 50, secondaryValue: 20 },
  { label: "10:15", value: 80, secondaryValue: 45 },
  { label: "10:30", value: 65, secondaryValue: 30 },
]

describe("ClusterTelemetrySparkline", () => {
  it("renders svg and paths correctly with standard test points", () => {
    const view = render(<ClusterTelemetrySparkline data={mockData} />)

    const svg = view.container.querySelector("svg")
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute("viewBox")).toBe("0 0 400 100")
    expect(svg?.getAttribute("width")).toBe("100%")

    // Verify paths (area + primary line)
    const paths = view.container.querySelectorAll("path")
    expect(paths.length).toBeGreaterThanOrEqual(2)

    const primaryLine = view.container.querySelector(
      "[data-testid='sparkline-primary-line']"
    )
    expect(primaryLine).toBeTruthy()
    expect(primaryLine?.getAttribute("stroke")).toBe("#10b981")

    const area = view.container.querySelector("[data-testid='sparkline-area']")
    expect(area).toBeTruthy()

    // Verify gradient in defs
    const gradient = view.container.querySelector("linearGradient")
    expect(gradient).toBeTruthy()
  })

  it("renders first, middle, and last labels in the DOM", () => {
    const view = render(<ClusterTelemetrySparkline data={mockData} />)

    const ticks = view.container.querySelector(
      "[data-testid='sparkline-ticks']"
    )
    expect(ticks?.textContent).toContain("13:00")
    expect(ticks?.textContent).toContain("13:20")
    expect(ticks?.textContent).toContain("13:40")
  })

  it("renders dual-line mode with secondaryValue", () => {
    const view = render(
      <ClusterTelemetrySparkline
        data={mockDualData}
        color="#10b981"
        secondaryColor="#38bdf8"
      />
    )

    const primaryLine = view.container.querySelector(
      "[data-testid='sparkline-primary-line']"
    )
    expect(primaryLine).toBeTruthy()
    expect(primaryLine?.getAttribute("stroke")).toBe("#10b981")

    const secondaryLine = view.container.querySelector(
      "[data-testid='sparkline-secondary-line']"
    )
    expect(secondaryLine).toBeTruthy()
    expect(secondaryLine?.getAttribute("stroke")).toBe("#38bdf8")
  })

  it("renders dashed limit line when showLimitLine is true and limit is provided", () => {
    const view = render(
      <ClusterTelemetrySparkline data={mockData} showLimitLine={true} />
    )

    const limitLine = view.container.querySelector(
      "[data-testid='sparkline-limit-line']"
    )
    expect(limitLine).toBeTruthy()
    expect(limitLine?.getAttribute("stroke-dasharray")).toBe("4 4")
  })

  it("does not render limit line when showLimitLine is false", () => {
    const view = render(
      <ClusterTelemetrySparkline data={mockData} showLimitLine={false} />
    )

    const limitLine = view.container.querySelector(
      "[data-testid='sparkline-limit-line']"
    )
    expect(limitLine).toBeNull()
  })

  it("omits area fill when showArea is false", () => {
    const view = render(
      <ClusterTelemetrySparkline data={mockData} showArea={false} />
    )

    const area = view.container.querySelector("[data-testid='sparkline-area']")
    expect(area).toBeNull()

    const gradient = view.container.querySelector("linearGradient")
    expect(gradient).toBeNull()

    // Primary line should still be present
    const primaryLine = view.container.querySelector(
      "[data-testid='sparkline-primary-line']"
    )
    expect(primaryLine).toBeTruthy()
  })

  it("handles empty data gracefully", () => {
    const view = render(<ClusterTelemetrySparkline data={[]} />)
    expect(view.getByText("No telemetry data")).toBeTruthy()
    expect(view.container.querySelector("svg")).toBeNull()
  })

  it("handles single-point data without crashing", () => {
    const singleData: SparklineDataPoint[] = [{ label: "12:00", value: 100 }]
    const view = render(<ClusterTelemetrySparkline data={singleData} />)

    const svg = view.container.querySelector("svg")
    expect(svg).toBeTruthy()
    expect(view.getByText("12:00")).toBeTruthy()

    const primaryLine = view.container.querySelector(
      "[data-testid='sparkline-primary-line']"
    )
    expect(primaryLine).toBeTruthy()
  })

  it("applies custom height and colors", () => {
    const view = render(
      <ClusterTelemetrySparkline data={mockData} height={150} color="#f43f5e" />
    )

    const primaryLine = view.container.querySelector(
      "[data-testid='sparkline-primary-line']"
    )
    expect(primaryLine?.getAttribute("stroke")).toBe("#f43f5e")

    const wrapper = view.container.querySelector(".relative") as HTMLElement
    expect(wrapper?.style.height).toBe("150px")
  })

  describe("Y-axis scale and gridlines", () => {
    it("renders sparkline-y-axis by default when showYAxis is true or omitted", () => {
      const view = render(
        <ClusterTelemetrySparkline data={mockData} unit="vCPU" />
      )
      const yAxis = view.container.querySelector(
        "[data-testid='sparkline-y-axis']"
      )
      expect(yAxis).toBeTruthy()
    })

    it("renders numeric tick values and unit in Y-axis labels", () => {
      const view = render(
        <ClusterTelemetrySparkline
          data={mockData}
          unit="vCPU"
          showYAxis={true}
        />
      )
      const yAxis = view.container.querySelector(
        "[data-testid='sparkline-y-axis']"
      )
      expect(yAxis).toBeTruthy()
      expect(yAxis?.textContent).toContain("500 vCPU")
      expect(yAxis?.textContent).toContain("0")
    })

    it("does not render horizontal gridlines by default", () => {
      const view = render(<ClusterTelemetrySparkline data={mockData} />)
      const gridLines = view.container.querySelectorAll(
        "[data-testid='sparkline-grid-line']"
      )
      expect(gridLines.length).toBe(0)
    })

    it("renders horizontal reference gridlines when showGridLines is true", () => {
      const view = render(
        <ClusterTelemetrySparkline
          data={mockData}
          yAxisTicks={5}
          showYAxis={true}
          showGridLines={true}
        />
      )
      const gridLines = view.container.querySelectorAll(
        "[data-testid='sparkline-grid-line']"
      )
      expect(gridLines.length).toBe(5)
      gridLines.forEach((line) => {
        expect(line.getAttribute("x1")).toBe("0")
        expect(line.getAttribute("x2")).toBe("400")
        expect(line.getAttribute("stroke-dasharray")).toBe("3 3")
      })
    })
    it("hides sparkline-y-axis when showYAxis is false", () => {
      const view = render(
        <ClusterTelemetrySparkline data={mockData} showYAxis={false} />
      )
      const yAxis = view.container.querySelector(
        "[data-testid='sparkline-y-axis']"
      )
      expect(yAxis).toBeNull()
    })
  })
})
