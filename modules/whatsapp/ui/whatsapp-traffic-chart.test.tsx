import { describe, expect, it } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import {
  WhatsAppTrafficChart,
  type WhatsAppDailyTraffic,
} from "./whatsapp-traffic-chart"

const mockData: WhatsAppDailyTraffic[] = [
  { date: "2026-09-02", messageInboxCount: 5, messageOutboxCount: 15 },
  { date: "2026-09-03", messageInboxCount: 8, messageOutboxCount: 22 },
  { date: "2026-09-04", messageInboxCount: 12, messageOutboxCount: 18 },
  { date: "2026-09-05", messageInboxCount: 3, messageOutboxCount: 7 },
]

describe("WhatsAppTrafficChart component", () => {
  it("renders pure-SVG dual-series paths with linearGradient defs", () => {
    const view = render(<WhatsAppTrafficChart data={mockData} locale="id" />)

    const svg = view.container.querySelector("svg")
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute("viewBox")).toBe("0 0 400 100")

    // linearGradient
    const linearGradient = view.container.querySelector("linearGradient")
    expect(linearGradient).toBeTruthy()
    const gradientId = linearGradient?.getAttribute("id")
    expect(gradientId).toContain("whatsapp-traffic-grad-")

    // primary area path
    const areaPath = view.getByTestId("traffic-primary-area")
    expect(areaPath).toBeTruthy()
    expect(areaPath.getAttribute("fill")).toBe(`url(#${gradientId})`)
    expect(areaPath.getAttribute("d")).toContain("L 400,100 L 0,100 Z")

    // primary line path (Inbound)
    const primaryLine = view.getByTestId("traffic-primary-line")
    expect(primaryLine).toBeTruthy()
    expect(primaryLine.getAttribute("stroke")).toBe("#10b981")

    // secondary line path (Outbound)
    const secondaryLine = view.getByTestId("traffic-secondary-line")
    expect(secondaryLine).toBeTruthy()
    expect(secondaryLine.getAttribute("stroke")).toBe("#38bdf8")
  })

  it("renders numerical Y-axis scale and horizontal grid guide lines", () => {
    const view = render(<WhatsAppTrafficChart data={mockData} locale="id" />)

    const yAxis = view.getByTestId("traffic-y-axis")
    expect(yAxis).toBeTruthy()
    // mockData max is 22 (niceScale -> max: 50, mid: 25)
    expect(yAxis.textContent).toContain("50")
    expect(yAxis.textContent).toContain("25")
    expect(yAxis.textContent).toContain("0")

    // horizontal grid lines
    expect(view.getByTestId("traffic-grid-top")).toBeTruthy()
    expect(view.getByTestId("traffic-grid-mid")).toBeTruthy()
    expect(view.getByTestId("traffic-grid-base")).toBeTruthy()
  })

  it("renders ticks with first, middle, and last labels cleanly outside SVG", () => {
    const view = render(<WhatsAppTrafficChart data={mockData} locale="en" />)

    const ticks = view.getByTestId("traffic-chart-ticks")
    expect(ticks).toBeTruthy()
    // 4 items: first = Sep 2, middle (idx 2) = Sep 4, last = Sep 5
    expect(ticks.textContent).toContain("Sep 2")
    expect(ticks.textContent).toContain("Sep 4")
    expect(ticks.textContent).toContain("Sep 5")
  })

  it("supports explicit label property on data items", () => {
    const labeledData: WhatsAppDailyTraffic[] = [
      {
        date: "2026-09-01",
        label: "Start",
        messageInboxCount: 10,
        messageOutboxCount: 20,
      },
      {
        date: "2026-09-02",
        label: "Mid",
        messageInboxCount: 15,
        messageOutboxCount: 25,
      },
      {
        date: "2026-09-03",
        label: "End",
        messageInboxCount: 5,
        messageOutboxCount: 10,
      },
    ]

    const view = render(<WhatsAppTrafficChart data={labeledData} locale="en" />)
    const ticks = view.getByTestId("traffic-chart-ticks")
    expect(ticks.textContent).toContain("Start")
    expect(ticks.textContent).toContain("Mid")
    expect(ticks.textContent).toContain("End")
  })

  it("handles hover interaction to display crosshair, markers, and exact tooltip counts", () => {
    const view = render(<WhatsAppTrafficChart data={mockData} locale="id" />)

    const slice0 = view.getByTestId("traffic-slice-0")
    expect(slice0).toBeTruthy()

    // Hover first slice
    fireEvent.mouseEnter(slice0)

    const tooltip = view.getByTestId("traffic-tooltip")
    expect(tooltip.textContent).toContain("Masuk")
    expect(tooltip.textContent).toContain("5")
    expect(tooltip.textContent).toContain("Keluar")
    expect(tooltip.textContent).toContain("15")

    // Crosshair and circle markers
    const crosshair = view.getByTestId("traffic-crosshair")
    expect(crosshair).toBeTruthy()
    const inboundMarker = view.getByTestId("traffic-inbound-marker")
    const outboundMarker = view.getByTestId("traffic-outbound-marker")
    expect(inboundMarker).toBeTruthy()
    expect(outboundMarker).toBeTruthy()

    // Mouse leave chart resets hover
    const chartWrapper = view.container.querySelector("div.relative")
    if (chartWrapper) {
      fireEvent.mouseLeave(chartWrapper)
      expect(view.queryByTestId("traffic-tooltip")).toBeNull()
      expect(view.queryByTestId("traffic-crosshair")).toBeNull()
    }
  })

  it("renders empty state gracefully when data is empty or all counts are 0", () => {
    const emptyView = render(<WhatsAppTrafficChart data={[]} locale="id" />)
    expect(emptyView.getByText("Belum ada data trafik")).toBeDefined()

    const zeroView = render(
      <WhatsAppTrafficChart
        data={[
          { date: "2026-09-01", messageInboxCount: 0, messageOutboxCount: 0 },
          { date: "2026-09-02", messageInboxCount: 0, messageOutboxCount: 0 },
        ]}
        locale="en"
      />
    )
    expect(zeroView.getByText("No traffic data")).toBeDefined()
  })

  it("renders single data point gracefully without SVG NaN errors", () => {
    const singleData: WhatsAppDailyTraffic[] = [
      { date: "2026-09-01", messageInboxCount: 10, messageOutboxCount: 5 },
    ]

    const view = render(<WhatsAppTrafficChart data={singleData} locale="en" />)
    const primaryLine = view.getByTestId("traffic-primary-line")
    const d = primaryLine.getAttribute("d")
    expect(d).toBeTruthy()
    expect(d).not.toContain("NaN")
  })
})
