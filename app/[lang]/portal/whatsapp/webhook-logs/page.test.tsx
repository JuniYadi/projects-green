import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

// ─── Mocked responses ─────────────────────────────────────────────────────────

const mockDevicesResponse = () =>
  new Response(
    JSON.stringify({
      ok: true,
      devices: [
        {
          id: "device-1",
          phoneNumber: "+1234567890",
          environment: "PRODUCTION",
          status: "ACTIVE",
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

const mockOrganizationsResponse = () =>
  new Response(
    JSON.stringify({
      ok: true,
      organizations: [{ id: "org-1", name: "Test Organization" }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

const mockEventsResponse = () =>
  new Response(
    JSON.stringify({
      ok: true,
      data: [
        {
          id: "evt-1",
          eventType: "inbound_message",
          processingStatus: "PENDING",
          createdAt: new Date().toISOString(),
          whatsappDeviceId: "device-1",
          waMessageId: null,
          errorMessage: null,
        },
        {
          id: "evt-2",
          eventType: "status_update",
          processingStatus: "SUCCESS",
          createdAt: new Date().toISOString(),
          whatsappDeviceId: "device-1",
          waMessageId: "wa-msg-1",
          errorMessage: null,
        },
      ],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

const mockFetch = mock((input: string | Request) => {
  const url = typeof input === "string" ? input : input.url
  const pathname = new URL(url, "http://localhost:3300").pathname
  if (pathname.startsWith("/api/admin/devices")) {
    return Promise.resolve(mockDevicesResponse())
  }
  if (pathname.startsWith("/api/admin/organizations")) {
    return Promise.resolve(mockOrganizationsResponse())
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
      expect(view.getByRole("heading", { name: "Webhook Logs" })).toBeTruthy()
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
    mockFetch.mockImplementation((input: string | Request) => {
      const url = typeof input === "string" ? input : input.url
      const pathname = new URL(url, "http://localhost:3300").pathname
      if (
        pathname.startsWith("/api/admin/devices") ||
        pathname.startsWith("/api/admin/organizations")
      ) {
        return Promise.resolve(mockDevicesResponse())
      }
      return Promise.reject(new Error("Failed to load webhook events"))
    })

    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(view.getByText("Failed to load webhook events")).toBeTruthy()
    })
  })
})
