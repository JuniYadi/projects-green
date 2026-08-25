"use client"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"

import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"

import * as React from "react"
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  CopySimple,
  Copy,
  WarningCircle,
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
import { actionTone, type ActionTone } from "./whatsapp-audit-details"

// ─── Types ─────────────────────────────────────────────────────────────────

export type AuditLogDTO = {
  id: string
  organizationId: string
  deviceId: string | null
  deviceLabel?: string | null
  phoneNumber?: string | null
  adminId: string | null
  actorName?: string | null
  actorEmail?: string | null
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
  showPayload?: boolean
  messageJourneyBasePath?: string
}

function maskWaMessageId(id: string | null): string {
  if (!id) return "—"
  if (id.length <= 26) return id
  const prefix = id.slice(0, 18)
  const suffix = id.slice(-6)
  return `${prefix}...${suffix}`
}

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
function DetailsViewer({ details }: { details: Record<string, unknown> }) {
  const [copied, setCopied] = React.useState(false)
  const jsonString = React.useMemo(
    () => JSON.stringify(details, null, 2),
    [details]
  )

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }, [jsonString])

  return (
    <div className="col-span-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          <WhatsAppText id="s200" />
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 gap-1.5 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
        >
          {copied ? (
            <>
              <CheckCircle className="size-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600">Copied</span>
            </>
          ) : (
            <>
              <CopySimple className="size-3.5" />
              <span>
                <WhatsAppText id="s201" />
              </span>
            </>
          )}
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto rounded-md border bg-background/95 p-3 font-mono text-xs leading-relaxed text-foreground select-all">
        {jsonString}
      </pre>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AuditLogTable({
  logs,
  isLoading,
  error,
  onRetry,
  pagination,
  showPayload = false,
  messageJourneyBasePath = "/console/whatsapp/messages",
}: AuditLogTableProps) {
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {showPayload && <TableHead className="w-10" />}
                <TableHead>
                  <WhatsAppText id="s113" />
                </TableHead>
                <TableHead>
                  <WhatsAppText id="s10" />
                </TableHead>
                <TableHead>
                  <WhatsAppText id="s202" />
                </TableHead>
                <TableHead>
                  <WhatsAppText id="s35" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <WhatsAppText id="s203" />
                </TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Time</TableHead>
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
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
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
            <WhatsAppText id="s101" />
          </Button>
        )}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          <WhatsAppText id="s204" />
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {showPayload && <TableHead className="w-10" />}
                <TableHead>
                  <WhatsAppText id="s113" />
                </TableHead>
                <TableHead>
                  <WhatsAppText id="s10" />
                </TableHead>
                <TableHead>
                  <WhatsAppText id="s202" />
                </TableHead>
                <TableHead>
                  <WhatsAppText id="s35" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <WhatsAppText id="s203" />
                </TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const isExpanded = showPayload && expandedRowId === log.id
                return (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className={
                        showPayload
                          ? "cursor-pointer hover:bg-muted/50"
                          : undefined
                      }
                      onClick={
                        showPayload
                          ? () => setExpandedRowId(isExpanded ? null : log.id)
                          : undefined
                      }
                    >
                      {showPayload && (
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
                      )}
                      <TableCell className="font-mono text-xs font-medium">
                        {log.deviceLabel ?? log.deviceId ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {log.phoneNumber ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.details &&
                        typeof log.details.waMessageId === "string" ? (
                          <div className="flex items-center gap-1">
                            <Link
                              href={`${messageJourneyBasePath}/${encodeURIComponent(log.details.waMessageId)}`}
                              className="font-mono text-xs text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {maskWaMessageId(log.details.waMessageId)}
                            </Link>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await navigator.clipboard.writeText(
                                        String(log.details!.waMessageId)
                                      )
                                      toast.success(
                                        "WA Message ID copied to clipboard"
                                      )
                                    } catch {
                                      toast.error("Failed to copy ID")
                                    }
                                  }}
                                >
                                  <Copy className="size-3 opacity-60 hover:opacity-100" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm font-mono text-xs break-all">
                                <p>{String(log.details.waMessageId)}</p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  <WhatsAppText id="s205" />
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ) : (
                          <span className="px-1.5 text-muted-foreground">
                            —
                          </span>
                        )}
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
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {log.message ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.actorName ??
                          (log.adminId ? log.adminId.slice(0, 10) : "System")}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                    {showPayload && isExpanded && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="font-medium">
                                <WhatsAppText id="s206" />
                              </span>{" "}
                              {log.message ?? "—"}
                            </div>
                            <div>
                              <span className="font-medium">
                                <WhatsAppText id="s207" />
                              </span>{" "}
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
                              <span className="font-medium">
                                <WhatsAppText id="s208" />
                              </span>{" "}
                              {log.adminId ?? "—"}
                            </div>
                            <div>
                              <span className="font-medium">
                                <WhatsAppText id="s209" />
                              </span>{" "}
                              {log.deviceId ?? "—"}
                            </div>
                            <div>
                              <span className="font-medium">
                                <WhatsAppText id="s210" />
                              </span>{" "}
                              {log.correlationId ?? "—"}
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>{" "}
                              {log.durationMs != null
                                ? `${log.durationMs}ms`
                                : "—"}
                            </div>
                            {log.details && (
                              <DetailsViewer details={log.details} />
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
              <WhatsAppText id="s211" />
              {pagination.page} <WhatsAppText id="s14" />
              {pagination.totalPages} ({pagination.total}{" "}
              <WhatsAppText id="s212" />
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
    </TooltipProvider>
  )
}
