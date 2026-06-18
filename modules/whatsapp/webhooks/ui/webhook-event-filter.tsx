/**
 * Webhook Event Filter — reusable filter bar
 *
 * Props-driven filter controls for webhook event tables.
 * Compatible with both Portal and Console surfaces.
 */

"use client"

import { useCallback, useState } from "react"
import { X } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebhookEventFilterState = {
  eventType: string
  processingStatus: string
  deviceId: string
  dateFrom: string
  dateTo: string
}

export const DEFAULT_FILTER_STATE: WebhookEventFilterState = {
  eventType: "all",
  processingStatus: "all",
  deviceId: "all",
  dateFrom: "",
  dateTo: "",
}

export type WebhookEventFilterProps = {
  eventTypes: string[]
  statuses: string[]
  devices: { id: string; label: string }[]
  onFilterChange: (filters: WebhookEventFilterState) => void
  initialFilters: WebhookEventFilterState
  showDeviceFilter: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WebhookEventFilter({
  eventTypes,
  statuses,
  devices,
  onFilterChange,
  initialFilters,
  showDeviceFilter,
}: WebhookEventFilterProps) {
  // Local state for date inputs — avoids stale closure over initialFilters
  const [localDateFrom, setLocalDateFrom] = useState(initialFilters.dateFrom)
  const [localDateTo, setLocalDateTo] = useState(initialFilters.dateTo)

  const hasActiveFilters =
    initialFilters.eventType !== "all" ||
    initialFilters.processingStatus !== "all" ||
    initialFilters.deviceId !== "all" ||
    initialFilters.dateFrom !== "" ||
    initialFilters.dateTo !== ""

  const updateFilter = useCallback(
    (key: keyof WebhookEventFilterState, value: string) => {
      onFilterChange({ ...initialFilters, [key]: value })
    },
    [initialFilters, onFilterChange],
  )

  const handleReset = useCallback(() => {
    setLocalDateFrom(DEFAULT_FILTER_STATE.dateFrom)
    setLocalDateTo(DEFAULT_FILTER_STATE.dateTo)
    onFilterChange(DEFAULT_FILTER_STATE)
  }, [onFilterChange])

  const showDeviceDropdown = showDeviceFilter && devices.length > 0

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Event Type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Event Type
        </label>
        <Select
          value={initialFilters.eventType}
          onValueChange={(val) => updateFilter("eventType", val)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {eventTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Status
        </label>
        <Select
          value={initialFilters.processingStatus}
          onValueChange={(val) => updateFilter("processingStatus", val)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Device (conditional) */}
      {showDeviceDropdown && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Device
          </label>
          <Select
            value={initialFilters.deviceId}
            onValueChange={(val) => updateFilter("deviceId", val)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {devices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Date From */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input
          type="date"
          value={localDateFrom}
          onChange={(e) => {
            setLocalDateFrom(e.target.value)
            updateFilter("dateFrom", e.target.value)
          }}
          className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          To
        </label>
        <input
          type="date"
          value={localDateTo}
          onChange={(e) => {
            setLocalDateTo(e.target.value)
            updateFilter("dateTo", e.target.value)
          }}
          className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="mb-0.5"
        >
          <X className="mr-1 size-3.5" />
          Reset
        </Button>
      )}
    </div>
  )
}
