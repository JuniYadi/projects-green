"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { eden } from "@/lib/eden"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowCounterClockwise,
  Warning,
  Clock,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

type DeadLetter = {
  id: string
  deviceId: string
  organizationId?: string
  eventType: string
  rawPayload: object
  errorMessage: string
  attemptCount: number
  failedAt: Date
  replayedAt: Date | null
  replayStatus: string | null
}

type DeadLetterListMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
}

type OrganizationListItem = {
  id: string
  name: string
}
function ReplayStatusBadge({ status }: { status: string | null }) {
  if (!status) return null

  switch (status) {
    case "SUCCESS":
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="mr-1 size-3" />
          Replayed
        </Badge>
      )
    case "FAILED":
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 size-3" />
          Failed
        </Badge>
      )
    case "PENDING":
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 size-3" />
          Pending
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function getColumns(
  lang: string,
  onReplay: (id: string) => void
): ColumnDef<DeadLetter>[] {
  const locale = lang || "en"

  return [
    {
      accessorKey: "failedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Failed At" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.failedAt)
        return date.toLocaleString(locale)
      },
      sortingFn: "datetime",
    },
    {
      accessorKey: "deviceId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Device ID" />
      ),
      cell: ({ row }) => (
        <code className="text-xs">{row.original.deviceId.slice(0, 8)}...</code>
      ),
    },
    {
      accessorKey: "eventType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Event Type" />
      ),
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.eventType}</Badge>
      ),
    },
    {
      accessorKey: "errorMessage",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Error" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[300px] truncate text-sm text-muted-foreground">
          {row.original.errorMessage}
        </span>
      ),
    },
    {
      accessorKey: "attemptCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Attempts" />
      ),
      cell: ({ row }) => row.original.attemptCount,
    },
    {
      accessorKey: "replayStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <ReplayStatusBadge status={row.original.replayStatus} />
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReplay(row.original.id)}
        >
          <ArrowCounterClockwise className="mr-1 size-4" />
          Replay
        </Button>
      ),
    },
  ]
}

type PageState = "loading" | "error" | "loaded"

export default function WebhookDeadLetterPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const [state, setState] = React.useState<PageState>("loading")
  const [error, setError] = React.useState("")
  const [data, setData] = React.useState<DeadLetter[]>([])
  const [meta, setMeta] = React.useState<DeadLetterListMeta | null>(null)
  const [organizations, setOrganizations] = React.useState<
    OrganizationListItem[]
  >([])
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>("all")

  const resolvedParams = React.use(params)
  const lang = resolvedParams.lang

  const loadData = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      setState("loading")
      try {
        const deadLetterRes = await eden.api.admin.whatsapp.webhooks[
          "dead-letter"
        ].get({
          $query: {
            page: "1",
            limit: "100",
          },
        })

        if (cancelled) return

        if (
          deadLetterRes.status === 200 &&
          deadLetterRes.data &&
          "data" in deadLetterRes.data
        ) {
          setData(deadLetterRes.data.data as DeadLetter[])
          setMeta(deadLetterRes.data.meta as DeadLetterListMeta)
          setState("loaded")
        } else {
          const errVal: unknown = deadLetterRes.error?.value
          const message =
            typeof errVal === "string"
              ? errVal
              : errVal && typeof errVal === "object" && "message" in errVal
                ? String(errVal.message)
                : "Failed to load dead letters"
          setError(message)
          setState("error")
        }
      } catch (err) {
        if (cancelled) return
        setError(String(err))
        setState("error")
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    return loadData()
  }, [loadData])

  React.useEffect(() => {
    let cancelled = false
    eden.api.admin.organizations.get({ $query: { limit: 100 } }).then((res) => {
      if (cancelled) return
      const body = res.data as unknown as {
        ok: boolean
        organizations: OrganizationListItem[]
      }
      if (body.ok) setOrganizations(body.organizations)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleReplay = async (id: string) => {
    try {
      const response = await eden.api.admin.whatsapp.webhooks["dead-letter"][
        id
      ].replay.post({})

      if (response.status === 200) {
        toast.success("Replay enqueued")
        void loadData()
      } else {
        toast.error(response.error?.value?.message ?? "Replay failed")
      }
    } catch (err) {
      toast.error(String(err))
    }
  }

  if (state === "loading" && data.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Warning className="mx-auto mb-4 size-12 text-destructive" />
          <h2 className="mb-2 text-lg font-semibold">Failed to load</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhook Dead Letters</h1>
          <p className="text-muted-foreground">
            Failed webhook payloads that exceeded retry limits
          </p>
        </div>
        {meta && (
          <div className="text-sm text-muted-foreground">
            {meta.total} total dead letters
          </div>
        )}
      </div>

      {/* Organization Filter */}
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Organization
          </label>
          <Select
            value={selectedOrgId}
            onValueChange={(val) => setSelectedOrgId(val)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable<DeadLetter>
        tableId="webhook-dead-letters"
        columns={getColumns(lang, handleReplay)}
        data={data}
        searchableColumns={[
          "deviceId",
          "eventType",
          "errorMessage",
          "replayStatus",
        ]}
        searchPlaceholder="Search dead letters..."
      />
    </main>
  )
}
