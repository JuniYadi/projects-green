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

  it("allows switching time range between 1h, 6h, 24h, and 7d and clicking refresh", async () => {
    const { getByRole } = renderWithClient(<ClusterTelemetryCards />)

    const btn6h = getByRole("button", { name: "6h" })
    expect(btn6h).toBeDefined()
    fireEvent.click(btn6h)

    const btn24h = getByRole("button", { name: "24h" })
    expect(btn24h).toBeDefined()
    fireEvent.click(btn24h)

    const btn7d = getByRole("button", { name: "7d" })
    expect(btn7d).toBeDefined()
    fireEvent.click(btn7d)

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
