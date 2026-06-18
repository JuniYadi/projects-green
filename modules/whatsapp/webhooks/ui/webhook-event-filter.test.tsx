/**
 * Radix UI Select requires scrollIntoView in Happy DOM.
 * This polyfill is applied once at module scope.
 */

if (
  typeof Element !== "undefined" &&
  !Element.prototype.scrollIntoView
) {
  Element.prototype.scrollIntoView = () => {}
}

import { afterEach, describe, expect, it, mock } from "bun:test"
import { act, cleanup, fireEvent, render } from "@testing-library/react"

import {
  DEFAULT_FILTER_STATE,
  WebhookEventFilter,
  type WebhookEventFilterState,
} from "./webhook-event-filter"

afterEach(() => {
  cleanup()
  mock.restore()
})

const defaultDevices = [
  { id: "device_1", label: "Main Phone" },
  { id: "device_2", label: "Backup Phone" },
]

const defaultEventTypes = ["inbound_message", "status_update"]
const defaultStatuses = ["SUCCESS", "FAILED", "PENDING"]

/**
 * Find a Radix Select trigger by its label text.
 * The label and trigger are siblings in a flex-col container.
 */
function getSelectTrigger(
  view: ReturnType<typeof render>,
  labelText: string,
): HTMLElement {
  const label = view.getByText(labelText)
  const group = label.closest('[class*="flex flex-col gap-1.5"]')
  if (!group) throw new Error(`No flex-col container for label "${labelText}"`)
  const trigger = group.querySelector('[role="combobox"]')
  if (!trigger) throw new Error(`No combobox in group for label "${labelText}"`)
  return trigger as HTMLElement
}

/**
 * Click an option in an open Radix Select dropdown by its visible text.
 * Radix renders its option list via Portal into document.body.
 */
function selectOption(labelText: string): void {
  const options = document.body.querySelectorAll('[role="option"]')
  const option = Array.from(options).find(
    (o) => o.textContent?.trim() === labelText,
  )
  if (!option) {
    const allText = Array.from(options).map(
      (o) => `"${o.textContent?.trim()}"`,
    )
    throw new Error(
      `Option "${labelText}" not found. Available: [${allText.join(", ")}]`,
    )
  }
  fireEvent.click(option)
}

describe("WebhookEventFilter", () => {
  describe("filter controls rendering", () => {
    it("renders event type label and select trigger", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      expect(view.getByText("Event Type")).toBeTruthy()
      expect(
        view.container.querySelector('[role="combobox"]'),
      ).toBeTruthy()
    })

    it("renders status label and select trigger", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      expect(view.getByText("Status")).toBeTruthy()
      expect(
        view.container.querySelectorAll('[role="combobox"]').length,
      ).toBeGreaterThanOrEqual(2)
    })

    it("renders date From and To inputs", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      expect(view.getByText("From")).toBeTruthy()
      expect(view.getByText("To")).toBeTruthy()

      const dateInputs = view.container.querySelectorAll<HTMLInputElement>(
        'input[type="date"]',
      )
      expect(dateInputs.length).toBe(2)
    })

    it("renders device filter when showDeviceFilter is true and devices exist", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={true}
        />,
      )

      expect(view.getByText("Device")).toBeTruthy()
    })

    it("hides device filter when showDeviceFilter is false", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      expect(view.queryByText("Device")).toBeNull()
    })

    it("hides device filter when showDeviceFilter is true but devices list is empty", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={[]}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={true}
        />,
      )

      expect(view.queryByText("Device")).toBeNull()
    })
  })

  describe("filter changes", () => {
    it("calls onFilterChange when event type is changed via Select", async () => {
      const onFilterChange = mock<
        (filters: WebhookEventFilterState) => void
      >()
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={onFilterChange}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      const trigger = getSelectTrigger(view, "Event Type")
      await act(async () => {
        fireEvent.click(trigger)
      })

      await act(async () => {
        selectOption("inbound_message")
      })

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "inbound_message" }),
      )
    })

    it("calls onFilterChange when status is changed via Select", async () => {
      const onFilterChange = mock<
        (filters: WebhookEventFilterState) => void
      >()
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={onFilterChange}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      const trigger = getSelectTrigger(view, "Status")
      await act(async () => {
        fireEvent.click(trigger)
      })

      await act(async () => {
        selectOption("FAILED")
      })

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ processingStatus: "FAILED" }),
      )
    })

    it("calls onFilterChange when device is changed via Select", async () => {
      const onFilterChange = mock<
        (filters: WebhookEventFilterState) => void
      >()
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={onFilterChange}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={true}
        />,
      )

      const trigger = getSelectTrigger(view, "Device")
      await act(async () => {
        fireEvent.click(trigger)
      })

      await act(async () => {
        selectOption("Main Phone")
      })

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: "device_1" }),
      )
    })

    it("renders date inputs that accept DOM value changes", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      const dateInputs = view.container.querySelectorAll<HTMLInputElement>(
        'input[type="date"]',
      )
      expect(dateInputs.length).toBe(2)

      // Verify initial empty state
      expect(dateInputs[0].value).toBe("")
      expect(dateInputs[1].value).toBe("")

      // Verify DOM-level value setting works
      dateInputs[0].value = "2026-06-01"
      expect(dateInputs[0].value).toBe("2026-06-01")

      dateInputs[1].value = "2026-06-30"
      expect(dateInputs[1].value).toBe("2026-06-30")
    })
  })

  describe("reset button", () => {
    it("does not show reset button when all filters are at default values", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={DEFAULT_FILTER_STATE}
          showDeviceFilter={false}
        />,
      )

      expect(view.queryByRole("button", { name: /reset/i })).toBeNull()
    })

    it("shows reset button when eventType filter is active", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={{
            ...DEFAULT_FILTER_STATE,
            eventType: "inbound_message",
          }}
          showDeviceFilter={false}
        />,
      )

      expect(view.getByRole("button", { name: /reset/i })).toBeTruthy()
    })

    it("shows reset button when dateFrom filter is active", () => {
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={mock(() => {})}
          initialFilters={{
            ...DEFAULT_FILTER_STATE,
            dateFrom: "2026-06-01",
          }}
          showDeviceFilter={false}
        />,
      )

      expect(view.getByRole("button", { name: /reset/i })).toBeTruthy()
    })

    it("calls onFilterChange with DEFAULT_FILTER_STATE when reset is clicked", () => {
      const onFilterChange = mock<
        (filters: WebhookEventFilterState) => void
      >()
      const view = render(
        <WebhookEventFilter
          eventTypes={defaultEventTypes}
          statuses={defaultStatuses}
          devices={defaultDevices}
          onFilterChange={onFilterChange}
          initialFilters={{
            ...DEFAULT_FILTER_STATE,
            eventType: "inbound_message",
          }}
          showDeviceFilter={false}
        />,
      )

      fireEvent.click(view.getByRole("button", { name: /reset/i }))

      expect(onFilterChange).toHaveBeenCalledWith(DEFAULT_FILTER_STATE)
    })
  })
})
