"use client"

import * as React from "react"
import { ArrowsClockwise, Eye, Play } from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { eden } from "@/lib/eden"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = "loading" | "error" | "loaded"

type DeadLetterDTO = {
  id: string
  deviceId: string
  eventType: string
  rawPayload: object
  errorMessage: string
  attemptCount: number
  failedAt: string
  replayedAt: string | null
  replayStatus: string | null
}

type DeadLetterApiResponse = {
  ok: boolean
  data: DeadLetterDTO[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = ["inbound_message", "status_update"]
const REPLAY_STATUSES = ["PENDING", "SUCCESS", "FAILED", "null"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDeviceLabel(device: DeviceListItem): string {
  return `${device.phoneNumber}${device.environment === "SANDBOX" ? " (Sandbox)" : ""}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PortalWhatsAppWebhookDeadLetterPage() {
  // Device list
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const deviceMap = React.useMemo(
    () => new Map(devices.map((d) => [d.id, d])),
    [devices]
  )

  // Dead letters
  const [items, setItems] = React.useState<DeadLetterDTO[]>([])
  const [meta, setMeta] = React.useState<{
    total: number
    page: number
    totalPages: number
  }>({ total: 0, page: 1, totalPages: 0 })

  // UI state
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [selectedItem, setSelectedItem] = React.useState<DeadLetterDTO | null>(null)
  const [replayingId, setReplayingId] = React.useState<string | null>(null)

  // Filters
  const [deviceFilter, setDeviceFilter] = React.useState<string>("all")
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>("all")
  const [replayStatusFilter, setReplayStatusFilter] = React.useState<string>("all")
  const [page, setPage] = React.useState(1)

  // ── Load devices ────────────────────────────────────────────────────────────

  const loadDevices = React.useCallback(async () => {
    try {
      const { data } = await eden.api.whatsapp.devices.get()
      const result = data as unknown as { ok: boolean; devices: DeviceListItem[] }
      setDevices(result.devices)
    } catch (err) {
      console.error("Failed to load devices:", err)
    }
  }, [])

  React.useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  // ── Load dead letters ─────────────────────────────────────────────────────

  const loadDeadLetters = React.useCallback(async () => {
    setPageState("loading")
    setErrorMessage("")

    try {
      const query: Record<string, string> = {
        page: String(page),
        limit: "20",
      }

      if (deviceFilter !== "all") query.deviceId = deviceFilter
      if (eventTypeFilter !== "all") query.eventType = eventTypeFilter
      if (replayStatusFilter !== "all") query.replayStatus = replayStatusFilter

      const { data, error } = await eden.api.whatsapp.webhooks["dead-letter"].get({
        $query: query,
      })

      if (error) throw new Error(String(error))

      const result = data as unknown as DeadLetterApiResponse
      setItems(result.data)
      setMeta(result.meta)
      setPageState("loaded")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load dead letters")
      setPageState("error")
    }
  }, [deviceFilter, eventTypeFilter, replayStatusFilter, page])

  React.useEffect(() => {
    void loadDeadLetters()
  }, [loadDeadLetters])

  // ── Replay ─────────────────────────────────────────────────────────────────

  const handleReplay = async (id: string) => {
    setReplayingId(id)
    try {
      const { error } = await eden.api.whatsapp.webhooks["dead-letter"][id].replay.post()
      if (error) throw new Error(String(error))
      await loadDeadLetters()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Replay failed")
    } finally {
      setReplayingId(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Webhook Dead Letter Queue</h1>
        <p className="text-muted-foreground">
          Failed webhook payloads that exceeded retry attempts. View details and replay.
        </p>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={deviceFilter} onValueChange={(v) => { setDeviceFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {makeDeviceLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={replayStatusFilter} onValueChange={(v) => { setReplayStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Replay Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="null">Not Replayed</SelectItem>
                {REPLAY_STATUSES.filter((s) => s !== "null").map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDeadLetters()}
            >
              <ArrowsClockwise className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dead Letter Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dead Letters ({meta.total})</CardTitle>
          <CardDescription>
            Webhook payloads that failed after all retry attempts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pageState === "loading" ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : pageState === "error" ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button variant="outline" className="mt-3" onClick={() => void loadDeadLetters()}>
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No dead letters found.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Failed At</TableHead>
                    <TableHead>Replay</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {deviceMap.get(item.deviceId)
                          ? makeDeviceLabel(deviceMap.get(item.deviceId)!)
                          : item.deviceId.slice(0, 8)}
                      </TableCell>
                      <TableCell>{item.eventType}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.errorMessage}>
                        {item.errorMessage}
                      </TableCell>
                      <TableCell>{item.attemptCount}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.failedAt)}</TableCell>
                      <TableCell>
                        {item.replayStatus ? (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.replayStatus === "SUCCESS" ? "bg-green-100 text-green-800" :
                            item.replayStatus === "FAILED" ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                          }`}>
                            {item.replayStatus}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItem(item)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleReplay(item.id)}
                            disabled={replayingId === item.id}
                          >
                            <Play className={`size-4 ${replayingId === item.id ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {page} of {meta.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= meta.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dead Letter Detail</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">ID:</span>
                  <p className="font-mono text-xs">{selectedItem.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Device:</span>
                  <p className="font-mono text-xs">{selectedItem.deviceId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Event Type:</span>
                  <p>{selectedItem.eventType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Attempts:</span>
                  <p>{selectedItem.attemptCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Failed At:</span>
                  <p>{formatDate(selectedItem.failedAt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Error:</span>
                  <p className="text-destructive text-xs">{selectedItem.errorMessage}</p>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Raw Payload:</span>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto max-h-[300px]">
                  {JSON.stringify(selectedItem.rawPayload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
