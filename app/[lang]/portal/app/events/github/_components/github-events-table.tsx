"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"

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
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages = getMessagesForMaybeLocale(lang).console.app.githubEvents

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
        setError(messages.failedToLoadEvents)
        return
      }
      setEvents(res.data!.items as never)
      setTotal(res.data!.total as never)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.genericError)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, eventName, processStatus, deletedState, messages])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents()
  }, [loadEvents])

  const handleViewJson = useCallback(
    async (event: GithubEventRow) => {
      setIsLoadingDetail(true)
      setJsonModalOpen(true)
      try {
        const { data: res } =
          await eden.api.admin.app.events.github[event.id].get()
        if (res?.ok && res.data) {
          setSelectedEvent(res.data as unknown as GithubEventDetail)
        } else {
          setError(messages.failedToLoadEventDetail)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : messages.genericError)
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [messages]
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const columns = useMemo<ColumnDef<GithubEventRow>[]>(
    () => [
      {
        accessorKey: "receivedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.received} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.receivedAt).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "eventName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.event} />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.original.eventName}</span>
        ),
      },
      {
        accessorKey: "repositoryFullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.repository} />
        ),
        cell: ({ row }) => (
          <span className="text-xs">{row.original.repositoryFullName}</span>
        ),
      },
      {
        accessorKey: "branch",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.branch} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.branch}
          </span>
        ),
      },
      {
        accessorKey: "commitSha",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.commitSha} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {truncate(row.original.commitSha, 8)}
          </span>
        ),
      },
      {
        accessorKey: "commitMessage",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.message} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {truncate(row.original.commitMessage, 40)}
          </span>
        ),
      },
      {
        accessorKey: "senderLogin",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.sender} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.senderLogin}
          </span>
        ),
      },
      {
        accessorKey: "processStatus",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.status} />
        ),
        cell: ({ row }) => (
          <div className="space-y-1">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.original.processStatus ?? ""] ?? "bg-gray-100 text-gray-800"}`}
            >
              {row.original.processStatus}
            </span>
            {row.original.ignoreReason ? (
              <div className="text-xs text-muted-foreground">
                {row.original.ignoreReason}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void handleViewJson(row.original)}
          >
            JSON
          </Button>
        ),
        enableHiding: false,
      },
    ],
    [handleViewJson]
  )

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
            placeholder={messages.searchPlaceholder}
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
              <SelectValue placeholder={messages.eventTypePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="push">{messages.eventTypePush}</SelectItem>
              <SelectItem value="installation">
                {messages.eventTypeInstallation}
              </SelectItem>
              <SelectItem value="pull_request">
                {messages.eventTypePullRequest}
              </SelectItem>
              <SelectItem value="release">
                {messages.eventTypeRelease}
              </SelectItem>
              <SelectItem value="delete">{messages.eventTypeDelete}</SelectItem>
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
              <SelectValue placeholder={messages.statusPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="processed">
                {messages.statusProcessed}
              </SelectItem>
              <SelectItem value="pending">{messages.statusPending}</SelectItem>
              <SelectItem value="processing">
                {messages.statusProcessing}
              </SelectItem>
              <SelectItem value="failed">{messages.statusFailed}</SelectItem>
              <SelectItem value="ignored">{messages.statusIgnored}</SelectItem>
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
              <SelectValue placeholder={messages.visibilityPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">
                {messages.visibilityActive}
              </SelectItem>
              <SelectItem value="deleted">
                {messages.visibilityDeleted}
              </SelectItem>
              <SelectItem value="include_deleted">
                {messages.visibilityAll}
              </SelectItem>
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
              ? messages.noEventsMatchFilters
              : messages.noEventsRecorded}
          </p>
        ) : (
          <>
            <DataTable
              tableId="portal-github-events"
              columns={columns}
              data={events}
              searchPlaceholder={messages.tableSearchPlaceholder}
              searchableColumns={[
                "eventName",
                "repositoryFullName",
                "senderLogin",
              ]}
              defaultColumnVisibility={{
                branch: false,
                commitSha: false,
                commitMessage: false,
                senderLogin: false,
              }}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {messages.showingLabel} {events.length} {messages.ofLabel}{" "}
                {total} {messages.eventsLabel}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {messages.previous}
                </Button>
                <span>
                  {messages.pageLabel} {page} {messages.ofLabel} {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {messages.next}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
        <DialogContent className="max-h-[80vh] w-full max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{messages.rawEventPayload}</DialogTitle>
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
              {messages.noPayloadAvailable}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
