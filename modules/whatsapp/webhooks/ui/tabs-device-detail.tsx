"use client"

import * as React from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Phone, ArrowsClockwise } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Static filter options — not derived from loaded events to avoid cold-start UI gaps. */
const EVENT_TYPES = ["inbound_message", "status_update"]
const PROCESSING_STATUSES = ["PENDING", "SUCCESS", "FAILED"]

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

type DeviceBasicInfo = {
  id: string
  phoneNumber: string
  name?: string | null
  status: string
  organizationId: string
  createdAt: string
  updatedAt: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

type TabsDeviceDetailProps = {
  device: DeviceBasicInfo
  backHref: string
  overviewChildren: React.ReactNode
  actions?: React.ReactNode
}

// ─── Webhook Log Tab Content ─────────────────────────────────────────────────

function WebhookLogTabContent({ deviceId }: { deviceId: string }) {
  const [events, setEvents] = React.useState<WebhookEventDTO[]>([])
  const [meta, setMeta] = React.useState<{
    total: number
    page: number
    totalPages: number
  }>({ total: 0, page: 1, totalPages: 0 })
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [filters, setFilters] =
    React.useState<WebhookEventFilterState>(DEFAULT_FILTER_STATE)
  const [page, setPage] = React.useState(1)

  const loadEvents = React.useCallback(async () => {
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
        deviceId
      ].events.get({
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
  }, [deviceId, filters, page])

  React.useEffect(() => {
    ;(async () => {
      await loadEvents()
    })()
  }, [loadEvents])

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

  return (
    <div className="space-y-4">
      <WebhookEventFilter
        eventTypes={EVENT_TYPES}
        statuses={PROCESSING_STATUSES}
        devices={[]}
        onFilterChange={handleFilterChange}
        initialFilters={filters}
        showDeviceFilter={false}
      />

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
    </div>
  )
}

// ─── Tabs Layout ─────────────────────────────────────────────────────────────

export function TabsDeviceDetail({
  device,
  backHref,
  overviewChildren,
  actions,
}: TabsDeviceDetailProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultTab = searchParams.get("tab") || "overview"

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "overview") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={backHref}>Back to Devices</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{device.phoneNumber}</h1>
              <Badge
                variant={device.status === "ACTIVE" ? "success" : "secondary"}
              >
                {device.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Device {device.name && `- ${device.name}`}
            </p>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>

      <Tabs value={defaultTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="webhook-log">Webhook Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {overviewChildren}
        </TabsContent>

        <TabsContent value="webhook-log" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Events</CardTitle>
              <CardDescription>
                Incoming Meta webhook events for this device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebhookLogTabContent deviceId={device.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
