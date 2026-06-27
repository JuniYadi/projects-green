import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

// ─── Mocked responses ─────────────────────────────────────────────────────────

const mockDevicesResponse = () =>
  new Response(
    JSON.stringify({
      ok: true,
      devices: [
        { id: "d1", phoneNumber: "+6281212345678", environment: "PRODUCTION" },
        { id: "d2", phoneNumber: "+6281398765432", environment: "SANDBOX" },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

const mockEventsResponse = () =>
  new Response(
    JSON.stringify({
      ok: true,
      data: [
        {
          id: "e1",
          eventType: "inbound_message",
          processingStatus: "SUCCESS",
          createdAt: "2026-06-22T10:00:00Z",
          waMessageId: "wamid_123",
        },
        {
          id: "e2",
          eventType: "status_update",
          processingStatus: "PENDING",
          createdAt: "2026-06-22T11:00:00Z",
          waMessageId: null,
        },
      ],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

// ─── Mock fetch — route by URL path ────────────────────────────────────────────

const mockFetch = mock((input: string | Request) => {
  const url = typeof input === "string" ? input : input.url
  const pathname = new URL(url, "http://localhost:3300").pathname
  if (pathname.startsWith("/api/whatsapp/devices")) {
    return Promise.resolve(mockDevicesResponse())
  }
  return Promise.resolve(mockEventsResponse())
})

global.fetch = mockFetch as unknown as typeof fetch

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("PortalWhatsAppWebhookLogsPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders the page heading", async () => {
    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "Webhook Logs" })
      ).toBeTruthy()
    })
  })

  it("loads and displays events from the global endpoint", async () => {
    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(view.getByText("Inbound Message")).toBeTruthy()
      expect(view.getByText("Status Update")).toBeTruthy()
    })
  })

  it("shows error state when API call fails", async () => {
    // Simulate network error for events endpoint
    mockFetch.mockImplementation(
      (input: string | Request) => {
        const url = typeof input === "string" ? input : input.url
        const pathname = new URL(url, "http://localhost:3300").pathname
        if (pathname.startsWith("/api/whatsapp/devices")) {
          return Promise.resolve(mockDevicesResponse())
        }
        return Promise.reject(new Error("Failed to load webhook events"))
      }
    )

    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(view.getByRole("button", { name: "Retry" })).toBeTruthy()
    })
  })
})
