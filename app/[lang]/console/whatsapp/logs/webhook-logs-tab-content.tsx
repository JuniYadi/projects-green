"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowsClockwise, DeviceMobile, User } from "@phosphor-icons/react"
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
  deliveryStatus?: string | null
  messageBody?: string | null
  createdAt: string | Date
  metaPayload?: Record<string, unknown> | null
}
const DEFAULT_COLUMNS: Record<string, boolean> = {
  device: true,
  contact: true,
  deliveryStatus: true,
  createdAt: true,
  actions: true,
  eventType: false,
  processingStatus: false,
  waMessageId: false,
  id: false,
}

function getDeliveryStatusBadge(
  deliveryStatus: string | null | undefined,
  processingStatus: string
) {
  const status = (deliveryStatus || processingStatus || "").toUpperCase()
  if (status === "READ") {
    return (
      <Badge
        variant="default"
        className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      >
        READ
      </Badge>
    )
  }
  if (status === "DELIVERED") {
    return (
      <Badge
        variant="default"
        className="border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300"
      >
        DELIVERED
      </Badge>
    )
  }
  if (status === "SENT") {
    return (
      <Badge
        variant="secondary"
        className="border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300"
      >
        SENT
      </Badge>
    )
  }
  if (status === "RECEIVED") {
    return (
      <Badge
        variant="outline"
        className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      >
        RECEIVED
      </Badge>
    )
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">FAILED</Badge>
  }
  return <Badge variant="secondary">{status || "PENDING"}</Badge>
}

function formatPhoneIndonesian(phone: string | null | undefined): string {
  if (!phone) return "—"
  const clean = phone.replace(/\D/g, "")
  if (clean.startsWith("62") && clean.length >= 10) {
    return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`
  }
  if (clean.startsWith("08") && clean.length >= 10) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`
  }
  return phone
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
        id: "device",
        accessorFn: (row) => `${row.deviceLabel || row.deviceId || ""}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colDevice} />
        ),
        cell: ({ row }) => {
          const deviceLabel =
            row.original.deviceLabel || row.original.deviceId || "—"
          const deviceId = row.original.deviceId

          return (
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                <DeviceMobile className="size-4" />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="max-w-[160px] cursor-help truncate font-mono text-xs font-semibold text-foreground underline decoration-dotted underline-offset-4">
                      {deviceLabel}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold">{t.drawer.deviceTooltip}</p>
                    <p className="font-mono text-muted-foreground">
                      {deviceId || "—"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )
        },
      },
      {
        id: "contact",
        accessorFn: (row) => `${row.phoneNumber || ""}`,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t.colRecipientContact}
          />
        ),
        cell: ({ row }) => {
          const contactPhone = row.original.phoneNumber
          if (!contactPhone)
            return <span className="text-xs text-muted-foreground">—</span>

          return (
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <User className="size-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-medium text-foreground">
                  {formatPhoneIndonesian(contactPhone)}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        id: "deliveryStatus",
        accessorFn: (row) => row.deliveryStatus || row.processingStatus,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colStatus} />
        ),
        cell: ({ row }) =>
          getDeliveryStatusBadge(
            row.original.deliveryStatus,
            row.original.processingStatus
          ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colTime} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleTimeString()}
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
        accessorKey: "eventType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.colEventType} />
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="w-fit text-xs font-medium capitalize"
          >
            {row.original.eventType.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "processingStatus",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t.colProcessingStatus}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.processingStatus}
          </span>
        ),
      },
      {
        accessorKey: "waMessageId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="WA Message ID" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.waMessageId || "—"}
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
                "deliveryStatus",
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
