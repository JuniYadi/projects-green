import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"

import { WebhookEventTable, type WebhookEventDTO } from "./webhook-event-table"

afterEach(() => {
  cleanup()
  mock.restore()
})

const sampleEvents: WebhookEventDTO[] = [
  {
    id: "evt_1",
    eventType: "inbound_message",
    processingStatus: "SUCCESS",
    deliveryStatus: "RECEIVED",
    phoneNumber: "+628123456789",
    deviceLabel: "+6283138855774",
    createdAt: "2026-06-17T12:00:00.000Z",
    waMessageId: "wamid_abc123",
    metaPayload: { type: "text", text: "Hello", sender: "user_1" },
  },
  {
    id: "evt_2",
    eventType: "status_update",
    processingStatus: "FAILED",
    deliveryStatus: "FAILED",
    phoneNumber: "+628123456789",
    deviceLabel: "+6283138855774",
    createdAt: "2026-06-17T12:01:00.000Z",
    waMessageId: null,
    metaPayload: { error: "timeout", code: 504 },
  },
  {
    id: "evt_3",
    eventType: "unknown_type",
    processingStatus: "PENDING",
    deliveryStatus: "READ",
    phoneNumber: "+628123456789",
    deviceLabel: "+6283138855774",
    createdAt: "2026-06-17T12:02:00.000Z",
    waMessageId: "wamid_def456",
    // metaPayload intentionally omitted — row has no payload to show
  },
]

describe("WebhookEventTable", () => {
  describe("loading state", () => {
    it("renders skeleton rows when isLoading is true", () => {
      const { container } = render(
        <WebhookEventTable events={[]} isLoading={true} />
      )

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe("error state", () => {
    it("shows error message when error is set", () => {
      const { getByRole, getByText } = render(
        <WebhookEventTable
          events={[]}
          isLoading={false}
          error="Something went wrong"
        />
      )

      expect(getByText("Something went wrong")).toBeTruthy()
      expect(getByRole("alert")).toBeTruthy()
    })

    it("renders retry button and calls onRetry when clicked", () => {
      const onRetry = mock(() => {})
      const { getByRole } = render(
        <WebhookEventTable
          events={[]}
          isLoading={false}
          error="Failed to load"
          onRetry={onRetry}
        />
      )

      const retryBtn = getByRole("button", { name: /retry/i })
      expect(retryBtn).toBeTruthy()

      fireEvent.click(retryBtn)
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe("empty state", () => {
    it('shows "No webhook events yet" when events array is empty', () => {
      const { getByText } = render(
        <WebhookEventTable events={[]} isLoading={false} />
      )

      expect(getByText("No webhook events yet")).toBeTruthy()
    })

    it("renders optional action link when emptyActionHref is provided", () => {
      const { getByRole } = render(
        <WebhookEventTable
          events={[]}
          isLoading={false}
          emptyActionLabel="Go to Settings"
          emptyActionHref="/settings"
        />
      )

      const link = getByRole("link", { name: "Go to Settings" })
      expect(link).toBeTruthy()
      expect(link.getAttribute("href")).toBe("/settings")
    })
  })

  describe("data table", () => {
    it("renders all event rows with correct type badges", () => {
      const { getByText } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />
      )

      expect(getByText("Inbound Message")).toBeTruthy()
      expect(getByText("Status Update")).toBeTruthy()
      expect(getByText("unknown_type")).toBeTruthy()
    })
    it("renders all events with correct status badges", () => {
      const { getByText } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />
      )

      expect(getByText("RECEIVED")).toBeTruthy()
      expect(getByText("FAILED")).toBeTruthy()
      expect(getByText("READ")).toBeTruthy()
    })

    it("displays WA message IDs and placeholder for missing ones", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />
      )

      expect(container.textContent).toContain("wamid_abc123")
      expect(container.textContent).toContain("wamid_def456")
      // Second event has null waMessageId — should render em-dash
      expect(container.textContent).toContain("—")
    })

    it("uses the supplied journey base path", () => {
      const { getByText } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          messageJourneyBasePath="/portal/whatsapp/messages"
        />
      )

      expect(getByText("wamid_abc123").getAttribute("href")).toBe(
        "/portal/whatsapp/messages/wamid_abc123"
      )
    })

    it("copies full WA Message ID to clipboard when clicked", async () => {
      const writeTextMock = mock(() => Promise.resolve())
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      })

      const { getByText } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />
      )

      const link = getByText("wamid_abc123")
      expect(link.getAttribute("href")).toContain("wamid_abc123")

      const parent = link.parentElement
      expect(parent).toBeTruthy()
      const copyBtn = parent?.querySelector("button")
      expect(copyBtn).toBeTruthy()
      if (copyBtn) fireEvent.click(copyBtn)
      expect(writeTextMock).toHaveBeenCalledWith("wamid_abc123")
    })

    it("maps deliveryStatus to correct Badge variant classes", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />
      )

      // Find all Badge elements (they have the "group/badge" class from CVA)
      const badges = container.querySelectorAll('[class*="group/badge"]')
      expect(badges.length).toBe(3)

      // evt_1: RECEIVED
      expect(badges[0].textContent).toContain("RECEIVED")

      // evt_2: FAILED → destructive variant
      expect(badges[1].className).toContain("destructive")
      expect(badges[1].textContent).toContain("FAILED")

      // evt_3: READ → success variant with emerald
      expect(badges[2].className).toContain("emerald")
      expect(badges[2].textContent).toContain("READ")
    })
    it("renders formatted timestamps", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />
      )

      // toLocaleString() output is environment-dependent but should produce
      // something that includes the year
      expect(container.textContent).toContain("2026")
    })
  })
  describe("expandable row", () => {
    it("toggles raw payload viewer when showPayload is true and row is clicked", () => {
      const { container, getByRole } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          showPayload={true}
        />
      )

      // Click the first row (evt_1 — has metaPayload)
      const rows = container.querySelectorAll("tbody tr")
      fireEvent.click(rows[0])

      // RawPayloadViewer should now be mounted with Copy button
      expect(getByRole("button", { name: /copy payload/i })).toBeTruthy()
    })
    it("does not toggle raw payload when showPayload is false", () => {
      const { container, queryByText } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          showPayload={false}
        />
      )

      const rows = container.querySelectorAll("tbody tr")
      fireEvent.click(rows[0])

      expect(queryByText("Payload")).toBeNull()
    })
  })

  describe("pagination", () => {
    it("renders pagination controls when totalPages > 1", () => {
      const onPageChange = mock(() => {})
      const { getByRole, getByText } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          pagination={{ page: 2, totalPages: 5, onPageChange }}
        />
      )

      expect(getByText("Page 2 of 5")).toBeTruthy()
      expect(getByRole("button", { name: /previous/i })).toBeTruthy()
      expect(getByRole("button", { name: /next/i })).toBeTruthy()
    })

    it("calls onPageChange when Previous is clicked", () => {
      const onPageChange = mock(() => {})
      const { getByRole } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          pagination={{ page: 2, totalPages: 5, onPageChange }}
        />
      )

      fireEvent.click(getByRole("button", { name: /previous/i }))
      expect(onPageChange).toHaveBeenCalledWith(1)
    })

    it("calls onPageChange when Next is clicked", () => {
      const onPageChange = mock(() => {})
      const { getByRole } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          pagination={{ page: 2, totalPages: 5, onPageChange }}
        />
      )

      fireEvent.click(getByRole("button", { name: /next/i }))
      expect(onPageChange).toHaveBeenCalledWith(3)
    })

    it("disables Previous on first page", () => {
      const onPageChange = mock(() => {})
      const { getByRole } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          pagination={{ page: 1, totalPages: 5, onPageChange }}
        />
      )

      const prevBtn = getByRole("button", { name: /previous/i })
      expect((prevBtn as HTMLButtonElement).disabled).toBe(true)
    })

    it("disables Next on last page", () => {
      const onPageChange = mock(() => {})
      const { getByRole } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          pagination={{ page: 5, totalPages: 5, onPageChange }}
        />
      )

      const nextBtn = getByRole("button", { name: /next/i })
      expect((nextBtn as HTMLButtonElement).disabled).toBe(true)
    })

    it("does not render pagination when totalPages is 1", () => {
      const onPageChange = mock(() => {})
      const { queryByRole, queryByText } = render(
        <WebhookEventTable
          events={sampleEvents}
          isLoading={false}
          pagination={{ page: 1, totalPages: 1, onPageChange }}
        />
      )

      expect(queryByRole("button", { name: /previous/i })).toBeNull()
      expect(queryByRole("button", { name: /next/i })).toBeNull()
      expect(queryByText(/page/i)).toBeNull()
    })
  })
})
