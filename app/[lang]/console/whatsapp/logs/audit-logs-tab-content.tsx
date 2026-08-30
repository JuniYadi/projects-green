"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowsClockwise } from "@phosphor-icons/react"
import type { Messages } from "@/lib/i18n/types"
import { AuditLogDetailSheet } from "@/modules/whatsapp/audit/ui/whatsapp-audit-sheet"
import { actionTone } from "@/modules/whatsapp/audit/ui/whatsapp-audit-details"

export type AuditLogRecord = {
  id: string
  action: string
  status?: string | null
  message?: string | null
  phoneNumber?: string | null
  adminId?: string | null
  actorName?: string | null
  actorEmail?: string | null
  deviceId?: string | null
  deviceLabel?: string | null
  ip?: string | null
  durationMs?: number | null
  createdAt: string | Date
  details?: Record<string, unknown>
}

const DEFAULT_COLUMNS: Record<string, boolean> = {
  deviceTarget: true,
  action: true,
  status: true,
  actor: true,
  createdAt: true,
  actions: true,
  message: false,
  ip: false,
  durationMs: false,
  id: false,
}

function formatActionLabel(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getAuditStatusBadge(
  status: string | null | undefined,
  successLabel: string,
  failLabel: string
) {
  const s = status?.toUpperCase() || "OK"
  if (s === "OK" || s === "SUCCESS") {
    return <Badge variant="default">{successLabel}</Badge>
  }
  if (s === "FAILED") {
    return <Badge variant="destructive">{failLabel}</Badge>
  }
  if (s === "STARTED" || s === "PENDING") {
    return <Badge variant="secondary">{s}</Badge>
  }
  return <Badge variant="outline">{s}</Badge>
}

export function AuditLogsTabContent({
  messages,
}: {
  locale: string
  messages: Messages
}) {
  const [logs, setLogs] = React.useState<AuditLogRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string>()
  const [selectedLog, setSelectedLog] = React.useState<AuditLogRecord | null>(
    null
  )
  const t = messages.console.whatsapp.logs

  const fetchLogs = React.useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const res = await eden.api.whatsapp.audit.get({
        query: {
          page: "1",
          limit: "100",
        },
      })

      if (
        res.status === 200 &&
        res.data &&
        "ok" in res.data &&
        res.data.ok &&
        Array.isArray(res.data.data)
      ) {
        setLogs(res.data.data as unknown as AuditLogRecord[])
      } else {
        const errData = res.data as
          | { message?: string; error?: string }
          | undefined
        throw new Error(errData?.message || errData?.error || t.loadError)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setIsLoading(false)
    }
  }, [t.loadError])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs()
  }, [fetchLogs])

  const columns = React.useMemo<ColumnDef<AuditLogRecord>[]>(
    () => [
      {
        id: "deviceTarget",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colDeviceContact} />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-medium text-foreground">
              {row.original.deviceLabel || row.original.deviceId || "—"}
            </span>
            {row.original.phoneNumber && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {row.original.phoneNumber}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colEventType} />
        ),
        cell: ({ row }) => {
          const tone = actionTone(row.original.action)
          return (
            <Badge
              variant={
                tone === "success"
                  ? "default"
                  : tone === "destructive"
                    ? "destructive"
                    : tone === "warning"
                      ? "outline"
                      : "secondary"
              }
              className="text-xs"
            >
              {formatActionLabel(row.original.action)}
            </Badge>
          )
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colStatus} />
        ),
        cell: ({ row }) =>
          getAuditStatusBadge(
            row.original.status,
            t.drawer.statusSuccess,
            t.drawer.statusFailed
          ),
      },
      {
        id: "actor",
        accessorKey: "actorName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colActor} />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">
              {row.original.actorName || "System"}
            </span>
            {row.original.actorEmail && (
              <span className="text-[11px] text-muted-foreground">
                {row.original.actorEmail}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colTime} />
        ),
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="text-xs">{t.colDetails}</span>,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-normal"
            onClick={() => setSelectedLog(row.original)}
          >
            {t.colDetails} →
          </Button>
        ),
      },
      {
        accessorKey: "message",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colMessageSummary} />
        ),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[200px] text-xs text-muted-foreground">
            {row.original.message || "—"}
          </span>
        ),
      },
      {
        accessorKey: "ip",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colIp} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.ip || "—"}
          </span>
        ),
      },
      {
        accessorKey: "durationMs",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colDuration} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.durationMs != null
              ? `${row.original.durationMs}ms`
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colLogId} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.id}
          </span>
        ),
      },
    ],
    [t]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.cardActivityTitle}</CardTitle>
          <CardDescription>{t.cardActivityDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void fetchLogs()}
              >
                <ArrowsClockwise className="mr-2 size-4" />
                {t.retry}
              </Button>
            </div>
          ) : (
            <DataTable
              tableId="console-whatsapp-audit-logs"
              columns={columns}
              data={logs}
              pageSize={10}
              searchableColumns={[
                "action",
                "status",
                "phoneNumber",
                "actorName",
                "message",
              ]}
              searchPlaceholder={t.searchActivityPlaceholder}
              defaultColumnVisibility={DEFAULT_COLUMNS}
              emptyMessage={isLoading ? t.loadingActivity : t.emptyActivity}
            />
          )}
        </CardContent>
      </Card>

      <AuditLogDetailSheet
        log={selectedLog}
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null)
        }}
      />
    </div>
  )
}
