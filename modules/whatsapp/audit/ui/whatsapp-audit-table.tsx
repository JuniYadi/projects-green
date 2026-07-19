"use client"

import * as React from "react"
import { CaretDown, CaretRight, WarningCircle } from "@phosphor-icons/react"

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
import { actionTone, type ActionTone } from "./whatsapp-audit-details"

// ─── Types ─────────────────────────────────────────────────────────────────

export type AuditLogDTO = {
  id: string
  organizationId: string
  deviceId: string | null
  adminId: string | null
  correlationId: string | null
  action: string
  status: string | null
  message: string | null
  errorMessage: string | null
  details: Record<string, unknown> | null
  durationMs: number | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

type PaginationMeta = {
  page: number
  totalPages: number
  total: number
}

export type AuditLogTableProps = {
  logs: AuditLogDTO[]
  isLoading: boolean
  error?: string
  onRetry?: () => void
  pagination?: PaginationMeta & { onPageChange: (page: number) => void }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function actionVariant(
  tone: ActionTone
): "success" | "destructive" | "warning" | "default" {
  switch (tone) {
    case "success":
      return "success"
    case "danger":
      return "destructive"
    case "warning":
      return "warning"
    default:
      return "default"
  }
}

function statusVariant(
  status: string | null
): "success" | "destructive" | "warning" | "default" {
  if (status === "OK") return "success"
  if (status === "FAILED") return "destructive"
  if (status === "STARTED" || status === "PENDING") return "warning"
  return "default"
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AuditLogTable({
  logs,
  isLoading,
  error,
  onRetry,
  pagination,
}: AuditLogTableProps) {
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null)

  // ── Loading ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-0">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="size-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <WarningCircle className="mb-3 size-10 text-destructive" />
        <p className="mb-1 text-sm font-medium">Failed to load audit logs</p>
        <p className="mb-4 text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    )
  }

  // ── Empty ─────────────────────────────────────────────────────────────

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">No audit entries</p>
      </div>
    )
  }

  // ── Data ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const isExpanded = expandedRowId === log.id
              return (
                <React.Fragment key={log.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedRowId(isExpanded ? null : log.id)
                        }}
                      >
                        {isExpanded ? (
                          <CaretDown className="size-4" />
                        ) : (
                          <CaretRight className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(actionTone(log.action))}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(log.status)}>
                        {log.status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {log.message ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.adminId ? log.adminId.slice(0, 8) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.durationMs != null ? `${log.durationMs}ms` : "—"}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium">Message:</span>{" "}
                            {log.message ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium">Error:</span>{" "}
                            {log.errorMessage ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium">IP:</span>{" "}
                            {log.ip ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium">User Agent:</span>{" "}
                            {log.userAgent ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium">Admin ID:</span>{" "}
                            {log.adminId ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium">Device ID:</span>{" "}
                            {log.deviceId ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium">Correlation ID:</span>{" "}
                            {log.correlationId ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium">Duration:</span>{" "}
                            {log.durationMs != null
                              ? `${log.durationMs}ms`
                              : "—"}
                          </div>
                          {log.details && (
                            <div className="col-span-2">
                              <span className="font-medium">Details:</span>
                              <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-xs">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
