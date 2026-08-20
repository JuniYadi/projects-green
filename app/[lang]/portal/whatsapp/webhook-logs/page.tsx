"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { eden } from "@/lib/eden"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import {
  WebhookEventTable,
  type WebhookEventDTO,
} from "@/modules/whatsapp/webhooks/ui/webhook-event-table"
import {
  WebhookEventFilter,
  DEFAULT_FILTER_STATE,
  type WebhookEventFilterState,
} from "@/modules/whatsapp/webhooks/ui/webhook-event-filter"

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

type OrganizationListItem = {
  id: string
  name: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = ["inbound_message", "status_update"]
const PROCESSING_STATUSES = ["PENDING", "SUCCESS", "FAILED"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDeviceLabel(device: DeviceListItem): string {
  return `${device.phoneNumber}${device.environment === "SANDBOX" ? " (Sandbox)" : ""}`
}

function makeOrganizationLabel(org: OrganizationListItem): string {
  return org.name
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PortalWhatsAppWebhookLogsPage() {
  // Device list (for filter dropdown)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  // Organizations list (for filter dropdown)
  const [organizations, setOrganizations] = React.useState<
    OrganizationListItem[]
  >([])

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

  // ── Load data on mount ────────────────────────────────────────────────

  React.useEffect(() => {
    ;(async () => {
      try {
        const [deviceRes, orgRes] = await Promise.all([
          eden.api.admin.devices.get({ $query: { take: "200" } }),
          eden.api.admin.organizations.get({ $query: { limit: 100 } }),
        ])

        const deviceBody = deviceRes.data as unknown as {
          ok: boolean
          devices: DeviceListItem[]
        }
        if (deviceBody.ok) setDevices(deviceBody.devices)

        const orgBody = orgRes.data as unknown as {
          ok: boolean
          data?: { organizations: OrganizationListItem[] }
          organizations?: OrganizationListItem[]
        }
        if (orgBody.ok) {
          const orgList =
            orgBody.data?.organizations ?? orgBody.organizations ?? []
          setOrganizations(orgList)
        }
      } catch (err) {
        console.error("Failed to load filters:", err)
      }
    })()
  }, [])

  // ── Load events on mount + filter/page change ────────────────────────────

  const loadEvents = React.useCallback(async () => {
    setPageState("loading")
    setErrorMessage("")

    try {
      const query: Record<string, string> = {
        page: String(page),
        limit: "20",
      }

      if (filters.organizationId && filters.organizationId !== "all") {
        query.organizationId = filters.organizationId
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

      const { data, error } = await eden.api.admin.whatsapp.webhooks.events.get(
        {
          $query: query,
        }
      )

      if (error) {
        throw new Error(
          (error as { message?: string })?.message ??
            "Failed to load webhook events"
        )
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
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Webhook Logs</h1>
        <p className="text-muted-foreground">
          View and inspect incoming WhatsApp webhook events across all devices.
        </p>
      </div>

      {/* Filter Bar — device filter enabled */}
      {/* Filter Bar — device and organization filters enabled */}
      <WebhookEventFilter
        eventTypes={EVENT_TYPES}
        statuses={PROCESSING_STATUSES}
        devices={devices.map((d) => ({
          id: d.id,
          label: makeDeviceLabel(d),
        }))}
        organizations={(organizations ?? []).map((o) => ({
          id: o.id,
          name: makeOrganizationLabel(o),
        }))}
        onFilterChange={handleFilterChange}
        initialFilters={filters}
        showDeviceFilter={true}
        showOrganizationFilter={true}
      />

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>Webhook events for all devices</CardDescription>
        </CardHeader>
        <CardContent>
          {!organizations.length && !devices.length && pageState !== "error" ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No devices or organizations found.
              </p>
            </div>
          ) : (
            <WebhookEventTable
              events={events}
              isLoading={pageState === "loading"}
              error={pageState === "error" ? errorMessage : undefined}
              onRetry={handleRetry}
              showPayload={true}
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
    </main>
  )
}
