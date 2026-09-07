import { describe, expect, it } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import { ClusterTelemetryCards } from "./cluster-telemetry-cards"

describe("ClusterTelemetryCards component", () => {
  it("renders 3 primary telemetry cards (CPU, Memory, Network I/O)", () => {
    const { getByText } = render(<ClusterTelemetryCards />)

    expect(getByText("Cluster Resource Telemetry")).toBeDefined()
    expect(getByText("CPU Utilization")).toBeDefined()
    expect(getByText("Memory Allocation")).toBeDefined()
    expect(getByText("Network I/O Throughput")).toBeDefined()
    expect(getByText(/Jakarta \(id-cgk-1\)/i)).toBeDefined()
  })

  it("allows switching time range between 1h, 6h, and 24h", () => {
    const { getByRole } = render(<ClusterTelemetryCards />)

    const btn6h = getByRole("button", { name: "6h" })
    expect(btn6h).toBeDefined()
    fireEvent.click(btn6h)

    const btn24h = getByRole("button", { name: "24h" })
    expect(btn24h).toBeDefined()
    fireEvent.click(btn24h)
  })
})
