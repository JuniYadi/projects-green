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
        /No log output in OpenSearch|Belum ada output log/i
      )
      expect(emptyMsg).toBeTruthy()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
