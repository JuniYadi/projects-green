"use client"

import { Plus, ArrowsClockwise } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

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
import {
  useTemplates,
  useSyncTemplate,
} from "@/modules/whatsapp/templates/api/templates.hooks"
import {
  MetaStatusBadge,
  TemplateList,
  TemplateStatusBadge,
} from "@/modules/whatsapp/templates/ui/template-list"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"

export default function ConsoleTemplatesPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const templatesBasePath = localizePathname({
    pathname: "/console/whatsapp/templates",
    locale,
  })

  const { templates, loading, error, reload } = useTemplates()
  const { sync, syncing } = useSyncTemplate()

  const handleSyncAll = async () => {
    const unsynced = templates.filter((t) => t.syncStatus === "NOT_SYNCED")

    if (unsynced.length === 0) {
      toast.info(messages.console.whatsapp.templates.allSynced)
      return
    }

    let synced = 0
    let failed = 0
    for (const template of unsynced) {
      try {
        await sync(template.id)
        synced++
      } catch {
        failed++
      }
    }

    if (synced > 0) {
      toast.success(
        messages.console.whatsapp.templates.syncedCount.replace(
          "{count}",
          String(synced)
        )
      )
      void reload()
    }

    if (failed > 0) {
      toast.error(
        messages.console.whatsapp.templates.syncFailed.replace(
          "{count}",
          String(failed)
        )
      )
    }
  }

  const syncedCount = templates.filter((t) => t.syncStatus === "SYNCED").length
  const notSyncedCount = templates.filter(
    (t) => t.syncStatus === "NOT_SYNCED"
  ).length

  const columns: ColumnDef<WhatsAppTemplate>[] = [
    {
      accessorKey: "name",
      header: "Template",
      cell: ({ row }) => (
        <div>
          <Button
            variant="ghost"
            className="h-auto p-0 font-medium hover:underline"
            onClick={() => router.push(`${templatesBasePath}/${row.original.id}`)}
          >
            {row.original.name}
          </Button>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorFn: (row) => row.syncStatus ?? "NOT_SYNCED",
      id: "syncStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Sync" />
      ),
      cell: ({ row }) => <TemplateStatusBadge status={row.original.syncStatus ?? "NOT_SYNCED"} />,
    },
    {
      accessorFn: (row) => row.metaStatus ?? "UNKNOWN",
      id: "metaStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Meta Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.metaStatus ?? "UNKNOWN"
        if (status === "UNKNOWN") return "—"
        return <MetaStatusBadge status={status} />
      },
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => row.original.category ?? "—",
    },
    {
      accessorFn: (row) => row.languages?.map((l) => l.lang).join(", ") ?? "",
      id: "languages",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Languages" />
      ),
    },
    {
      accessorFn: (row) => row.whatsappDeviceId ?? "",
      id: "whatsappDeviceId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Device" />
      ),
      cell: ({ row }) =>
        row.original.whatsappDeviceId ? row.original.whatsappDeviceId : "Any device",
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Creation Date" />
      ),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleString(),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Updated Date" />
      ),
      cell: ({ row }) =>
        new Date(row.original.updatedAt).toLocaleString(),
    },
    {
      id: "actions",
      enableHiding: false,
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`${templatesBasePath}/${row.original.id}`)}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.console.whatsapp.templates.heading}
        </h1>
        <p className="text-muted-foreground">
          {messages.console.whatsapp.templates.description}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {messages.console.whatsapp.templates.cardTitle}
            </CardTitle>
            <CardDescription>
              {messages.console.whatsapp.templates.cardDescription}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => void handleSyncAll()}
              disabled={syncing || loading}
              variant="outline"
            >
              <ArrowsClockwise
                className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing
                ? messages.console.whatsapp.templates.syncing
                : messages.console.whatsapp.templates.syncTemplates}
            </Button>
            <Button onClick={() => router.push(`${templatesBasePath}/new`)}>
              <Plus weight="bold" className="mr-2 size-4" />
              {messages.console.whatsapp.templates.createTemplate}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">
                {messages.console.whatsapp.templates.totalTemplates}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{syncedCount}</p>
              <p className="text-xs text-muted-foreground">
                {messages.console.whatsapp.templates.synced}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {notSyncedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {messages.console.whatsapp.templates.pendingSync}
              </p>
            </div>
          </div>

          {loading || error ? (
            <TemplateList
              templates={[]}
              loading={loading}
              error={error}
              onRetry={() => void reload()}
              onCreate={() => router.push(`${templatesBasePath}/new`)}
              onSelect={(id) => router.push(`${templatesBasePath}/${id}`)}
            />
          ) : (
            <DataTable
              columns={columns}
              data={templates}
              tableId="console-whatsapp-templates"
              searchPlaceholder="Search templates..."
              searchableColumns={[
                "name",
                "syncStatus",
                "metaStatus",
                "category",
                "languages",
                "whatsappDeviceId",
                "createdAt",
                "updatedAt",
              ]}
              initialSorting={[{ id: "createdAt", desc: true }]}
              pageSize={10}
              defaultColumnVisibility={{ whatsappDeviceId: false }}
              facetFilters={[
                {
                  columnId: "syncStatus",
                  label: "Sync",
                  options: [
                    { label: "Synced", value: "SYNCED" },
                    { label: "Not Synced", value: "NOT_SYNCED" },
                    { label: "Not in Meta", value: "NOT_IN_META" },
                  ],
                },
                {
                  columnId: "metaStatus",
                  label: "Meta Status",
                  options: [
                    { label: "Approved", value: "APPROVED" },
                    { label: "Pending", value: "PENDING" },
                    { label: "Rejected", value: "REJECTED" },
                  ],
                },
                {
                  columnId: "category",
                  label: "Category",
                  options: [
                    { label: "Marketing", value: "MARKETING" },
                    { label: "Utility", value: "UTILITY" },
                    { label: "Authentication", value: "AUTHENTICATION" },
                  ],
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
