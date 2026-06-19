/**
 * Webhook Event Table — reusable data table for webhook events
 *
 * Displays webhook events with Type and Status badges, expandable
 * raw payload viewer, and loading/empty/error states.
 * Compatible with both Portal and Console surfaces.
 */

"use client"

import { useState, useCallback } from "react"
import {
  WarningCircle,
  ArrowsClockwise,
  Broadcast,
  CaretDown,
  CaretRight,
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
import { cn } from "@/lib/utils"

import { RawPayloadViewer } from "./raw-payload-viewer"

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebhookEventDTO = {
  id: string
  eventType: string
  processingStatus: string
  createdAt: string
  waMessageId: string | null
  metaPayload?: Record<string, unknown>
}

export type WebhookEventTableProps = {
  events: WebhookEventDTO[]
  isLoading: boolean
  error?: string
  onRetry?: () => void
  pagination?: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  emptyActionLabel?: string
  emptyActionHref?: string
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const TYPE_BADGE_CONFIG: Record<string, { label: string; className: string }> =
  {
    inbound_message: {
      label: "Inbound Message",
      className:
        "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
    status_update: {
      label: "Status Update",
      className:
        "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    },
  }

function getTypeBadgeConfig(eventType: string) {
  return (
    TYPE_BADGE_CONFIG[eventType] ?? {
      label: eventType,
      className:
        "bg-gray-50 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
    }
  )
}

const STATUS_BADGE_VARIANT: Record<
  string,
  "success" | "destructive" | "warning" | "default"
> = {
  SUCCESS: "success",
  FAILED: "destructive",
  PENDING: "warning",
}

function getStatusBadgeVariant(
  status: string
): "success" | "destructive" | "warning" | "default" {
  return STATUS_BADGE_VARIANT[status] ?? "default"
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WebhookEventTable({
  events,
  isLoading,
  error,
  onRetry,
  pagination,
  emptyActionLabel = "Verify Webhook Configuration",
  emptyActionHref,
}: WebhookEventTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const handleRowToggle = useCallback((eventId: string) => {
    setExpandedRowId((prev) => (prev === eventId ? null : eventId))
  }, [])

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
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
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>WA Message ID</TableHead>
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
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
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

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Broadcast
          className="mb-3 size-10 text-muted-foreground"
          weight="fill"
        />
        <p className="text-sm text-muted-foreground">No webhook events yet</p>
        {emptyActionHref && (
          <Button variant="outline" className="mt-3" asChild>
            <a href={emptyActionHref}>{emptyActionLabel}</a>
          </Button>
        )}
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
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>WA Message ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const isExpanded = expandedRowId === event.id
              const typeConfig = getTypeBadgeConfig(event.eventType)
              const statusVariant = getStatusBadgeVariant(
                event.processingStatus
              )

              return (
                <TableRow
                  key={event.id}
                  className="cursor-pointer"
                  onClick={() => handleRowToggle(event.id)}
                >
                  <TableCell>
                    {isExpanded ? (
                      <CaretDown className="size-4 text-muted-foreground" />
                    ) : (
                      <CaretRight className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        typeConfig.className
                      )}
                    >
                      {typeConfig.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant}>
                      {event.processingStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(event.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                    {event.waMessageId ?? "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Expanded row content */}
      {expandedRowId && (
        <div className="mt-2">
          {(() => {
            const event = events.find((e) => e.id === expandedRowId)
            if (!event?.metaPayload) return null
            return <RawPayloadViewer payload={event.metaPayload} />
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
