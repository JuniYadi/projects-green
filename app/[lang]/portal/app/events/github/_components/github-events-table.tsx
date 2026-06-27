"use client"

import { useCallback, useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type GithubEventRow = {
  id: string
  deliveryId?: string | null
  eventName: string
  action?: string | null
  githubInstallationId?: string | number | null
  githubRepositoryId?: string | number | null
  repositoryFullName?: string | null
  branch?: string | null
  commitSha?: string | null
  commitMessage?: string | null
  senderLogin?: string | null
  eventDisposition?: string | null
  ignoreReason?: string | null
  responseStatus?: number | null
  handlerDurationMs?: number | null
  enqueueStatus?: string | null
  processStatus?: string | null
  processError?: string | null
  receivedAt: string
  processedAt?: string | null
  deletedAt?: string | null
}

type GithubEventDetail = GithubEventRow & {
  payloadJson: unknown
}


const STATUS_BADGE: Record<string, string> = {
  processed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  ignored: "bg-gray-100 text-gray-800",
  retrying: "bg-orange-100 text-orange-800",
  dead_lettered: "bg-red-100 text-red-800",
}

function truncate(str: string | null | undefined, max: number) {
  if (!str) return null
  return str.length > max ? str.slice(0, max) + "…" : str
}

export function GithubEventsTable() {
  const [events, setEvents] = useState<GithubEventRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [eventName, setEventName] = useState<string>("")
  const [processStatus, setProcessStatus] = useState<string>("")
  const [deletedState, setDeletedState] = useState<string>("")

  const [selectedEvent, setSelectedEvent] = useState<GithubEventDetail | null>(
    null
  )
  const [jsonModalOpen, setJsonModalOpen] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const loadEvents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (search) params.set("search", search)
      if (eventName) params.set("eventName", eventName)
      if (processStatus) params.set("processStatus", processStatus)
      if (deletedState) params.set("deletedState", deletedState)

      const { data: res } = await eden.api.admin.app.events.github.get({
        $query: Object.fromEntries(params.entries()),
      })
      if (!res || !res.ok) {
        setError("Failed to load events")
        return
      }
      setEvents(res.data!.items as never)
      setTotal(res.data!.total as never)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, eventName, processStatus, deletedState])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents()
  }, [loadEvents])

  const handleViewJson = async (event: GithubEventRow) => {
    setIsLoadingDetail(true)
    setJsonModalOpen(true)
    try {
      const { data: res } =
        await eden.api.admin.app.events.github[event.id].get()
      if (res?.ok && res.data) {
        setSelectedEvent(res.data as unknown as GithubEventDetail)
      } else {
        setError("Failed to load event detail")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Search repos, commit SHA, sender…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="max-w-xs"
          />
          <Select
            value={eventName}
            onValueChange={(v) => {
              setEventName(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="push">push</SelectItem>
              <SelectItem value="installation">installation</SelectItem>
              <SelectItem value="pull_request">pull_request</SelectItem>
              <SelectItem value="release">release</SelectItem>
              <SelectItem value="delete">delete</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={processStatus}
            onValueChange={(v) => {
              setProcessStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="processed">processed</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="processing">processing</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
              <SelectItem value="ignored">ignored</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={deletedState}
            onValueChange={(v) => {
              setDeletedState(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="include_deleted">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search || eventName || processStatus || deletedState
              ? "No events match your filters."
              : "No GitHub events recorded yet."}
          </p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Received</TableHead>
                    <TableHead className="w-[90px]">Event</TableHead>
                    <TableHead>Repository</TableHead>
                    <TableHead className="w-[100px]">Branch</TableHead>
                    <TableHead className="w-[120px]">Commit SHA</TableHead>
                    <TableHead className="w-[200px]">Message</TableHead>
                    <TableHead className="w-[100px]">Sender</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(event.receivedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {event.eventName}
                      </TableCell>
                      <TableCell className="text-xs">
                        {event.repositoryFullName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.branch}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {truncate(event.commitSha, 8)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {truncate(event.commitMessage, 40)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.senderLogin}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[event.processStatus ?? ""] ?? "bg-gray-100 text-gray-800"}`}
                          >
                            {event.processStatus}
                          </span>
                          {event.ignoreReason ? (
                            <div className="text-xs text-muted-foreground">
                              {event.ignoreReason}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => void handleViewJson(event)}
                        >
                          JSON
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {events.length} of {total} events
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
        <DialogContent className="max-h-[80vh] w-full max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Raw Event Payload</DialogTitle>
          </DialogHeader>
          {isLoadingDetail ? (
            <Skeleton className="h-64 w-full" />
          ) : selectedEvent?.payloadJson &&
            typeof selectedEvent.payloadJson === "object" ? (
            <pre className="max-h-[60vh] overflow-auto overflow-x-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(selectedEvent.payloadJson, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No payload available.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
