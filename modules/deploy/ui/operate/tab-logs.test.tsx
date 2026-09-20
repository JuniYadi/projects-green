import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TabLogs } from "./tab-logs"

describe("TabLogs Component", () => {
  afterEach(() => {
    cleanup()
  })

  it("fetches and renders real logs when appSlug is provided", async () => {
    const originalFetch = globalThis.fetch
    const mockLogs = [
      {
        id: "log-1",
        timestamp: "10:15:30",
        level: "INFO",
        source: "deploy",
        message: "Container started successfully",
      },
      {
        id: "log-2",
        timestamp: "10:15:32",
        level: "WARN",
        source: "app",
        message: "High memory utilization warning",
      },
    ]

    globalThis.fetch = mock(async (url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes("/logs/report")) {
        return { ok: false, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({ ok: true, data: mockLogs }) }
    }) as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    try {
      const view = render(
        <QueryClientProvider client={queryClient}>
          <TabLogs appSlug="hermes-sparkling-pulsar" />
        </QueryClientProvider>
      )

      const log1 = await view.findByText("Container started successfully")
      expect(log1).toBeTruthy()

      const log2 = await view.findByText("High memory utilization warning")
      expect(log2).toBeTruthy()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("opens inspector drawer when a log row is clicked", async () => {
    const originalFetch = globalThis.fetch
    const mockLogs = [
      {
        id: "log-101",
        timestamp: "14:00:00",
        level: "ERROR",
        source: "api",
        message: "Database connection refused",
        raw: {
          http: { status_code: 500 },
          error: { code: "ECONNREFUSED" },
        },
      },
    ]

    globalThis.fetch = mock(async (url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes("/logs/report")) {
        return { ok: false, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({ ok: true, data: mockLogs }) }
    }) as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    try {
      const view = render(
        <QueryClientProvider client={queryClient}>
          <TabLogs appSlug="hermes-sparkling-pulsar" />
        </QueryClientProvider>
      )

      const rowMessage = await view.findByText("Database connection refused")
      expect(rowMessage).toBeTruthy()

      fireEvent.click(rowMessage)

      // Drawer should open displaying attributes
      const attrField = await view.findByText("error.code")
      expect(attrField).toBeTruthy()
      expect(view.getByText("ECONNREFUSED")).toBeTruthy()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("renders empty state message when no logs exist in OpenSearch", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async (url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes("/logs/report")) {
        return { ok: false, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({ ok: true, data: [] }) }
    }) as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    try {
      const view = render(
        <QueryClientProvider client={queryClient}>
          <TabLogs appSlug="hermes-empty" />
        </QueryClientProvider>
      )

      const emptyMsg = await view.findByText(
        /No log output|Belum ada output log/i
      )
      expect(emptyMsg).toBeTruthy()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("supports pagination controls and source filtering", async () => {
    const originalFetch = globalThis.fetch
    const mockLogs = Array.from({ length: 75 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: `10:00:${String(i % 60).padStart(2, "0")}`,
      level: i % 2 === 0 ? "INFO" : "ERROR",
      source: i % 3 === 0 ? "nginx" : "app",
      message: `Message line ${i} of 75`,
    }))

    globalThis.fetch = mock(async (url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes("/logs/report")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              healthScore: 99,
              totalLogs: 75,
              errorCount: 37,
              warnCount: 0,
              periodLabel: "20 Sep 2026",
              granularity: "daily",
              trend: [],
              topErrors: [],
            },
          }),
        }
      }
      return { ok: true, json: async () => ({ ok: true, data: mockLogs }) }
    }) as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    try {
      const view = render(
        <QueryClientProvider client={queryClient}>
          <TabLogs appSlug="hermes-pagination-test" />
        </QueryClientProvider>
      )

      // First page with default 50 items
      const firstLine = await view.findByText("Message line 0 of 75")
      expect(firstLine).toBeTruthy()

      // Pagination indicator
      expect(view.getByText(/1 - 50/i)).toBeTruthy()

      // Toggle analytics
      const analyticsToggle = view.getByRole("button", {
        name: /View Analytics|Lihat Analisis/i,
      })
      fireEvent.click(analyticsToggle)
      expect(
        await view.findByText(/Hide Analytics|Sembunyikan Analisis/i)
      ).toBeTruthy()

      // Filter by level ERROR
      const errorBtn = view.getByRole("button", { name: "ERROR" })
      fireEvent.click(errorBtn)

      // Should now only show ERROR logs
      expect(await view.findByText("Message line 1 of 75")).toBeTruthy()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
