import { describe, expect, it, mock, afterEach } from "bun:test"
import {
  cleanup as rtlCleanup,
  render,
  fireEvent,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { generateClusterTelemetrySummary } from "@/modules/deploy/telemetry.service"
import type { ClusterTelemetrySummary } from "@/modules/deploy/telemetry.types"

type MockTelemetryResponse = {
  data: {
    ok: boolean
    data?: ClusterTelemetrySummary & {
      namespace?: string
    }
    error?: string
    message?: string
  }
}

const mockTelemetryGet = mock<
  (args?: {
    $query?: {
      range?: string
      from?: string
      to?: string
      cluster?: string
      tz?: string
    }
  }) => Promise<MockTelemetryResponse>
>(({ $query } = {}) =>
  Promise.resolve({
    data: {
      ok: true,
      data: {
        ...generateClusterTelemetrySummary(
          ($query?.range as "1h" | "6h" | "24h" | "7d") ?? "1h"
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
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const renderWithClient = (ui: React.ReactElement) => {
  const client = createTestQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

afterEach(() => {
  rtlCleanup()
})

describe("ClusterTelemetryCards component", () => {
  it("renders 3 primary telemetry cards (CPU, Memory, Network I/O) and updates with LIVE badge", async () => {
    const { getByText, queryByTestId } = renderWithClient(
      <ClusterTelemetryCards />
    )

    expect(getByText("Cluster Resource Telemetry")).toBeDefined()
    expect(getByText("CPU Utilization")).toBeDefined()
    expect(getByText("Memory Utilization")).toBeDefined()
    expect(getByText("Network I/O Throughput")).toBeDefined()

    await waitFor(() => {
      expect(getByText("LIVE")).toBeDefined()
      // Namespace badge is hidden per user requirements
      expect(queryByTestId("telemetry-namespace")).toBeNull()
    })
  })

  it("renders TimeRangeDropdown and allows switching time range via dropdown and clicking refresh", async () => {
    const { getByText, getByRole } = renderWithClient(<ClusterTelemetryCards />)

    // Verify TimeRangeDropdown is rendered with default preset label
    expect(getByText("Last 1 hour")).toBeDefined()

    // Open popover
    const trigger = getByText("Last 1 hour")
    fireEvent.click(trigger)
    // Select 6h preset
    const option6h = getByText("Last 6 hours")
    expect(option6h).toBeDefined()
    fireEvent.click(option6h)

    await waitFor(() => {
      expect(mockTelemetryGet).toHaveBeenCalledWith(
        expect.objectContaining({
          $query: expect.objectContaining({
            range: "6h",
            cluster: "sgp",
          }),
        })
      )
    })

    // Click refresh button
    const refreshBtn = getByRole("button", { name: /refresh/i })
    expect(refreshBtn).toBeDefined()
    fireEvent.click(refreshBtn)

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

    const { getByText } = renderWithClient(<ClusterTelemetryCards />)

    expect(getByText("Cluster Resource Telemetry")).toBeDefined()
    expect(getByText("CPU Utilization")).toBeDefined()
  })
})
