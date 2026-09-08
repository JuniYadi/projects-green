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

  it("renders live workload telemetry and pod replicas table when appSlug is provided", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={client}>
        <TabMetrics appSlug="hermes-vibrant-comet" />
      </QueryClientProvider>
    )

    expect(view.getByText("Workload Observability")).toBeDefined()
    expect(view.getByText("Pod Replicas & Health")).toBeDefined()
    expect(view.getByText("CPU Usage per Pod")).toBeDefined()
    expect(view.getByText("RAM Working Set per Pod")).toBeDefined()
    expect(view.getByText("Network Ingress per Pod")).toBeDefined()
    expect(view.queryByText("Filter Pod:")).toBeNull()
    expect(view.getByText("Resource Advisory")).toBeDefined()
    expect(view.getByText("Latency Percentiles")).toBeDefined()
    expect(view.getByText("HTTP Status & Error Rate")).toBeDefined()
  })

  it("renders pod replica selector when multiple pods are present", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(
      [
        "deploy",
        "pod-telemetry",
        "compute",
        { type: "preset", preset: "1h" },
        "sgp",
        "UTC",
        "hermes-vibrant-comet",
      ],
      {
        clusterId: "sgp",
        clusterName: "Singapore",
        region: "Singapore",
        isPrimary: true,
        timeRange: "1h",
        points: [],
        cpu: {
          currentCores: 0.1,
          limitCores: 1,
          avgCores: 0.1,
          peakCores: 0.2,
        },
        memory: {
          currentBytes: 1000,
          limitBytes: 2000,
          avgBytes: 1000,
          peakBytes: 1500,
        },
        network: {
          currentRxBytes: 10,
          currentTxBytes: 20,
          totalRxBytes: 100,
          totalTxBytes: 200,
        },
        pods: [
          {
            pod: "hermes-vibrant-comet-deploy-0",
            status: "Running",
            cpuUsageCores: 0.1,
            cpuLimitCores: 1,
            cpuPercent: 10,
            memoryUsageBytes: 100,
            memoryLimitBytes: 1000,
            memoryPercent: 10,
            restarts: 0,
          },
          {
            pod: "hermes-vibrant-comet-deploy-1",
            status: "Running",
            cpuUsageCores: 0.1,
            cpuLimitCores: 1,
            cpuPercent: 10,
            memoryUsageBytes: 100,
            memoryLimitBytes: 1000,
            memoryPercent: 10,
            restarts: 0,
          },
        ],
      }
    )
    const view = render(
      <QueryClientProvider client={client}>
        <TabMetrics appSlug="hermes-vibrant-comet" />
      </QueryClientProvider>
    )

    const allBtn = view.getByRole("button", { name: /All \(2\)/i })
    expect(allBtn).toBeDefined()
    expect(allBtn.className).toContain("bg-primary")

    const pod1Btn = view.getByRole("button", {
      name: /hermes-vibrant-comet-deploy-1/i,
    })
    expect(pod1Btn).toBeDefined()
    fireEvent.click(pod1Btn)
    expect(pod1Btn.className).toContain("bg-secondary")
    expect(allBtn.className).not.toContain("bg-primary")
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

    // Default is Compute with Pod Replicas & Health
    expect(view.getByText(/Pod Replicas & Health/i)).toBeDefined()

    // Switch to HTTP Traffic
    fireEvent.click(httpTrafficBtn)

    expect(view.getByText(/Service Traffic/i)).toBeDefined()
    expect(view.getByText(/Grouped HTTP Response Codes/i)).toBeDefined()
    expect(view.getByText(/Latency Breakdown/i)).toBeDefined()
    // Ensure internal plumbing / gateway routing noise is hidden
    expect(view.queryByText(/Edge Ingress Gateway/i)).toBeNull()
    expect(view.queryByText(/Routing Service/i)).toBeNull()
    expect(view.queryByText(/HAProxy/i)).toBeNull()

    // Switch back to Compute
    fireEvent.click(computeTabBtn)
    expect(view.getByText(/Pod Replicas & Health/i)).toBeDefined()
  })
})
