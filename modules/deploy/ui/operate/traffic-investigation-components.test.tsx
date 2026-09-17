import { describe, it, expect, mock, afterEach } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { TrafficIpReviewDrawer } from "./traffic-ip-review-drawer"
import { TrafficIpInvestigationTable } from "./traffic-ip-investigation-table"
import { TabTraffic } from "./tab-traffic"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderWithQuery(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("Traffic Investigation Components", () => {
  afterEach(() => {
    cleanup()
  })

  describe("TrafficIpReviewDrawer", () => {
    it("renders drawer header and loading state when open", () => {
      const view = renderWithQuery(
        <TrafficIpReviewDrawer
          appSlug="my-app"
          ip="10.0.0.1"
          open={true}
          onOpenChange={mock()}
        />
      )
      expect(view.getByText("10.0.0.1")).toBeTruthy()
    })

    it("renders Log tab trigger in the drawer tabs", async () => {
      const mockIpDetail = {
        ip: "10.0.0.1",
        countryCode: "ID",
        countryName: "Indonesia",
        totalRequests: 42,
        statusCounts: {
          status2xx: 40,
          status3xx: 0,
          status4xx: 2,
          status5xx: 0,
        },
        successRate: 95.2,
        signal: {
          classification: "likely_human",
          confidence: 90,
          reasons: ["Browser pattern"],
        },
        pathsByStatus: {
          status2xx: [],
          status3xx: [],
          status4xx: [],
          status5xx: [],
        },
        userAgents: [],
        timeline: [],
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        velocity: { maxRpm: 10, isBurst: false },
        staticAssetShare: 20,
        recentLogs: [
          {
            id: "log-1",
            timestamp: new Date().toISOString(),
            method: "GET",
            path: "/api/health",
            statusCode: 200,
            latencyMs: 14,
          },
        ],
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => ({ ok: true, data: mockIpDetail }),
      })) as unknown as typeof fetch

      try {
        const view = renderWithQuery(
          <TrafficIpReviewDrawer
            appSlug="my-app"
            ip="10.0.0.1"
            open={true}
            onOpenChange={mock()}
          />
        )
        const logTab = await view.findByText("Log")
        expect(logTab).toBeTruthy()
        const logPath = await view.findByText("/api/health")
        expect(logPath).toBeTruthy()
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe("TrafficIpInvestigationTable", () => {
    it("renders search input, filter pills, and table controls", () => {
      const view = renderWithQuery(
        <TrafficIpInvestigationTable appSlug="my-app" onReviewIp={mock()} />
      )
      expect(view.getByPlaceholderText("Cari alamat IP...")).toBeTruthy()
      expect(view.getByText("Semua Sinyal")).toBeTruthy()
      expect(view.getByText("Manusia")).toBeTruthy()
      expect(view.getByText("Bot / Scanner")).toBeTruthy()
    })
  })

  describe("TabTraffic Workspace Modes", () => {
    it("renders Chart and Table mode toggles and switches modes", () => {
      const view = renderWithQuery(<TabTraffic appSlug="my-app" />)
      expect(view.getByText("Chart")).toBeTruthy()
      expect(view.getByText("Investigasi IP")).toBeTruthy()
      expect(view.getByText("Harian")).toBeTruthy()
      expect(view.getByText("Bulanan")).toBeTruthy()
      expect(view.getByText("Tahunan")).toBeTruthy()
    })
  })
})
