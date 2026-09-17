"use client"
import {
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import { Plus, ArrowsClockwise, Trash } from "@phosphor-icons/react"
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CheckCircle,
  Clock,
  XCircle,
  CloudCheck,
  CloudArrowUp,
  CloudSlash,
  Question,
  Warning,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
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
  useDeleteTemplate,
} from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateDeleteDialog } from "@/modules/whatsapp/templates/ui/template-delete-dialog"
import { TemplateList } from "@/modules/whatsapp/templates/ui/template-list"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
import {
  whatsappClient,
  type WhatsAppTemplate,
} from "@/lib/api/whatsapp-client"
import { TemplateLanguageBadge } from "@/modules/whatsapp/templates/ui/template-preview"

export default function ConsoleTemplatesPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const templatesBasePath = localizePathname({
    pathname: "/console/whatsapp/templates",
    locale,
  })
  const onboarding = useWhatsAppOnboarding()

  const [devices, setDevices] = React.useState<
    Array<{
      id: string
      phoneNumber: string
      verifiedName?: string | null
      name?: string | null
      features?: Record<string, unknown> | null
    }>
  >([])
  const [loadingDevices, setLoadingDevices] = React.useState<boolean>(true)
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>("all")
  const [isPulling, setIsPulling] = React.useState(false)
  const [lastPullTime, setLastPullTime] = React.useState<number>(0)
  const [cooldownRemaining, setCooldownRemaining] = React.useState<number>(0)

  const { templates, loading, error, reload } = useTemplates(
    selectedDeviceId !== "all"
      ? { whatsappDeviceId: selectedDeviceId }
      : undefined
  )
  const { sync: _sync } = useSyncTemplate()
  const { remove: deleteTemplate, deleting: isDeletingSingle } =
    useDeleteTemplate()

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [deleteDialogState, setDeleteDialogState] = React.useState<{
    open: boolean
    templatesToDelete: WhatsAppTemplate[]
  }>({
    open: false,
    templatesToDelete: [],
  })
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)
  // Load devices for device selector
  React.useEffect(() => {
    void (async () => {
      setLoadingDevices(true)
      try {
        const res = await whatsappClient.devices.list()
        if (res.devices) {
          setDevices(res.devices)
          if (res.devices.length > 0) {
            setSelectedDeviceId(res.devices[0].id)
          }
        }
      } catch (e) {
        console.error("Failed to load devices for template selector:", e)
      } finally {
        setLoadingDevices(false)
      }
    })()
  }, [])
  React.useEffect(() => {
    if (lastPullTime === 0) return
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastPullTime) / 1000)
      const remaining = Math.max(0, 60 - elapsed)
      setCooldownRemaining(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [lastPullTime])

  const handlePullFromMeta = async () => {
    if (selectedDeviceId === "all" || !selectedDeviceId) {
      toast.error(
        "Please select a specific device to pull templates from Meta."
      )
      return
    }

    const targetDevice = selectedDeviceId

    if (cooldownRemaining > 0) {
      toast.warning(
        `Please wait ${cooldownRemaining}s before syncing again to protect Meta rate limits.`
      )
      return
    }

    setIsPulling(true)
    try {
      const { whatsappClient } = await import("@/lib/api/whatsapp-client")
      const res = await whatsappClient.devices.pullTemplates(targetDevice)
      if (res.ok) {
        const successMsg =
          messages.console.whatsapp.templates.pulledSuccess ||
          "Successfully pulled {count} templates from Meta!"
        toast.success(successMsg.replace("{count}", String(res.syncedCount)))
        setLastPullTime(Date.now())
        setCooldownRemaining(60)
        await reload()
      } else {
        toast.error("Failed to pull templates from Meta")
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to pull templates from Meta"
      )
    } finally {
      setIsPulling(false)
    }
  }

  const selectedTemplates = React.useMemo(() => {
    const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id]
    )
    return templates.filter((t) => selectedIds.includes(t.id))
  }, [rowSelection, templates])

  const handleOpenSingleDelete = (template: WhatsAppTemplate) => {
    setDeleteDialogState({
      open: true,
      templatesToDelete: [template],
    })
  }

  const handleOpenBulkDelete = () => {
    if (selectedTemplates.length === 0) return
    setDeleteDialogState({
      open: true,
      templatesToDelete: selectedTemplates,
    })
  }

  const handleConfirmDelete = async () => {
    const toDelete = deleteDialogState.templatesToDelete
    if (toDelete.length === 0) return

    if (toDelete.length === 1) {
      try {
        await deleteTemplate(toDelete[0].id)
        toast.success(
          locale === "id"
            ? "Template berhasil dihapus."
            : "Template deleted successfully."
        )
        setDeleteDialogState({ open: false, templatesToDelete: [] })
        setRowSelection((prev) => {
          const next = { ...prev }
          delete next[toDelete[0].id]
          return next
        })
        await reload()
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : locale === "id"
              ? "Gagal menghapus template."
              : "Failed to delete template."
        )
      }
      return
    }

    // Bulk deletion
    setIsBulkDeleting(true)
    try {
      const results = await Promise.allSettled(
        toDelete.map((t) => deleteTemplate(t.id))
      )
      const succeeded = results.filter((r) => r.status === "fulfilled").length
      const failed = results.filter((r) => r.status === "rejected").length

      if (succeeded > 0) {
        toast.success(
          locale === "id"
            ? `${succeeded} template berhasil dihapus.`
            : `Successfully deleted ${succeeded} template(s).`
        )
      }
      if (failed > 0) {
        toast.error(
          locale === "id"
            ? `${failed} template gagal dihapus.`
            : `Failed to delete ${failed} template(s).`
        )
      }

      setDeleteDialogState({ open: false, templatesToDelete: [] })
      setRowSelection({})
      await reload()
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const utilityCount = templates.filter(
    (t) => (t.category || "UTILITY").toUpperCase() === "UTILITY"
  ).length
  const authCount = templates.filter(
    (t) => (t.category || "").toUpperCase() === "AUTHENTICATION"
  ).length
  const marketingCount = templates.filter(
    (t) => (t.category || "").toUpperCase() === "MARKETING"
  ).length
  const syncedCount = templates.filter((t) => t.syncStatus === "SYNCED").length
  const totalCount = templates.length
  const isAllSynced = totalCount > 0 && syncedCount === totalCount

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId)
  const metaPermissions = selectedDevice?.features?.metaPermissions as
    | {
        status?: string
        canManageTemplates?: boolean
        warning?: string | null
      }
    | undefined
  function formatRelativeTime(dateString: string | Date): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec < 45) return "just now"
    if (diffSec < 90) return "1 min ago"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 45) return `${diffMin} mins ago`
    if (diffMin < 90) return "1 hour ago"
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 22) return `${diffHours} hours ago`
    if (diffHours < 36) return "1 day ago"
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays <= 1) return "1 day ago"
    if (diffDays < 30) return `${diffDays} days ago`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths} months ago`
    return `${Math.floor(diffMonths / 12)} years ago`
  }

  function TemplateStatusCell({ template }: { template: WhatsAppTemplate }) {
    const metaStatus = template.metaStatus ?? "UNKNOWN"
    const syncStatus = template.syncStatus ?? "NOT_SYNCED"

    // Extract rejection reasons if any
    const rejectionReasons = template.languages
      ?.map((l) => l.rejectReason)
      .filter((r): r is string => Boolean(r && r !== "NONE"))

    const firstRejectReason =
      rejectionReasons && rejectionReasons.length > 0
        ? rejectionReasons[0]
        : null

    // Meta Status Config
    const metaConfig: Record<
      string,
      { label: string; icon: React.ReactNode; variantClass: string }
    > = {
      APPROVED: {
        label: "Approved",
        icon: <CheckCircle weight="fill" className="size-3.5" />,
        variantClass:
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      },
      PENDING: {
        label: "In Review",
        icon: <Clock weight="fill" className="size-3.5" />,
        variantClass:
          "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      },
      REJECTED: {
        label: "Rejected",
        icon: <XCircle weight="fill" className="size-3.5" />,
        variantClass:
          "bg-destructive/15 text-destructive dark:text-red-400 border-destructive/30",
      },
      UNKNOWN: {
        label: "Draft",
        icon: <Question weight="bold" className="size-3.5" />,
        variantClass: "bg-muted text-muted-foreground border-border",
      },
    }

    // Local Sync Config
    const syncConfig: Record<
      string,
      { dotClass: string; tooltip: string; icon: React.ReactNode }
    > = {
      SYNCED: {
        dotClass: "bg-emerald-500",
        tooltip: "Synced to Meta",
        icon: <CloudCheck className="size-3 text-emerald-500" />,
      },
      SYNCING: {
        dotClass: "bg-blue-500 animate-pulse",
        tooltip: "Sync in progress...",
        icon: <CloudArrowUp className="size-3 animate-bounce text-blue-500" />,
      },
      NOT_SYNCED: {
        dotClass: "bg-amber-500",
        tooltip: "Draft / Not synced to Meta yet",
        icon: <CloudSlash className="size-3 text-amber-500" />,
      },
      NOT_IN_META: {
        dotClass: "bg-amber-500",
        tooltip: "Not found in Meta Graph API",
        icon: <CloudSlash className="size-3 text-amber-500" />,
      },
      FAILED: {
        dotClass: "bg-destructive",
        tooltip: "Sync failed with Meta",
        icon: <CloudSlash className="size-3 text-destructive" />,
      },
    }

    const currentMeta = metaConfig[metaStatus] ?? metaConfig.UNKNOWN
    const currentSync = syncConfig[syncStatus] ?? syncConfig.NOT_SYNCED

    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center gap-2">
          {metaStatus === "REJECTED" && firstRejectReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`flex cursor-help items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${currentMeta.variantClass}`}
                >
                  {currentMeta.icon}
                  {currentMeta.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-semibold text-destructive">
                  {
                    messages.pConsoleWhatsappTemplatesPageClient
                      .metaRejectionReason
                  }
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {firstRejectReason.replace(/_/g, " ")}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Badge
              variant="outline"
              className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${currentMeta.variantClass}`}
            >
              {currentMeta.icon}
              {currentMeta.label}
            </Badge>
          )}
          {syncStatus !== "SYNCED" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center p-0.5">
                  <span
                    className={`size-2 rounded-full ring-2 ring-background ${currentSync.dotClass}`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{currentSync.tooltip}</p>
                <p className="text-[10px] text-muted-foreground">
                  {messages.pConsoleWhatsappTemplatesPageClient.localDb}{" "}
                  {syncStatus}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    )
  }

  const columns: ColumnDef<WhatsAppTemplate>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={messages.pConsoleWhatsappTemplatesPageClient.selectAll}
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={messages.pConsoleWhatsappTemplatesPageClient.selectRow}
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Template",
      cell: ({ row }) => (
        <div>
          <Button
            variant="ghost"
            className="h-auto p-0 font-medium hover:underline"
            onClick={() =>
              router.push(`${templatesBasePath}/${row.original.id}`)
            }
          >
            {row.original.name}
          </Button>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
          {row.original.languages?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {row.original.languages.map((language) => (
                <TemplateLanguageBadge
                  key={language.id ?? language.lang}
                  lang={language.lang}
                  className="text-[10px]"
                />
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      accessorFn: (row) =>
        `${row.metaStatus ?? "UNKNOWN"}_${row.syncStatus ?? "NOT_SYNCED"}`,
      id: "status",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={getWhatsAppText("s302", locale)}
        />
      ),
      cell: ({ row }) => <TemplateStatusCell template={row.original} />,
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            messages.pConsoleWhatsappTemplatesPageClient.categoryColumnTitle
          }
        />
      ),
      cell: ({ row }) => {
        const cat = row.original.category
        const requestedCat = row.original.requestedCategory
        const isReclassified = requestedCat && cat && requestedCat !== cat

        if (!cat) return "—"

        if (isReclassified) {
          return (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="flex w-fit cursor-help items-center gap-1 border-amber-500/40 bg-amber-500/10 font-mono text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
                  >
                    <Warning
                      weight="fill"
                      className="size-3.5 text-amber-600 dark:text-amber-400"
                    />
                    <span>{cat}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    {
                      messages.pConsoleWhatsappTemplatesPageClient
                        .categoryAutoAdjustedByMeta
                    }
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {
                      messages.pConsoleWhatsappTemplatesPageClient
                        .templateSubmittedAs
                    }{" "}
                    <span className="font-semibold text-foreground">
                      {requestedCat}
                    </span>
                    {
                      messages.pConsoleWhatsappTemplatesPageClient
                        .butApprovedByMetaAs
                    }{" "}
                    <span className="font-semibold text-foreground">{cat}</span>
                    {
                      messages.pConsoleWhatsappTemplatesPageClient
                        .messageRateFollowsCategory
                    }{" "}
                    {cat}.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        return (
          <Badge variant="outline" className="font-mono text-xs">
            {cat}
          </Badge>
        )
      },
    },
    {
      accessorFn: (row) => row.languages?.map((l) => l.lang).join(", ") ?? "",
      id: "languages",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            messages.pConsoleWhatsappTemplatesPageClient.languagesColumnTitle
          }
        />
      ),
    },
    {
      accessorFn: (row) => {
        const matched = devices.find((d) => d.id === row.whatsappDeviceId)
        return matched
          ? `${matched.verifiedName || matched.name || ""} ${matched.phoneNumber}`
          : "Any device"
      },
      id: "whatsappDeviceId",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={getWhatsAppText("s113", locale)}
        />
      ),
      cell: ({ row }) => {
        const deviceId = row.original.whatsappDeviceId
        if (!deviceId) {
          return (
            <Badge
              variant="outline"
              className="text-xs font-normal text-muted-foreground"
            >
              <WhatsAppText id="s47" />
            </Badge>
          )
        }

        const matched = devices.find((d) => d.id === deviceId)
        const displayName =
          matched?.verifiedName || matched?.name || matched?.phoneNumber
        const phone = matched?.phoneNumber

        return (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help flex-col">
                  <span className="text-xs font-medium text-foreground">
                    {displayName || deviceId}
                  </span>
                  {phone && displayName !== phone && (
                    <span className="text-[10px] text-muted-foreground">
                      {phone}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{displayName}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  <WhatsAppText id="s177" />
                  {deviceId}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={getWhatsAppText("s178", locale)}
        />
      ),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={getWhatsAppText("s179", locale)}
        />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.updatedAt)
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const formattedFull = `${date.toLocaleString()} (${timeZone})`
        const relative = formatRelativeTime(date)

        return (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-sm text-foreground/90 underline-offset-2 hover:underline">
                  {relative}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-medium">
                <p>{formattedFull}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`${templatesBasePath}/${row.original.id}`)
            }
          >
            <WhatsAppText id="s180" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => handleOpenSingleDelete(row.original)}
            title={locale === "id" ? "Hapus template" : "Delete template"}
            aria-label={
              locale === "id"
                ? `Hapus ${row.original.name}`
                : `Delete ${row.original.name}`
            }
          >
            <Trash className="size-4" />
          </Button>
        </div>
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
          <div className="flex flex-wrap items-center gap-2">
            {loadingDevices ? (
              <Skeleton className="h-8 w-48 rounded-md" />
            ) : devices.length > 0 ? (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-hidden"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.verifiedName || d.name || d.phoneNumber} ({d.phoneNumber}
                    )
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              onClick={() => void handlePullFromMeta()}
              disabled={
                isPulling ||
                loading ||
                cooldownRemaining > 0 ||
                selectedDeviceId === "all" ||
                !selectedDeviceId
              }
              variant="outline"
              size="sm"
              title={
                selectedDeviceId === "all" || !selectedDeviceId
                  ? "Select a specific device to pull templates from Meta"
                  : cooldownRemaining > 0
                    ? `Rate limit protection: available in ${cooldownRemaining}s`
                    : "Pull approved templates from Meta Graph API into your database"
              }
            >
              <ArrowsClockwise
                className={`mr-2 size-4 ${isPulling ? "animate-spin" : ""}`}
              />
              {isPulling
                ? messages.console.whatsapp.templates.pulling
                : cooldownRemaining > 0
                  ? `${messages.console.whatsapp.templates.pullFromMeta} (${cooldownRemaining}s)`
                  : messages.console.whatsapp.templates.pullFromMeta}
            </Button>

            <Button
              onClick={() => router.push(`${templatesBasePath}/new`)}
              size="sm"
            >
              <Plus weight="bold" className="mr-2 size-4" />
              {messages.console.whatsapp.templates.createTemplate}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {metaPermissions &&
            !metaPermissions.canManageTemplates &&
            (metaPermissions.status === "NOT_ASSIGNED" ||
              metaPermissions.status === "MISSING_MANAGE_TASK") && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
                <Warning className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {locale === "id"
                      ? "Perhatian: Token WhatsApp Belum Memiliki Akses Penuh (MANAGE) di Meta"
                      : "Warning: WhatsApp Token Lacks Full Access (MANAGE) in Meta"}
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {metaPermissions.warning ||
                      (locale === "id"
                        ? "System User belum di-assign izin MANAGE pada WhatsApp Business Account di Meta Business Suite. Pembuatan dan penghapusan template di Meta akan ditolak sampai izin diberikan."
                        : "System User lacks MANAGE permissions on this WhatsApp Business Account in Meta Business Suite. Creating or deleting templates in Meta will fail until permissions are granted.")}
                  </p>
                </div>
              </div>
            )}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card/60 p-3.5 text-left shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {
                    messages.pConsoleWhatsappTemplatesPageClient
                      .utilityStatLabel
                  }
                </span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {messages.pConsoleWhatsappTemplatesPageClient.transBadge}
                </Badge>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {utilityCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {
                  messages.pConsoleWhatsappTemplatesPageClient
                    .notificationsAndAlerts
                }
              </p>
            </div>

            <div className="rounded-lg border bg-card/60 p-3.5 text-left shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {
                    messages.pConsoleWhatsappTemplatesPageClient
                      .authenticationStatLabel
                  }
                </span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {messages.pConsoleWhatsappTemplatesPageClient.authBadge}
                </Badge>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {authCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {
                  messages.pConsoleWhatsappTemplatesPageClient
                    .otpsAndVerifications
                }
              </p>
            </div>

            <div className="rounded-lg border bg-card/60 p-3.5 text-left shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {
                    messages.pConsoleWhatsappTemplatesPageClient
                      .marketingStatLabel
                  }
                </span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {messages.pConsoleWhatsappTemplatesPageClient.promoBadge}
                </Badge>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {marketingCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {
                  messages.pConsoleWhatsappTemplatesPageClient
                    .campaignsAndOffers
                }
              </p>
            </div>

            <div
              className={`rounded-lg border p-3.5 text-left shadow-2xs ${
                isAllSynced
                  ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {
                    messages.pConsoleWhatsappTemplatesPageClient
                      .metaSyncStatLabel
                  }
                </span>
                <span
                  className={`size-2 rounded-full ${
                    isAllSynced ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </div>
              <p
                className={`mt-1 text-2xl font-bold ${
                  isAllSynced
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {syncedCount} / {totalCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAllSynced
                  ? "100% Synced to Meta"
                  : `${totalCount - syncedCount} Pending / Draft`}
              </p>
            </div>
          </div>

          {selectedTemplates.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
              <span className="font-medium text-destructive">
                {locale === "id"
                  ? `${selectedTemplates.length} template dipilih`
                  : `${selectedTemplates.length} template(s) selected`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRowSelection({})}
                  disabled={isBulkDeleting}
                >
                  {locale === "id" ? "Batalkan Pilihan" : "Deselect All"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleOpenBulkDelete}
                  disabled={isBulkDeleting}
                >
                  <Trash className="mr-1.5 size-4" />
                  {locale === "id"
                    ? `Hapus Terpilih (${selectedTemplates.length})`
                    : `Delete Selected (${selectedTemplates.length})`}
                </Button>
              </div>
            </div>
          )}

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
              searchPlaceholder={
                messages.pConsoleWhatsappTemplatesPageClient
                  .searchTemplatesPlaceholder
              }
              searchableColumns={[
                "name",
                "status",
                "category",
                "languages",
                "whatsappDeviceId",
                "createdAt",
                "updatedAt",
              ]}
              initialSorting={[{ id: "updatedAt", desc: true }]}
              pageSize={10}
              enableRowSelection
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              getRowId={(row) => row.id}
              defaultColumnVisibility={{
                createdAt: false,
                languages: false,
              }}
              facetFilters={[
                {
                  columnId: "status",
                  allLabel: "All Status",
                  label: "Status",
                  options: [
                    { label: "Approved", value: "APPROVED" },
                    { label: "In Review", value: "PENDING" },
                    { label: "Rejected", value: "REJECTED" },
                  ],
                },
                {
                  columnId: "category",
                  allLabel: "All Category",
                  label:
                    messages.pConsoleWhatsappTemplatesPageClient
                      .categoryColumnTitle,
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
      <FlightHudWidget onboarding={onboarding} />

      <TemplateDeleteDialog
        open={deleteDialogState.open}
        onOpenChange={(open) =>
          setDeleteDialogState((prev) => ({
            ...prev,
            open,
            templatesToDelete: open ? prev.templatesToDelete : [],
          }))
        }
        templateName={
          deleteDialogState.templatesToDelete.length === 1
            ? deleteDialogState.templatesToDelete[0]?.name
            : undefined
        }
        templateNames={
          deleteDialogState.templatesToDelete.length > 1
            ? deleteDialogState.templatesToDelete.map((t) => t.name)
            : undefined
        }
        isApproved={deleteDialogState.templatesToDelete.some(
          (t) =>
            t.metaStatus === "APPROVED" ||
            t.languages?.some(
              (l) => l.metaStatus === "APPROVED" || l.isApproved
            )
        )}
        deleting={isDeletingSingle || isBulkDeleting}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  )
}
