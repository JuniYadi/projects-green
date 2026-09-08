import { describe, expect, it, mock, afterEach } from "bun:test"
import {
  cleanup as rtlCleanup,
  render,
  fireEvent,
  waitFor,
} from "@testing-library/react"
import { generateClusterTelemetrySummary } from "@/modules/deploy/telemetry.service"

const mockTelemetryGet = mock(
  ({ $query }: { $query?: { range?: string; cluster?: string } } = {}) =>
    Promise.resolve({
      data: {
        ok: true,
        data: {
          ...generateClusterTelemetrySummary(
            ($query?.range as "1h" | "6h" | "24h") ?? "1h"
          ),
          namespace: "tenant-org-prod",
        },
      },
    })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      deploy: {
        telemetry: {
          get: mockTelemetryGet,
        },
      },
    },
  },
}))

// Dynamic import required so mock.module registrations take effect prior to module evaluation.
const { ClusterTelemetryCards } = await import("./cluster-telemetry-cards")

afterEach(() => {
  rtlCleanup()
})

describe("ClusterTelemetryCards component", () => {
  it("renders 3 primary telemetry cards (CPU, Memory, Network I/O) and updates with LIVE and namespace badges", async () => {
    const { getByText, getByTestId } = render(<ClusterTelemetryCards />)

    expect(getByText("Cluster Resource Telemetry")).toBeDefined()
    expect(getByText("CPU Utilization")).toBeDefined()
    expect(getByText("Memory Allocation")).toBeDefined()
    expect(getByText("Network I/O Throughput")).toBeDefined()

    await waitFor(() => {
      expect(getByText("LIVE")).toBeDefined()
      expect(getByTestId("telemetry-namespace")).toBeDefined()
      expect(getByText("ns: tenant-org-prod")).toBeDefined()
    })
  })

  it("allows switching time range between 1h, 6h, and 24h", async () => {
    const { getByRole } = render(<ClusterTelemetryCards />)

    const btn6h = getByRole("button", { name: "6h" })
    expect(btn6h).toBeDefined()
    fireEvent.click(btn6h)

    await waitFor(() => {
      expect(mockTelemetryGet).toHaveBeenCalled()
    })

    const btn24h = getByRole("button", { name: "24h" })
    expect(btn24h).toBeDefined()
    fireEvent.click(btn24h)

    await waitFor(() => {
      expect(mockTelemetryGet).toHaveBeenCalled()
    })
  })

  it("falls back to local summary gracefully if live telemetry fetch fails", async () => {
    mockTelemetryGet.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          ok: false,
          error: "TELEMETRY_ERROR",
          message: "Prometheus unreachable",
        },
      })
    )

    const { getByText } = render(<ClusterTelemetryCards />)

    expect(getByText("Cluster Resource Telemetry")).toBeDefined()
    expect(getByText("CPU Utilization")).toBeDefined()
  })
})
