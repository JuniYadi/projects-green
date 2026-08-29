"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Plus, Trash, PaperPlaneTilt, Eye } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  whatsappClient,
  type Broadcast,
  type BroadcastStatus,
} from "@/modules/whatsapp/whatsapp-client"

const isDraftBroadcast = (broadcast: Broadcast) =>
  broadcast.status === "QUEUED" && broadcast.startedAt === null

const statusVariant = (status: BroadcastStatus, isDraft = false) => {
  if (isDraft) return "secondary"
  if (status === "COMPLETED") return "default"
  if (status === "COMPLETED_WITH_ERRORS") return "secondary"
  if (status === "PROCESSING") return "outline"
  return "secondary"
}
const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—"

export default function WhatsAppBroadcastsPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const basePath = localizePathname({
    pathname: "/portal/whatsapp/broadcasts",
    locale,
  })
  const [broadcasts, setBroadcasts] = React.useState<Broadcast[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadBroadcasts = React.useCallback(async () => {
    setLoading(true)
    try {
      setBroadcasts(await whatsappClient.listBroadcasts())
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load broadcasts"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      await loadBroadcasts()
    })()
  }, [loadBroadcasts])

  const handleSend = React.useCallback(
    async (broadcast: Broadcast) => {
      try {
        const message = await whatsappClient.sendBroadcast(broadcast.id)
        toast.success(message)
        await loadBroadcasts()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to send broadcast"
        )
      }
    },
    [loadBroadcasts]
  )

  const handleDelete = React.useCallback(
    async (broadcast: Broadcast) => {
      if (!window.confirm(`Delete broadcast ${broadcast.templateName}?`)) {
        return
      }

      try {
        await whatsappClient.deleteBroadcast(broadcast.id)
        toast.success("Broadcast deleted")
        await loadBroadcasts()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to delete broadcast"
        )
      }
    },
    [loadBroadcasts]
  )

  const columns = React.useMemo<ColumnDef<Broadcast>[]>(() => {
    return [
      {
        id: "templateName",
        accessorFn: (row) => row.templateName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Template" />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.templateName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.templateLanguage}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const isDraft = isDraftBroadcast(row.original)
          return (
            <Badge variant={statusVariant(row.original.status, isDraft)}>
              {isDraft
                ? "Draft / Ready to Send"
                : row.original.status.replaceAll("_", " ")}
            </Badge>
          )
        },
      },
      {
        accessorFn: (row) => row.sent,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Progress" />
        ),
        cell: ({ row }) => (
          <span>
            {row.original.sent} sent / {row.original.failed} failed /{" "}
            {row.original.total} total
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Actions" />
        ),
        cell: ({ row }) => {
          const isDraft = isDraftBroadcast(row.original)
          const canSend = row.original.status === "QUEUED"
          return (
            <div className="flex justify-end space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`${basePath}/${row.original.id}`)}
              >
                <Eye className="mr-1 size-4" />
                View
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        variant={isDraft ? "default" : "outline"}
                        disabled={!canSend}
                        onClick={() => void handleSend(row.original)}
                      >
                        <PaperPlaneTilt className="mr-1 size-4" />
                        Send
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isDraft
                      ? "Start sending broadcast to all queued recipients"
                      : canSend
                        ? "Resume/send broadcast"
                        : "Broadcast cannot be sent in current status"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleDelete(row.original)}
              >
                <Trash className="mr-1 size-4" />
                Delete
              </Button>
            </div>
          )
        },
      },
    ]
  }, [basePath, handleSend, handleDelete, router])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Broadcasts</h1>
          <p className="text-muted-foreground">
            Create, send, and monitor WhatsApp template broadcasts.
          </p>
        </div>
        <Button onClick={() => router.push(`${basePath}/new`)}>
          <Plus weight="bold" className="mr-2 size-4" />
          New broadcast
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            Broadcast campaigns with delivery progress and status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading broadcasts…
            </div>
          ) : (
            <DataTable
              tableId="console-whatsapp-broadcasts"
              columns={columns}
              data={broadcasts}
              searchableColumns={["templateName"]}
              searchPlaceholder="Search broadcasts..."
              defaultColumnVisibility={{
                createdAt: false,
              }}
              emptyMessage="No broadcasts yet."
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
