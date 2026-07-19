"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"

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
import {
  AuditLogTable,
  type AuditLogDTO,
} from "@/modules/whatsapp/audit/ui/whatsapp-audit-table"
import { TemplateList } from "@/modules/whatsapp/templates/ui/template-list"
import { useTemplates } from "@/modules/whatsapp/templates/api/templates.hooks"
import { DeliveryLogTable } from "@/modules/whatsapp/webhooks/ui/delivery-log-table"
import type { WebhookDeliveryLogDTO } from "@/modules/whatsapp/webhooks/webhook-dispatcher.service"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
          <TabsTrigger value="templates">
            Templates <TemplateCountBadge deviceId={device.id} />
          </TabsTrigger>
          <TabsTrigger value="webhook-log">Webhook Log</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {overviewChildren}
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Device Templates</CardTitle>
              <CardDescription>
                WhatsApp message templates synced to this device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateTabContent deviceId={device.id} />
            </CardContent>
          </Card>
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

        <TabsContent value="webhooks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Outgoing Webhooks</CardTitle>
              <CardDescription>
                Outgoing webhook configurations and delivery logs for this
                device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebhooksTab
                deviceId={device.id}
                organizationId={device.organizationId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit-logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Admin actions for this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogTabContent deviceId={device.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}

// ─── Webhooks Tab Content ─────────────────────────────────────────────

function WebhooksTab({
  deviceId,
  organizationId,
}: {
  deviceId: string
  organizationId: string
}) {
  type WebhooksTabState =
    | { type: "loading" }
    | {
        type: "loaded"
        webhooks: Array<{
          id: string
          webhookUrl: string
          authType: string | null
          active: boolean
        }>
      }
    | { type: "error"; error: string }

  const [state, setState] = React.useState<WebhooksTabState>({
    type: "loading",
  })
  const [deliveryLogs, setDeliveryLogs] = React.useState<
    WebhookDeliveryLogDTO[]
  >([])
  const [deliveryMeta, setDeliveryMeta] = React.useState({
    total: 0,
    page: 1,
    totalPages: 0,
  })
  const [selectedWebhookId, setSelectedWebhookId] = React.useState<
    string | null
  >(null)
  const [deliveryPage, setDeliveryPage] = React.useState(1)

  const fetchWebhooks = React.useCallback(async () => {
    setState({ type: "loading" })
    try {
      const { data, error } = await eden.api.whatsapp.webhooks.get({
        $query: { deviceId, organizationId },
      })
      if (error) throw new Error(error.message ?? "Failed to load webhooks")
      const result = data as unknown as {
        data: Array<{
          id: string
          webhookUrl: string
          authType: string | null
          active: boolean
        }>
      }
      setState({ type: "loaded", webhooks: result.data })
    } catch (err) {
      setState({
        type: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }, [deviceId, organizationId])

  const fetchDeliveries = React.useCallback(
    async (webhookId: string, page: number) => {
      try {
        const { data, error } = await eden.api.whatsapp.webhooks[
          webhookId
        ].deliveries.get({
          $query: { page: String(page), limit: "10" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- eden types don't support dynamic params
        } as any)
        if (error) throw new Error(error.message ?? "Failed to load deliveries")
        const result = data as unknown as {
          ok: boolean
          data: WebhookDeliveryLogDTO[]
          meta: { total: number; page: number; totalPages: number }
        }
        setDeliveryLogs(result.data)
        setDeliveryMeta(result.meta)
      } catch {
        // delivery fetch failed silently
      }
    },
    []
  )

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await fetchWebhooks()
    })()
    return () => {
      cancelled = true
    }
  }, [fetchWebhooks])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled || !selectedWebhookId) return
      await fetchDeliveries(selectedWebhookId, deliveryPage)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedWebhookId, deliveryPage, fetchDeliveries])

  const handleResend = async (deliveryLogId: string) => {
    if (!selectedWebhookId) return
    try {
      await eden.api.whatsapp.webhooks[selectedWebhookId].deliveries[
        deliveryLogId
      ].resend.post()
      void fetchDeliveries(selectedWebhookId, deliveryPage)
    } catch {
      // silent
    }
  }

  if (state.type === "loading") {
    return (
      <p className="py-4 text-sm text-muted-foreground">Loading webhooks…</p>
    )
  }

  if (state.type === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="mb-2 text-sm text-destructive">{state.error}</p>
        <Button variant="outline" onClick={() => void fetchWebhooks()}>
          Retry
        </Button>
      </div>
    )
  }

  if (state.webhooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No outgoing webhooks configured for this device.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Webhook list */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Auth</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.webhooks.map((wh) => (
              <TableRow
                key={wh.id}
                className={`cursor-pointer ${selectedWebhookId === wh.id ? "bg-muted/50" : ""}`}
                onClick={() => {
                  setSelectedWebhookId(wh.id)
                  setDeliveryPage(1)
                }}
              >
                <TableCell className="max-w-[250px] truncate font-mono text-sm">
                  {wh.webhookUrl}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{wh.authType ?? "none"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={wh.active ? "success" : "secondary"}>
                    {wh.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/portal/whatsapp/webhooks/${wh.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Detail
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delivery logs for selected webhook */}
      {selectedWebhookId && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Delivery Logs</h4>
          <DeliveryLogTable
            logs={deliveryLogs}
            isLoading={false}
            onResend={handleResend}
            pagination={
              deliveryMeta.totalPages > 1
                ? {
                    page: deliveryMeta.page,
                    totalPages: deliveryMeta.totalPages,
                    onPageChange: setDeliveryPage,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

// ─── Template Tab Content ────────────────────────────────────────────

function TemplateCountBadge({ deviceId }: { deviceId: string }) {
  type CountState =
    | { status: "loading" }
    | { status: "loaded"; count: number }
    | { status: "error" }
  const [state, setState] = React.useState<CountState>({ status: "loading" })

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await eden.api.whatsapp.templates.get({
          $query: { whatsappDeviceId: deviceId, limit: "1", page: "1" },
        })
        if (!cancelled) {
          const result = data as unknown as { meta: { total: number } }
          setState({ status: "loaded", count: result?.meta?.total ?? 0 })
        }
      } catch {
        if (!cancelled) setState({ status: "error" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deviceId])

  if (state.status === "loading") {
    return (
      <span className="ml-1 inline-block size-3 animate-pulse rounded-full bg-muted-foreground/30 align-middle" />
    )
  }
  if (state.status === "error") {
    return <span className="ml-1 text-xs text-muted-foreground">(?)</span>
  }
  return (
    <span className="ml-1 text-xs text-muted-foreground">({state.count})</span>
  )
}

function TemplateTabContent({ deviceId }: { deviceId: string }) {
  const { templates, loading, error, reload } = useTemplates({
    whatsappDeviceId: deviceId,
    sort: "desc",
  })

  return (
    <TemplateList
      templates={templates}
      loading={loading}
      error={error}
      onRetry={() => void reload()}
      emptyMessage="No templates synced to this device"
    />
  )
}

function AuditLogTabContent({ deviceId }: { deviceId: string }) {
  const [logs, setLogs] = React.useState<AuditLogDTO[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [errorMessage, setErrorMessage] = React.useState("")

  const fetchLogs = React.useCallback(async () => {
    setPageState("loading")
    setErrorMessage("")
    try {
      const res = await fetch(
        `/api/whatsapp/audit/devices/${deviceId}?page=${page}&limit=50`
      )
      const result = (await res.json()) as {
        ok: boolean
        data: AuditLogDTO[]
        pagination: { page: number; total: number; totalPages: number }
      }
      if (!result.ok) throw new Error("Failed to load audit logs")
      setLogs(result.data)
      setTotal(result.pagination.total)
      setTotalPages(result.pagination.totalPages)
      setPageState("loaded")
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load audit logs"
      )
      setPageState("error")
    }
  }, [deviceId, page])

  React.useEffect(() => {
    ;(async () => {
      await fetchLogs()
    })()
  }, [fetchLogs])

  const handleRetry = fetchLogs
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  return (
    <AuditLogTable
      logs={logs}
      isLoading={pageState === "loading"}
      error={pageState === "error" ? errorMessage : undefined}
      onRetry={handleRetry}
      pagination={
        totalPages > 1
          ? { page, totalPages, total, onPageChange: handlePageChange }
          : undefined
      }
    />
  )
}
