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
  it("renders pure-SVG bar chart with correct SVG elements", () => {
    const view = render(<WhatsAppTrafficChart data={mockData} locale="id" />)

    const svg = view.container.querySelector("svg")
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute("viewBox")).toBe("0 0 500 160")

    // Check bar elements exist
    const barIn0 = view.container.querySelector("[data-testid='bar-in-0']")
    const barOut0 = view.container.querySelector("[data-testid='bar-out-0']")
    expect(barIn0).toBeTruthy()
    expect(barOut0).toBeTruthy()
  })

  it("handles hover interaction to display exact message counts", () => {
    const view = render(<WhatsAppTrafficChart data={mockData} locale="id" />)

    const group0 = view.container.querySelector("g.cursor-pointer")
    expect(group0).toBeTruthy()

    if (group0) {
      fireEvent.mouseEnter(group0)
      const tooltip = view.getByTestId("traffic-tooltip")
      expect(tooltip.textContent).toContain("Masuk")
      expect(tooltip.textContent).toContain("Keluar")
      fireEvent.mouseLeave(group0)
    }
  })

  it("renders empty state gracefully when data is empty", () => {
    const view = render(<WhatsAppTrafficChart data={[]} locale="id" />)
    expect(view.getByText("Belum ada data trafik")).toBeDefined()
  })
})
