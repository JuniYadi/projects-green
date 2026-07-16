import { beforeEach, describe, expect, it, mock } from "bun:test"

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

const mockFetch = mock((input: string | Request) => {
  const url = typeof input === "string" ? input : input.url
  const pathname = new URL(url, "http://localhost:3300").pathname
  if (pathname.startsWith("/api/whatsapp/devices")) {
    return Promise.resolve(mockDevicesResponse())
  }
  return Promise.resolve(mockEventsResponse())
})

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
  }),
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

 
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch

import { render, waitFor } from "@testing-library/react"
import ConsoleWhatsAppWebhookLogsPage from "./page"

describe("ConsoleWhatsAppWebhookLogsPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders the page heading", async () => {
    const view = render(<ConsoleWhatsAppWebhookLogsPage />)

    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "Webhook Logs" })
      ).toBeTruthy()
    })
  })

  it("renders the page description", async () => {
    const view = render(<ConsoleWhatsAppWebhookLogsPage />)

    await waitFor(() => {
      expect(
        view.getByText(
          "View and inspect incoming WhatsApp webhook events across your devices."
        )
      ).toBeTruthy()
    })
  })

  it("loads and displays events from /api/whatsapp/webhooks/events", async () => {
    const view = render(<ConsoleWhatsAppWebhookLogsPage />)

    await waitFor(() => {
      expect(view.getByText("Inbound Message")).toBeTruthy()
      expect(view.getByText("Status Update")).toBeTruthy()
    })

    expect(mockFetch).toHaveBeenCalled()
    const calls = mockFetch.mock.calls
    const eventCall = calls.find(([input]) => {
      const url = typeof input === "string" ? input : (input as Request).url
      return url.includes("/api/whatsapp/webhooks/events")
    })
    expect(eventCall).toBeTruthy()
  })

  it("shows error state with Retry button when API call fails", async () => {
    mockFetch.mockImplementation((input: string | Request) => {
      const url = typeof input === "string" ? input : input.url
      const pathname = new URL(url, "http://localhost:3300").pathname
      if (pathname.startsWith("/api/whatsapp/devices")) {
        return Promise.resolve(mockDevicesResponse())
      }
      return Promise.reject(new Error("Failed to load webhook events"))
    })

    const view = render(<ConsoleWhatsAppWebhookLogsPage />)

    await waitFor(() => {
      expect(view.getByRole("button", { name: "Retry" })).toBeTruthy()
    })
  })
})
