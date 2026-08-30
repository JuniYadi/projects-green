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
import type { AppMessages } from "@/lib/i18n/messages/types"
import { WebhookEventDetailSheet } from "@/modules/whatsapp/webhooks/ui/webhook-event-sheet"

export type WebhookEventRecord = {
  id: string
  deviceId?: string | null
  deviceLabel?: string | null
  phoneNumber?: string | null
  waMessageId?: string | null
  eventType: string
  processingStatus: string
  createdAt: string | Date
  metaPayload?: Record<string, unknown> | null
}

const DEFAULT_COLUMNS: Record<string, boolean> = {
  devicePhone: true,
  eventType: true,
  processingStatus: true,
  createdAt: true,
  actions: true,
  waMessageId: false,
  deviceId: false,
  id: false,
}

function getEventStatusBadge(status: string) {
  const upper = status.toUpperCase()
  if (upper === "SUCCESS" || upper === "DELIVERED" || upper === "READ") {
    return <Badge variant="default">{status}</Badge>
  }
  if (upper === "RECEIVED") {
    return (
      <Badge
        variant="outline"
        className="border-blue-500 text-blue-600 dark:text-blue-400"
      >
        {status}
      </Badge>
    )
  }
  if (upper === "FAILED") {
    return <Badge variant="destructive">{status}</Badge>
  }
  return <Badge variant="secondary">{status}</Badge>
}

export function WebhookLogsTabContent({
  messages,
}: {
  locale: string
  messages: AppMessages
}) {
  const [events, setEvents] = React.useState<WebhookEventRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [selectedEvent, setSelectedEvent] =
    React.useState<WebhookEventRecord | null>(null)
  const t = messages.console.whatsapp.logs

  const loadEvents = React.useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const res = await (
        eden.api.whatsapp.webhooks.events.get as unknown as (opts: {
          query: { page: string; limit: string }
        }) => Promise<{
          status: number
          data: { data?: unknown[] }
        }>
      )({
        query: {
          page: "1",
          limit: "100",
        },
      })

      if (
        res.status === 200 &&
        res.data &&
        "data" in res.data &&
        Array.isArray(res.data.data)
      ) {
        setEvents(res.data.data as unknown as WebhookEventRecord[])
      } else {
        const errObj = res.data as
          | { error?: { message?: string } | string; message?: string }
          | undefined
        const errMsg =
          typeof errObj?.error === "object"
            ? errObj.error.message
            : errObj?.error || errObj?.message
        setErrorMessage(errMsg ?? t.loadError)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.loadError)
    } finally {
      setIsLoading(false)
    }
  }, [t.loadError])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents()
  }, [loadEvents])

  const columns = React.useMemo<ColumnDef<WebhookEventRecord>[]>(
    () => [
      {
        id: "devicePhone",
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
        accessorKey: "eventType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colEventType} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs capitalize">
            {row.original.eventType.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "processingStatus",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colStatus} />
        ),
        cell: ({ row }) => getEventStatusBadge(row.original.processingStatus),
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
            onClick={() => setSelectedEvent(row.original)}
          >
            {t.colDetails} →
          </Button>
        ),
      },
      {
        accessorKey: "waMessageId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colWaMessageId} />
        ),
        cell: ({ row }) => (
          <span className="inline-block max-w-[150px] truncate font-mono text-[11px] text-muted-foreground">
            {row.original.waMessageId || "—"}
          </span>
        ),
      },
      {
        accessorKey: "deviceId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colDeviceId} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.deviceId || "—"}
          </span>
        ),
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colEventId} />
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
          <CardTitle>{t.cardMessagesTitle}</CardTitle>
          <CardDescription>{t.cardMessagesDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void loadEvents()}
              >
                <ArrowsClockwise className="mr-2 size-4" />
                {t.retry}
              </Button>
            </div>
          ) : (
            <DataTable
              tableId="console-whatsapp-message-logs"
              columns={columns}
              data={events}
              pageSize={10}
              searchableColumns={[
                "phoneNumber",
                "eventType",
                "processingStatus",
                "waMessageId",
              ]}
              searchPlaceholder={t.searchMessagesPlaceholder}
              defaultColumnVisibility={DEFAULT_COLUMNS}
              emptyMessage={isLoading ? t.loadingMessages : t.emptyMessages}
            />
          )}
        </CardContent>
      </Card>

      <WebhookEventDetailSheet
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
      />
    </div>
  )
}
