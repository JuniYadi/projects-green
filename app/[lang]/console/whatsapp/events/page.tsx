"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Phone, ArrowsClockwise } from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"
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
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { LockedFeatureTeaser } from "@/modules/whatsapp/onboarding/locked-feature-teaser"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
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

/** Static filter options — not derived from loaded events to avoid cold-start UI gaps. */
const EVENT_TYPES = ["inbound_message", "status_update"]
const PROCESSING_STATUSES = ["PENDING", "SUCCESS", "FAILED"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDeviceLabel(device: DeviceListItem): string {
  return `${device.phoneNumber}${device.environment === "SANDBOX" ? " (Sandbox)" : ""}`
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function WhatsAppWebhookEventsPage() {
  const messages = getMessages(locale)
  const loadErrorMsg = messages.console.whatsapp.events.loadError
  const basePath = localizePathname({
    pathname: "/console/whatsapp/events",
    locale,
  })

  // Device list
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>("")

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
  const onboarding = useWhatsAppOnboarding()

  // ── Load devices on mount ────────────────────────────────────────────────

  const loadDevices = React.useCallback(async () => {
    try {
      const response = await whatsappClient.devices.list()
      setDevices(response.devices)

      if (response.devices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(response.devices[0].id)
      }
    } catch (err) {
      console.error("Failed to load devices:", err)
    }
  }, [selectedDeviceId])

  React.useEffect(() => {
    ;(async () => {
      await loadDevices()
    })()
  }, [loadDevices])

  // ── Load events when device, filters, or page changes ────────────────────

  const loadEvents = React.useCallback(async () => {
    if (!selectedDeviceId) {
      setPageState("loaded")
      setEvents([])
      setMeta({ total: 0, page: 1, totalPages: 0 })
      return
    }

    setPageState("loading")
    setErrorMessage("")

    try {
      const query: Record<string, string> = {
        page: String(page),
        limit: "20",
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

      const { data, error } = await eden.api.whatsapp.webhooks[
        selectedDeviceId
      ].events.get({
        $query: query,
      })

      if (error) {
        throw new Error(
          error.message ?? messages.console.whatsapp.events.loadError
        )
      }

      const result = data as unknown as EventsApiResponse
      setEvents(result.data)
      setMeta(result.meta)
      setPageState("loaded")
    } catch (err) {
      const message = err instanceof Error ? err.message : loadErrorMsg
      setPageState("error")
    }
  }, [selectedDeviceId, filters, page, loadErrorMsg])

  React.useEffect(() => {
    ;(async () => {
      await loadEvents()
    })()
  }, [loadEvents])
  if (onboarding.isFeatureLocked("webhook_logs")) {
    return (
      <>
        <LockedFeatureTeaser
          featureTitle="Raw Event Stream"
          featureDescription="Real-time telemetry log tracking raw Meta webhook events and processing states across connected devices."
          unlockLevel={3}
          prerequisiteDescription="Send your first message and approve a template to unlock raw event telemetry."
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel="Complete Active Mission"
        />
        <FlightHudWidget onboarding={onboarding} />
      </>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    setPage(1)
  }

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

  const handleRetryDevices = () => {
    void loadDevices()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.console.whatsapp.events.heading}
        </h1>
        <p className="text-muted-foreground">
          {messages.console.whatsapp.events.description}
        </p>
      </div>

      {/* Device Selector */}
      <Card>
        <CardHeader>
          <CardTitle>{messages.console.whatsapp.events.deviceTitle}</CardTitle>
          <CardDescription>
            {messages.console.whatsapp.events.deviceDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="device-select">
                {messages.console.whatsapp.events.deviceLabel}
              </Label>
              <Select
                value={selectedDeviceId}
                onValueChange={handleDeviceChange}
              >
                <SelectTrigger id="device-select" className="w-72">
                  <SelectValue
                    placeholder={messages.console.whatsapp.events.selectDevice}
                  />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      <span className="flex items-center gap-2">
                        <Phone className="size-3.5" />
                        {makeDeviceLabel(device)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar — only show when a device is selected */}
      {selectedDeviceId && (
        <WebhookEventFilter
          eventTypes={EVENT_TYPES}
          statuses={PROCESSING_STATUSES}
          devices={devices.map((d) => ({
            id: d.id,
            label: makeDeviceLabel(d),
          }))}
          onFilterChange={handleFilterChange}
          initialFilters={filters}
          showDeviceFilter={false}
        />
      )}

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>{messages.console.whatsapp.events.cardTitle}</CardTitle>
          <CardDescription>
            {selectedDeviceId
              ? messages.console.whatsapp.events.selectedDeviceDescription
              : messages.console.whatsapp.events.noDeviceDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!devices.length && pageState !== "error" ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone
                className="mb-3 size-10 text-muted-foreground"
                weight="fill"
              />
              <p className="text-sm text-muted-foreground">
                {messages.console.whatsapp.events.noDevices}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={handleRetryDevices}
              >
                <ArrowsClockwise className="mr-2 size-4" />
                {messages.console.whatsapp.events.retry}
              </Button>
            </div>
          ) : !selectedDeviceId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone
                className="mb-3 size-10 text-muted-foreground"
                weight="fill"
              />
              <p className="text-sm text-muted-foreground">
                {messages.console.whatsapp.events.selectDevicePrompt}
              </p>
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
              emptyActionHref={`${basePath.replace(/\/events$/, "/devices")}`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
