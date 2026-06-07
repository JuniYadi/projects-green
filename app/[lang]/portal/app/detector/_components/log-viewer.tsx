"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useEffect, useState } from "react"

import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type InspectionLog = {
  id: string
  repoUrl: string
  ref: string | null
  detectedFramework: string | null
  confidence: number | null
  enforcedRuntimes: Array<{ runtimeId: string; version: string }> | null
  reasoning: string[]
  warnings: string[]
  durationMs: number | null
  status: string
  blockedByRuleId: string | null
  errorMessage: string | null
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: "success", label: "Success" },
  { value: "blocked", label: "Blocked" },
  { value: "error", label: "Error" },
  { value: "unsupported", label: "Unsupported" },
]

function LogDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: InspectionLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!log) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inspection Log Detail</DialogTitle>
          <DialogDescription>
            {log.repoUrl}
            {log.ref && ` @ ${log.ref}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Status</p>
              <Badge
                variant={
                  log.status === "success"
                    ? "default"
                    : log.status === "blocked"
                      ? "destructive"
                      : log.status === "error"
                        ? "warning"
                        : "secondary"
                }
              >
                {log.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Duration</p>
              <p className="text-sm text-muted-foreground">
                {log.durationMs ? `${log.durationMs}ms` : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Detected Framework</p>
              <p className="text-sm text-muted-foreground">
                {log.detectedFramework ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Confidence</p>
              <p className="text-sm text-muted-foreground">
                {log.confidence != null
                  ? `${(log.confidence * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {log.enforcedRuntimes && log.enforcedRuntimes.length > 0 && (
            <div>
              <p className="text-sm font-medium">Enforced Runtimes</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {log.enforcedRuntimes.map((rt, i) => (
                  <Badge key={i} variant="outline">
                    {rt.runtimeId} v{rt.version}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {log.reasoning.length > 0 && (
            <div>
              <p className="text-sm font-medium">AI Reasoning</p>
              <ul className="mt-1 space-y-1">
                {log.reasoning.map((reason, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground pl-4 border-l-2 border-muted"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {log.warnings.length > 0 && (
            <div>
              <p className="text-sm font-medium text-amber-600">Warnings</p>
              <ul className="mt-1 space-y-1">
                {log.warnings.map((warning, i) => (
                  <li
                    key={i}
                    className="text-sm text-amber-600 pl-4 border-l-2 border-amber-200"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {log.blockedByRuleId && (
            <div>
              <p className="text-sm font-medium text-destructive">
                Blocked By Rule
              </p>
              <p className="text-sm text-muted-foreground font-mono">
                {log.blockedByRuleId}
              </p>
            </div>
          )}

          {log.errorMessage && (
            <div>
              <p className="text-sm font-medium text-destructive">
                Error Message
              </p>
              <pre className="mt-1 rounded-md bg-destructive/10 p-2 text-xs text-destructive overflow-x-auto">
                {log.errorMessage}
              </pre>
            </div>
          )}

          <div>
            <p className="text-sm font-medium">Created At</p>
            <p className="text-sm text-muted-foreground">
              {new Date(log.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LogViewer() {
  const [logs, setLogs] = useState<InspectionLog[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedLog, setSelectedLog] = useState<InspectionLog | null>(null)
  const [offset, setOffset] = useState(0)
  const limit = 20
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    const abortController = new AbortController()

    async function fetchLogs() {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set("limit", String(limit))
        params.set("offset", String(offset))
        if (statusFilter !== "all") params.set("status", statusFilter)

        const res = await fetch(`/api/admin/detector/logs?${params}`, {
          signal: abortController.signal,
        })
        const data = await res.json()
        if (data.ok) {
          setLogs(data.data.logs)
          setTotal(data.data.total)
        } else {
          setError(data.message || "Failed to load logs")
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    void fetchLogs()
    return () => abortController.abort()
  }, [offset, statusFilter, refreshKey])

  const handlePrev = () => {
    setOffset((prev) => Math.max(0, prev - limit))
  }

  const handleNext = () => {
    setOffset((prev) => prev + limit)
  }

  const columns: ColumnDef<InspectionLog>[] = [
    {
      accessorKey: "repoUrl",
      header: "Repository",
      cell: ({ row }) => {
        const url = row.original.repoUrl
        // Extract owner/repo from URL
        const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
        const display = match ? match[1] : url
        return (
          <div className="font-mono text-xs max-w-[200px] truncate">
            {display}
          </div>
        )
      },
    },
    {
      accessorKey: "detectedFramework",
      header: "Framework",
      cell: ({ row }) => (
        <div>
          {row.original.detectedFramework ? (
            <Badge variant="outline">
              {row.original.detectedFramework}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "confidence",
      header: "Confidence",
      cell: ({ row }) => (
        <div>
          {row.original.confidence != null
            ? `${(row.original.confidence * 100).toFixed(0)}%`
            : "—"}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "success"
              ? "default"
              : row.original.status === "blocked"
                ? "destructive"
                : row.original.status === "error"
                  ? "warning"
                  : "secondary"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "durationMs",
      header: "Duration",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.original.durationMs ? `${row.original.durationMs}ms` : "—"}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Time",
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString()}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedLog(row.original)}
        >
          View
        </Button>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {total} total log{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={logs}
        searchableColumns={["repoUrl"]}
        searchPlaceholder="Search by repository..."
        emptyMessage="No inspection logs found."
      />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={offset === 0 || isLoading}
        >
          Previous
        </Button>
        <p className="text-sm text-muted-foreground">
          Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={offset + limit >= total || isLoading}
        >
          Next
        </Button>
      </div>
      <LogDetailDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null)
        }}
      />
    </div>
  )
}
