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
    createdAt: "2026-06-17T12:00:00.000Z",
    waMessageId: "wamid_abc123",
    metaPayload: { type: "text", text: "Hello", sender: "user_1" },
  },
  {
    id: "evt_2",
    eventType: "status_update",
    processingStatus: "FAILED",
    createdAt: "2026-06-17T12:01:00.000Z",
    waMessageId: null,
    metaPayload: { error: "timeout", code: 504 },
  },
  {
    id: "evt_3",
    eventType: "unknown_type",
    processingStatus: "PENDING",
    createdAt: "2026-06-17T12:02:00.000Z",
    waMessageId: "wamid_def456",
    // metaPayload intentionally omitted — row has no payload to show
  },
]

describe("WebhookEventTable", () => {
  describe("loading state", () => {
    it("renders skeleton rows when isLoading is true", () => {
      const { container } = render(
        <WebhookEventTable events={[]} isLoading={true} />,
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
        />,
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
        />,
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
        <WebhookEventTable events={[]} isLoading={false} />,
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
        />,
      )

      const link = getByRole("link", { name: "Go to Settings" })
      expect(link).toBeTruthy()
      expect(link.getAttribute("href")).toBe("/settings")
    })
  })

  describe("data table", () => {
    it("renders all event rows with correct type badges", () => {
      const { getByText } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />,
      )

      expect(getByText("Inbound Message")).toBeTruthy()
      expect(getByText("Status Update")).toBeTruthy()
      expect(getByText("unknown_type")).toBeTruthy()
    })

    it("renders all events with correct status badges", () => {
      const { getByText } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />,
      )

      expect(getByText("SUCCESS")).toBeTruthy()
      expect(getByText("FAILED")).toBeTruthy()
      expect(getByText("PENDING")).toBeTruthy()
    })

    it("displays WA message IDs and placeholder for missing ones", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />,
      )

      expect(container.textContent).toContain("wamid_abc123")
      expect(container.textContent).toContain("wamid_def456")
      // Second event has null waMessageId — should render em-dash
      expect(container.textContent).toContain("—")
    })

    it("maps processingStatus to correct Badge variant classes", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />,
      )

      // Find all Badge elements (they have the "group/badge" class from CVA)
      const badges = container.querySelectorAll('[class*="group/badge"]')
      expect(badges.length).toBe(3)

      // evt_1: SUCCESS → success variant → bg-emerald-500/10
      expect(badges[0].className).toContain("emerald")

      // evt_2: FAILED → destructive variant → bg-destructive
      expect(badges[1].className).toContain("destructive")

      // evt_3: PENDING → warning variant → bg-amber-500/10
      expect(badges[2].className).toContain("amber")
    })

    it("renders formatted timestamps", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />,
      )

      // toLocaleString() output is environment-dependent but should produce
      // something that includes the year
      expect(container.textContent).toContain("2026")
    })
  })

  describe("expandable row", () => {
    it("toggles raw payload viewer when a row with metaPayload is clicked", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />,
      )

      // No viewer initially
      expect(container.querySelector("details")).toBeNull()

      // Click the first row (evt_1 — has metaPayload)
      const rows = container.querySelectorAll("tbody tr")
      expect(rows.length).toBe(3)

      fireEvent.click(rows[0])

      // Viewer should now appear
      const details = container.querySelector("details")
      expect(details).toBeTruthy()
      // The preview text should be visible (first 120 chars of stringified JSON)
      expect(container.textContent).toContain('"type"')
      expect(container.textContent).toContain('"text"')

      // Click the same row again to collapse
      fireEvent.click(rows[0])
      expect(container.querySelector("details")).toBeNull()
    })

    it("does not show viewer when expanded row has no metaPayload", () => {
      const { container } = render(
        <WebhookEventTable events={sampleEvents} isLoading={false} />,
      )

      // Click the third row (evt_3 — no metaPayload)
      const rows = container.querySelectorAll("tbody tr")

      fireEvent.click(rows[2])

      // No details element because metaPayload is undefined
      expect(container.querySelector("details")).toBeNull()
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
        />,
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
        />,
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
        />,
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
        />,
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
        />,
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
        />,
      )

      expect(queryByRole("button", { name: /previous/i })).toBeNull()
      expect(queryByRole("button", { name: /next/i })).toBeNull()
      expect(queryByText(/page/i)).toBeNull()
    })
  })
})
