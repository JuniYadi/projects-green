"use client"

import * as React from "react"
import { ArrowsClockwise } from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { eden } from "@/lib/eden"
import {
  WebhookEventTable,
  type WebhookEventDTO,
} from "@/modules/whatsapp/webhooks/ui/webhook-event-table"
import {
  WebhookEventFilter,
  DEFAULT_FILTER_STATE,
  type WebhookEventFilterState,
} from "@/modules/whatsapp/webhooks/ui/webhook-event-filter"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = "loading" | "error" | "loaded"

type EventsApiResponse = {
  ok: boolean
  data: WebhookEventDTO[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = ["inbound_message", "status_update"]
const PROCESSING_STATUSES = ["PENDING", "SUCCESS", "FAILED"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDeviceLabel(device: DeviceListItem): string {
  return `${device.phoneNumber}${device.environment === "SANDBOX" ? " (Sandbox)" : ""}`
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function ConsoleWhatsAppWebhookLogsPage() {
  // Device list (for filter dropdown)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])

  // Events
  const [events, setEvents] = React.useState<WebhookEventDTO[]>([])
  const [meta, setMeta] = React.useState<{
    total: number
    page: number
    totalPages: number
  }>({ total: 0, page: 1, totalPages: 0 })

  // UI state
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [filters, setFilters] =
    React.useState<WebhookEventFilterState>(DEFAULT_FILTER_STATE)
  const [page, setPage] = React.useState(1)

  // ── Load devices on mount ────────────────────────────────────────────────

  const loadDevices = React.useCallback(async () => {
    try {
      const { data, error } = await eden.api.whatsapp.devices.get()
      if (error) throw new Error(String(error))
      const result = data as unknown as { ok: boolean; devices: DeviceListItem[] }
      setDevices(result.devices)
    } catch (err) {
      console.error("Failed to load devices:", err)
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      await loadDevices()
    })()
  }, [loadDevices])

  // ── Load events on mount + filter/page change ────────────────────────────

  const loadEvents = React.useCallback(async () => {
    setPageState("loading")
    setErrorMessage("")

    try {
      const query: Record<string, string> = {
        page: String(page),
        limit: "20",
      }

      if (filters.deviceId !== "all") {
        query.deviceId = filters.deviceId
      }
      if (filters.eventType !== "all") {
        query.type = filters.eventType
      }
      if (filters.processingStatus !== "all") {
        query.status = filters.processingStatus
      }
      if (filters.dateFrom) {
        query.from = filters.dateFrom
      }
      if (filters.dateTo) {
        query.to = filters.dateTo
      }

      const { data, error } = await eden.api.whatsapp.webhooks.events.get({
        $query: query,
      })

      if (error) {
        throw new Error(error.message ?? "Failed to load events")
      }

      const result = data as unknown as EventsApiResponse
      setEvents(result.data)
      setMeta(result.meta)
      setPageState("loaded")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load webhook events"
      setErrorMessage(message)
      setPageState("error")
    }
  }, [filters, page])

  React.useEffect(() => {
    ;(async () => {
      await loadEvents()
    })()
  }, [loadEvents])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFilterChange = (newFilters: WebhookEventFilterState) => {
    setFilters(newFilters)
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleRetry = () => {
    void loadEvents()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Webhook Logs</h1>
        <p className="text-muted-foreground">
          View and inspect incoming WhatsApp webhook events across your
          devices.
        </p>
      </div>

      {/* Filter Bar — device filter enabled */}
      <WebhookEventFilter
        eventTypes={EVENT_TYPES}
        statuses={PROCESSING_STATUSES}
        devices={devices.map((d) => ({
          id: d.id,
          label: makeDeviceLabel(d),
        }))}
        onFilterChange={handleFilterChange}
        initialFilters={filters}
        showDeviceFilter={true}
      />

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>
            Webhook events for your devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!devices.length && pageState !== "error" ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No devices found. Add a WhatsApp device first.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void loadDevices()}
              >
                <ArrowsClockwise className="mr-2 size-4" />
                Retry
              </Button>
            </div>
          ) : (
            <WebhookEventTable
              events={events}
              isLoading={pageState === "loading"}
              error={pageState === "error" ? errorMessage : undefined}
              onRetry={handleRetry}
              pagination={
                meta.totalPages > 1
                  ? {
                      page: meta.page,
                      totalPages: meta.totalPages,
                      onPageChange: handlePageChange,
                    }
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
