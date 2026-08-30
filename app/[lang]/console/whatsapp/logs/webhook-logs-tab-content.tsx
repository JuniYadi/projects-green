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
import type { Messages } from "@/lib/i18n/types"

type PageState = "loading" | "error" | "loaded"

const EVENT_TYPES = ["inbound_message", "status_update"]
const PROCESSING_STATUSES = ["PENDING", "SUCCESS", "FAILED"]

function makeDeviceLabel(device: DeviceListItem): string {
  return `${device.phoneNumber}${device.environment === "SANDBOX" ? " (Sandbox)" : ""}`
}

export function WebhookLogsTabContent({
  locale: _locale,
  messages,
}: {
  locale: string
  messages: Messages
}) {
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [events, setEvents] = React.useState<WebhookEventDTO[]>([])
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [errorMessage, setErrorMessage] = React.useState("")
  const [filters, setFilters] =
    React.useState<WebhookEventFilterState>(DEFAULT_FILTER_STATE)
  const [page, setPage] = React.useState(1)
  const [meta, setMeta] = React.useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  })

  const loadDevices = React.useCallback(async () => {
    try {
      const res = await eden.api.whatsapp.devices.get()
      if (
        res.status === 200 &&
        res.data &&
        "data" in res.data &&
        Array.isArray(res.data.data)
      ) {
        setDevices(res.data.data as unknown as DeviceListItem[])
      }
    } catch {
      // Non-blocking
    }
  }, [])

  const loadEvents = React.useCallback(async () => {
    setPageState("loading")
    setErrorMessage("")

    try {
      const query: Record<string, string> = {
        page: String(page),
        limit: "10",
      }

      if (filters.eventType) query.eventType = filters.eventType
      if (filters.processingStatus)
        query.processingStatus = filters.processingStatus
      if (filters.deviceId) query.deviceId = filters.deviceId
      if (filters.startDate) query.startDate = filters.startDate
      if (filters.endDate) query.endDate = filters.endDate

      const res = await eden.api.whatsapp.webhooks.events.get({
        query: query as {
          page?: string
          limit?: string
          deviceId?: string
          eventType?: string
          processingStatus?: string
          startDate?: string
          endDate?: string
        },
      })

      if (
        res.status === 200 &&
        res.data &&
        "data" in res.data &&
        Array.isArray(res.data.data)
      ) {
        setEvents(res.data.data as unknown as WebhookEventDTO[])
        if ("meta" in res.data && res.data.meta) {
          setMeta(
            res.data.meta as unknown as {
              total: number
              page: number
              limit: number
              totalPages: number
            }
          )
        }
        setPageState("loaded")
      } else {
        const errObj = res.data as
          | { error?: { message?: string } | string; message?: string }
          | undefined
        const errMsg =
          typeof errObj?.error === "object"
            ? errObj.error.message
            : errObj?.error || errObj?.message
        setErrorMessage(
          errMsg ?? messages.console.whatsapp.webhookLogs.loadFailed
        )
        setPageState("error")
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : messages.console.whatsapp.webhookLogs.loadFailed
      )
      setPageState("error")
    }
  }, [page, filters, messages])
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDevices()
  }, [loadDevices])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents()
  }, [loadEvents])
  const handleFilterChange = (newFilters: WebhookEventFilterState) => {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>
            {messages.console.whatsapp.webhookLogs.cardTitle}
          </CardTitle>
          <CardDescription>
            {messages.console.whatsapp.webhookLogs.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pageState === "loaded" && !devices.length && !events.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {messages.console.whatsapp.webhookLogs.noDevices}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void loadDevices()}
              >
                <ArrowsClockwise className="mr-2 size-4" />
                {messages.console.whatsapp.webhookLogs.retry}
              </Button>
            </div>
          ) : (
            <WebhookEventTable
              events={events}
              isLoading={pageState === "loading"}
              error={pageState === "error" ? errorMessage : undefined}
              onRetry={() => void loadEvents()}
              pagination={
                meta.totalPages > 1
                  ? {
                      page: meta.page,
                      totalPages: meta.totalPages,
                      onPageChange: (newPage) => setPage(newPage),
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
