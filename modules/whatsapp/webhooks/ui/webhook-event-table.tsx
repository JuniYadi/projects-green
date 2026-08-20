/**
 * Webhook Event Table — reusable data table for webhook events
 *
 * Displays webhook events with Type and Status badges, expandable
 * raw payload viewer, and loading/empty/error states.
 * Compatible with both Portal and Console surfaces.
 */

"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import {
  WarningCircle,
  ArrowsClockwise,
  Broadcast,
  CaretDown,
  CaretRight,
  Copy,
  Check,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  deliveryStatus?: string | null
  phoneNumber?: string | null
  deviceLabel?: string | null
  createdAt: string
  waMessageId: string | null
  metaPayload?: Record<string, unknown> | null
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
  showPayload?: boolean
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

function getDeliveryBadgeConfig(status: string | null | undefined): {
  label: string
  variant:
    | "success"
    | "destructive"
    | "warning"
    | "default"
    | "secondary"
    | "outline"
  className?: string
} {
  const s = (status || "").toUpperCase()
  switch (s) {
    case "READ":
      return {
        label: "READ",
        variant: "success",
        className:
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      }
    case "DELIVERED":
      return {
        label: "DELIVERED",
        variant: "default",
        className:
          "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
      }
    case "SENT":
      return {
        label: "SENT",
        variant: "secondary",
        className:
          "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
      }
    case "RECEIVED":
      return {
        label: "RECEIVED",
        variant: "default",
        className:
          "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      }
    case "FAILED":
      return {
        label: "FAILED",
        variant: "destructive",
      }
    default:
      return {
        label: s || "PENDING",
        variant: "warning",
      }
  }
}
function maskWaMessageId(id: string | null): string {
  if (!id) return "—"
  if (id.length <= 16) return id
  const prefix = id.slice(0, 10)
  const suffix = id.slice(-6)
  return `${prefix}...${suffix}`
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
  showPayload = false,
}: WebhookEventTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyMessageId = useCallback(
    async (e: React.MouseEvent, waMessageId: string) => {
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(waMessageId)
        setCopiedId(waMessageId)
        toast.success("WA Message ID copied to clipboard")
        setTimeout(
          () => setCopiedId((curr) => (curr === waMessageId ? null : curr)),
          2000
        )
      } catch {
        toast.error("Failed to copy ID")
      }
    },
    []
  )

  const handleRowToggle = useCallback(
    (eventId: string) => {
      if (!showPayload) return
      setExpandedRowId((prev) => (prev === eventId ? null : eventId))
    },
    [showPayload]
  )
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
                {showPayload && <TableHead className="w-10" />}
                <TableHead>Device</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>WA Message ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {showPayload && (
                    <TableCell>
                      <Skeleton className="size-4" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
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
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-0">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {showPayload && <TableHead className="w-10" />}
                <TableHead>Device</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>WA Message ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const isExpanded = showPayload && expandedRowId === event.id
                const typeConfig = getTypeBadgeConfig(event.eventType)
                const deliveryConfig = getDeliveryBadgeConfig(
                  event.deliveryStatus || event.processingStatus
                )

                return (
                  <React.Fragment key={event.id}>
                    <TableRow
                      className={cn(
                        showPayload && "cursor-pointer hover:bg-muted/50"
                      )}
                      onClick={() => handleRowToggle(event.id)}
                    >
                      {showPayload && (
                        <TableCell>
                          {isExpanded ? (
                            <CaretDown className="size-4 text-muted-foreground" />
                          ) : (
                            <CaretRight className="size-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs font-medium">
                        {event.deviceLabel ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {event.phoneNumber ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.waMessageId ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="group/wamid inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                                onClick={(e) =>
                                  handleCopyMessageId(e, event.waMessageId!)
                                }
                              >
                                <span>
                                  {maskWaMessageId(event.waMessageId)}
                                </span>
                                {copiedId === event.waMessageId ? (
                                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="size-3.5 opacity-60 transition-opacity group-hover/wamid:opacity-100" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm font-mono text-xs break-all">
                              <p>{event.waMessageId}</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                Click to copy full ID
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="px-1.5 text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={deliveryConfig.variant}
                          className={deliveryConfig.className}
                        >
                          {deliveryConfig.label}
                        </Badge>
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
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatTimestamp(event.createdAt)}
                      </TableCell>
                    </TableRow>
                    {showPayload && isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-4">
                          {event.metaPayload ? (
                            <RawPayloadViewer payload={event.metaPayload} />
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No raw payload data available for this event.
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>

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
    </TooltipProvider>
  )
}
