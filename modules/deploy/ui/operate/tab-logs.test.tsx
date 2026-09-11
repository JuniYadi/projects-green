import { cleanup, render } from "@testing-library/react"
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
        "Belum ada output log di OpenSearch untuk service ini."
      )
      expect(emptyMsg).toBeTruthy()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
