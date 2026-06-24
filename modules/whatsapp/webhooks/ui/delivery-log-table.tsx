/**
 * Delivery Log Table — reusable table for webhook delivery logs
 *
 * Shows delivery attempts with status badges, expandable request/response details.
 * Used in both Portal and Console surfaces.
 */

"use client"

import { useState, useCallback } from "react"
import {
  WarningCircle,
  ArrowsClockwise,
  Broadcast,
  CaretDown,
  CaretRight,
  ArrowClockwise,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { WebhookDeliveryLogDTO } from "../webhook-dispatcher.service"

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryLogTableProps = {
  logs: WebhookDeliveryLogDTO[]
  isLoading: boolean
  error?: string
  onRetry?: () => void
  onResend?: (logId: string) => void
  pagination?: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
  }
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT: Record<
  string,
  "success" | "destructive" | "warning" | "default"
> = {
  SUCCESS: "success",
  FAILED: "destructive",
  DEAD_LETTERED: "destructive",
  PENDING: "warning",
}

function getStatusBadgeVariant(
  status: string
): "success" | "destructive" | "warning" | "default" {
  return STATUS_BADGE_VARIANT[status] ?? "default"
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeliveryLogTable({
  logs,
  isLoading,
  error,
  onRetry,
  onResend,
  pagination,
}: DeliveryLogTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const handleRowToggle = useCallback((logId: string) => {
    setExpandedRowId((prev) => (prev === logId ? null : logId))
  }, [])

  const formatTimestamp = (iso: string | Date | null | undefined): string => {
    if (!iso) return "—"
    const date = typeof iso === "string" ? new Date(iso) : iso
    try {
      return date.toLocaleString()
    } catch {
      return typeof iso === "string" ? iso : iso.toISOString()
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-0">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Event Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>HTTP Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="size-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <WarningCircle className="mb-3 size-10 text-destructive" />
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <ArrowsClockwise className="mr-2 size-4" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Broadcast
          className="mb-3 size-10 text-muted-foreground"
          weight="fill"
        />
        <p className="text-sm text-muted-foreground">No delivery logs yet</p>
      </div>
    )
  }

  // ── Data table ────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Event Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempt</TableHead>
              <TableHead>HTTP Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const isExpanded = expandedRowId === log.id
              const statusVariant = getStatusBadgeVariant(log.status)

              return (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => handleRowToggle(log.id)}
                >
                  <TableCell>
                    {isExpanded ? (
                      <CaretDown className="size-4 text-muted-foreground" />
                    ) : (
                      <CaretRight className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{log.eventType}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant}>{log.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.attempt}/{log.maxAttempts}
                  </TableCell>
                  <TableCell>
                    {log.responseStatus ? (
                      <span
                        className={
                          log.responseStatus >= 200 && log.responseStatus < 300
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {log.responseStatus}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTimestamp(log.startedAt)}
                  </TableCell>
                  <TableCell>
                    {onResend &&
                      (log.status === "FAILED" ||
                        log.status === "DEAD_LETTERED") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Resend"
                          onClick={(e) => {
                            e.stopPropagation()
                            onResend(log.id)
                          }}
                        >
                          <ArrowClockwise className="size-4" />
                        </Button>
                      )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Expanded row content */}
      {expandedRowId && (
        <div className="mt-2 space-y-2 rounded-md border p-4">
          {(() => {
            const log = logs.find((l) => l.id === expandedRowId)
            if (!log) return null

            return (
              <>
                {log.errorMessage && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Error
                    </p>
                    <p className="text-sm text-red-600">{log.errorMessage}</p>
                  </div>
                )}
                {log.responseBody && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Response Body
                    </p>
                    <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                      {log.responseBody}
                    </pre>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
