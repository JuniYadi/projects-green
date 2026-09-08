import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { TabMetrics } from "./tab-metrics"

describe("TabMetrics", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders time-range buttons and toggles active selection", () => {
    const view = render(<TabMetrics />)

    const ranges = ["1h", "6h", "24h", "7d", "30d"] as const

    for (const range of ranges) {
      const button = view.getByRole("tab", { name: new RegExp(range, "i") })
      expect(button).toBeDefined()
    }

    const liveBtn = view.getByRole("tab", { name: /1h/i })
    expect(liveBtn.getAttribute("aria-selected")).toBe("true")
    expect(liveBtn.className).toContain("bg-primary")

    const dayBtn = view.getByRole("tab", { name: /24h/i })
    expect(dayBtn.getAttribute("aria-selected")).toBe("false")
    expect(dayBtn.className).not.toContain("bg-primary")

    fireEvent.click(dayBtn)
    expect(dayBtn.getAttribute("aria-selected")).toBe("true")
    expect(dayBtn.className).toContain("bg-primary")
    expect(liveBtn.getAttribute("aria-selected")).toBe("false")

    const weekBtn = view.getByRole("tab", { name: /7d/i })
    fireEvent.click(weekBtn)
    expect(weekBtn.getAttribute("aria-selected")).toBe("true")
    expect(dayBtn.getAttribute("aria-selected")).toBe("false")

    const monthBtn = view.getByRole("tab", { name: /30d/i })
    fireEvent.click(monthBtn)
    expect(monthBtn.getAttribute("aria-selected")).toBe("true")
    expect(weekBtn.getAttribute("aria-selected")).toBe("false")

    const sixHourBtn = view.getByRole("tab", { name: /6h/i })
    fireEvent.click(sixHourBtn)
    expect(sixHourBtn.getAttribute("aria-selected")).toBe("true")
    expect(monthBtn.getAttribute("aria-selected")).toBe("false")
  })

  it("renders latency percentiles (p50, p95, p99) and updates with time range", () => {
    const view = render(<TabMetrics />)

    expect(view.getByText("Latency Percentiles")).toBeDefined()
    expect(view.getByText("p50 Median")).toBeDefined()
    expect(view.getByText("p95 Threshold")).toBeDefined()
    expect(view.getByText("p99 Tail Latency")).toBeDefined()

    expect(view.getByText("42ms")).toBeDefined()
    expect(view.getByText("128ms")).toBeDefined()
    expect(view.getByText("210ms")).toBeDefined()

    const dayBtn = view.getByRole("tab", { name: /24h/i })
    fireEvent.click(dayBtn)

    expect(view.getByText("48ms")).toBeDefined()
    expect(view.getByText("142ms")).toBeDefined()
    expect(view.getByText("240ms")).toBeDefined()
  })

  it("renders HTTP status and error rate distribution and updates with time range", () => {
    const view = render(<TabMetrics />)

    expect(view.getByText("HTTP Status & Error Rate")).toBeDefined()
    expect(view.getAllByText("142.8k requests").length).toBeGreaterThan(0)
    expect(view.getByText(/2xx Successful \(98\.6%\)/)).toBeDefined()
    expect(view.getByText(/4xx Client Errors \(1\.1%\)/)).toBeDefined()
    expect(view.getByText(/5xx Server Errors \(0\.3%\)/)).toBeDefined()

    const weekBtn = view.getByRole("tab", { name: /7d/i })
    fireEvent.click(weekBtn)

    expect(view.getAllByText("21.8M requests").length).toBeGreaterThan(0)
    expect(view.getByText(/2xx Successful \(98\.2%\)/)).toBeDefined()
    expect(view.getByText(/4xx Client Errors \(1\.5%\)/)).toBeDefined()
  })

  it("contains zero occurrences of text-white, border-white, or bg-[#0A0A0C] tokens", () => {
    const filePath = resolve(__dirname, "tab-metrics.tsx")
    const sourceCode = readFileSync(filePath, "utf-8")

    expect(sourceCode).not.toContain("text-white")
    expect(sourceCode).not.toContain("border-white")
    expect(sourceCode).not.toContain("#0A0A0C")
    expect(sourceCode).not.toContain("dark:bg-black/30")
    expect(sourceCode).not.toContain("dark:bg-black/60")

    const view = render(<TabMetrics />)
    const html = view.container.innerHTML

    expect(html).not.toContain("text-white")
    expect(html).not.toContain("border-white")
    expect(html).not.toContain("#0A0A0C")
    expect(html).not.toContain("bg-black")
  })

  it("renders CPU, RAM telemetry and resource advisory with customized limits", () => {
    const view = render(<TabMetrics cpuLimit="2000m" memLimit="1024Mi" />)

    expect(view.getByText("Live Resource Monitoring")).toBeDefined()
    expect(view.getByText("CPU Allocation")).toBeDefined()
    expect(view.getByText("RAM Allocation")).toBeDefined()
    expect(view.getByText("Network Ingress")).toBeDefined()
    expect(view.getByText("Resource Advisory")).toBeDefined()
    expect(view.getByText("Low RAM Headroom")).toBeDefined()
    expect(view.getByText("CPU Headroom Adequate")).toBeDefined()
    expect(view.getAllByText(/Limit: 2000m/).length).toBeGreaterThan(0)
    expect(view.getAllByText(/Limit: 1024Mi/).length).toBeGreaterThan(0)
  })

  it("renders live workload telemetry and pod quota table when appSlug is provided", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={client}>
        <TabMetrics appSlug="hermes-vibrant-comet" />
      </QueryClientProvider>
    )

    expect(view.getByText("Workload Observability")).toBeDefined()
    expect(view.getByText("Per-Pod Workload Breakdown")).toBeDefined()
    expect(
      view.getByText("Pod Replica Health & Resource Allocation")
    ).toBeDefined()
    expect(view.getByText("CPU Usage per Pod")).toBeDefined()
    expect(view.getByText("RAM Working Set per Pod")).toBeDefined()
    expect(view.getByText("Network Ingress per Pod")).toBeDefined()
    expect(view.getByText("Filter Pod:")).toBeDefined()
    expect(view.getByText("Resource Advisory")).toBeDefined()
    expect(view.getByText("Latency Percentiles")).toBeDefined()
    expect(view.getByText("HTTP Status & Error Rate")).toBeDefined()
  })

  it("filters per-pod charts when clicking a specific pod filter pill", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={client}>
        <TabMetrics appSlug="hermes-vibrant-comet" />
      </QueryClientProvider>
    )

    const allPodsBtn = view.getByRole("button", { name: /All Pods/i })
    expect(allPodsBtn).toBeDefined()
    expect(allPodsBtn.className).toContain("bg-primary")

    const podPills = view.getAllByRole("button", {
      name: /hermes-vibrant-comet/i,
    })
    expect(podPills.length).toBeGreaterThan(0)

    fireEvent.click(podPills[0])
    expect(podPills[0].className).toContain("bg-secondary")
    expect(allPodsBtn.className).not.toContain("bg-primary")
  })

  it("switches to HTTP Traffic sub-tab and renders Edge L7 metrics without HAProxy labels", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={client}>
        <TabMetrics appSlug="hermes-vibrant-comet" />
      </QueryClientProvider>
    )

    const computeTabBtn = view.getByRole("button", { name: /^Compute/i })
    const httpTrafficBtn = view.getByRole("button", { name: /HTTP Traffic/i })
    expect(computeTabBtn).toBeDefined()
    expect(httpTrafficBtn).toBeDefined()

    // Default is Compute with Per-Pod Workload Breakdown inside
    expect(view.getByText(/Per-Pod Workload Breakdown/i)).toBeDefined()
    expect(
      view.getByText(/Pod Replica Health & Resource Allocation/i)
    ).toBeDefined()

    // Switch to HTTP Traffic
    fireEvent.click(httpTrafficBtn)

    expect(view.getByText(/Service Traffic/i)).toBeDefined()
    expect(view.getByText(/Grouped HTTP Response Codes/i)).toBeDefined()
    expect(view.getByText(/Latency Breakdown/i)).toBeDefined()
    expect(view.getByText(/Edge Ingress Gateway/i)).toBeDefined()

    // Ensure no HAProxy label is shown
    expect(view.queryByText(/HAProxy/i)).toBeNull()

    // Switch back to Compute
    fireEvent.click(computeTabBtn)
    expect(view.getByText(/Per-Pod Workload Breakdown/i)).toBeDefined()
    expect(
      view.getByText(/Pod Replica Health & Resource Allocation/i)
    ).toBeDefined()
  })
})
