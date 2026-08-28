"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Plus,
  ArrowsClockwise,
  CheckCircle,
  Clock,
  XCircle,
  CloudCheck,
  CloudArrowUp,
  CloudSlash,
  Question,
  Eye,
} from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { eden } from "@/lib/eden"
import {
  whatsappClient,
  type WhatsAppTemplate,
} from "@/lib/api/whatsapp-client"
import { useTemplates } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateLanguageBadge } from "@/modules/whatsapp/templates/ui/template-preview"

type TemplatesPageClientProps = {
  isSuperAdmin: boolean
}

const SYNC_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "SYNCED", label: "Synced" },
  { value: "NOT_SYNCED", label: "Not Synced" },
  { value: "NOT_IN_META", label: "Not In Meta" },
] as const

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
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} months ago`
  return `${Math.floor(diffMonths / 12)} years ago`
}

function TemplateStatusCell({ template }: { template: WhatsAppTemplate }) {
  const metaStatus = template.metaStatus ?? "UNKNOWN"
  const syncStatus = template.syncStatus ?? "NOT_SYNCED"

  const rejectionReasons = template.languages
    ?.map((l) => l.rejectReason)
    .filter((r): r is string => Boolean(r && r !== "NONE"))

  const firstRejectReason =
    rejectionReasons && rejectionReasons.length > 0 ? rejectionReasons[0] : null

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
                Meta Rejection Reason:
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
              Local DB: {syncStatus}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

export function TemplatesPageClient({
  isSuperAdmin,
}: TemplatesPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const organizationId = searchParams.get("organizationId") ?? undefined
  const whatsappDeviceId = searchParams.get("whatsappDeviceId") ?? undefined
  const syncStatus = searchParams.get("syncStatus") ?? undefined
  const sort = searchParams.get("sort") ?? "desc"

  const [isPulling, setIsPulling] = React.useState(false)
  const [lastPullTime, setLastPullTime] = React.useState<number>(0)
  const [cooldownRemaining, setCooldownRemaining] = React.useState<number>(0)

  const { templates, loading, error, reload } = useTemplates({
    organizationId,
    whatsappDeviceId,
    syncStatus: syncStatus || undefined,
    sort,
  })

  // ── Org list for super_admin ────────────────────────────────────────
  const [organizations, setOrganizations] = React.useState<
    { id: string; name: string }[]
  >([])
  const [orgsLoading, setOrgsLoading] = React.useState(false)
  const [orgsError, setOrgsError] = React.useState<string | null>(null)

  const loadOrganizations = React.useCallback(async () => {
    if (!isSuperAdmin) return
    setOrgsLoading(true)
    setOrgsError(null)
    try {
      const { data } = await eden.api.admin.organizations.get({
        $query: { limit: 100 },
      })
      const body = data as unknown as {
        ok: boolean
        data: { organizations: { id: string; name: string }[] }
      }
      if (body?.ok) {
        setOrganizations(body.data.organizations)
      }
    } catch {
      setOrgsError("Failed to load organizations")
    } finally {
      setOrgsLoading(false)
    }
  }, [isSuperAdmin])

  React.useEffect(() => {
    if (isSuperAdmin) void loadOrganizations() // eslint-disable-line react-hooks/set-state-in-effect
  }, [isSuperAdmin, loadOrganizations])

  // ── Device list ─────────────────────────────────────────────────────
  const [devices, setDevices] = React.useState<
    {
      id: string
      phoneNumber: string
      name?: string | null
      verifiedName?: string | null
    }[]
  >([])
  const [devicesLoading, setDevicesLoading] = React.useState(false)
  const [devicesError, setDevicesError] = React.useState<string | null>(null)

  const loadDevices = React.useCallback(async () => {
    setDevicesLoading(true)
    setDevicesError(null)
    try {
      const query: Record<string, string> = {}
      if (organizationId) query.organizationId = organizationId
      const { data } = await eden.api.whatsapp.devices.get({
        $query: query,
      })
      const body = data as unknown as {
        ok: boolean
        devices: {
          id: string
          phoneNumber: string
          name?: string | null
          verifiedName?: string | null
        }[]
      }
      if (body?.ok) {
        setDevices(body.devices)
      }
    } catch {
      setDevicesError("Failed to load devices")
    } finally {
      setDevicesLoading(false)
    }
  }, [organizationId])

  React.useEffect(() => {
    void loadDevices() // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadDevices])

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
    if (!whatsappDeviceId) {
      toast.error(
        "Please select a specific device to pull templates from Meta."
      )
      return
    }

    if (cooldownRemaining > 0) {
      toast.warning(
        `Please wait ${cooldownRemaining}s before syncing again to protect Meta rate limits.`
      )
      return
    }

    setIsPulling(true)
    try {
      const res = await whatsappClient.devices.pullTemplates(whatsappDeviceId)
      if (res.ok) {
        toast.success(
          `Successfully pulled ${res.syncedCount ?? 0} templates from Meta!`
        )
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

  // ── Filter helpers ──────────────────────────────────────────────────
  const setParam = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set("page", "1")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }

  const clearFilters = () => {
    router.push(window.location.pathname, { scroll: false })
  }

  const hasFilters = !!(
    organizationId ||
    whatsappDeviceId ||
    syncStatus ||
    sort !== "desc"
  )

  // ── DataTable Columns ───────────────────────────────────────────────
  const columns: ColumnDef<WhatsAppTemplate>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Template" />
      ),
      cell: ({ row }) => (
        <div>
          <Button
            variant="ghost"
            className="h-auto justify-start p-0 text-left font-medium hover:underline"
            onClick={() =>
              router.push(`/portal/whatsapp/templates/${row.original.id}`)
            }
          >
            {row.original.name}
          </Button>
          <p className="font-mono text-xs text-muted-foreground">
            {row.original.slug}
          </p>
        </div>
      ),
    },
    {
      accessorFn: (row) =>
        `${row.metaStatus ?? "UNKNOWN"}_${row.syncStatus ?? "NOT_SYNCED"}`,
      id: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <TemplateStatusCell template={row.original} />,
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.category ?? "—"}
        </Badge>
      ),
    },
    {
      accessorFn: (row) => row.languages?.map((l) => l.lang).join(", ") ?? "",
      id: "languages",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Languages" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.languages?.length ? (
            row.original.languages.map((language) => (
              <TemplateLanguageBadge
                key={language.id ?? language.lang}
                lang={language.lang}
                className="text-[10px]"
              />
            ))
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      accessorFn: (row) => {
        const matched = devices.find((d) => d.id === row.whatsappDeviceId)
        return matched
          ? `${matched.verifiedName || matched.name || ""} ${matched.phoneNumber}`
          : row.device?.phoneNumber || row.whatsappDeviceId || "Any device"
      },
      id: "device",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Device" />
      ),
      cell: ({ row }) => {
        const deviceId = row.original.whatsappDeviceId
        if (!deviceId) {
          return (
            <Badge
              variant="outline"
              className="text-xs font-normal text-muted-foreground"
            >
              Any device
            </Badge>
          )
        }

        const matched = devices.find((d) => d.id === deviceId)
        const displayName =
          matched?.verifiedName ||
          matched?.name ||
          row.original.device?.phoneNumber ||
          matched?.phoneNumber ||
          deviceId
        const phone = matched?.phoneNumber || row.original.device?.phoneNumber

        return (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto cursor-pointer justify-start p-0 text-left hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(
                      `/portal/whatsapp/devices/${deviceId}?tab=template`
                    )
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">
                      📱 {displayName}
                    </span>
                    {phone && displayName !== phone && (
                      <span className="text-[10px] text-muted-foreground">
                        {phone}
                      </span>
                    )}
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{displayName}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Device ID: {deviceId}
                </p>
                <p className="text-[10px] text-primary">Click to view device</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        const formattedFull = date.toLocaleString()
        const relative = formatRelativeTime(date)

        return (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-xs text-muted-foreground underline-offset-2 hover:underline">
                  {relative}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>{formattedFull}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() =>
            router.push(`/portal/whatsapp/templates/${row.original.id}`)
          }
        >
          <Eye className="mr-1.5 size-3.5" />
          View
        </Button>
      ),
    },
  ]

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* ── Filter Toolbar ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Org filter — super_admin only */}
            {isSuperAdmin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Organization
                </label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus:outline-hidden"
                  value={organizationId ?? ""}
                  onChange={(e) =>
                    setParam("organizationId", e.target.value || undefined)
                  }
                  disabled={orgsLoading}
                  aria-label="Filter by organization"
                >
                  <option value="">All organizations</option>
                  {orgsError ? (
                    <option value="" disabled>
                      {orgsError}
                    </option>
                  ) : (
                    organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Device filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Device
              </label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus:outline-hidden"
                value={whatsappDeviceId ?? ""}
                onChange={(e) =>
                  setParam("whatsappDeviceId", e.target.value || undefined)
                }
                disabled={devicesLoading}
                aria-label="Filter by device"
              >
                <option value="">All devices</option>
                {devicesError ? (
                  <option value="" disabled>
                    {devicesError}
                  </option>
                ) : (
                  devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.verifiedName || d.name || d.phoneNumber} (
                      {d.phoneNumber})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus:outline-hidden"
                value={syncStatus ?? ""}
                onChange={(e) =>
                  setParam("syncStatus", e.target.value || undefined)
                }
                aria-label="Filter by sync status"
              >
                {SYNC_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 self-end"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void handlePullFromMeta()}
              disabled={
                isPulling ||
                loading ||
                cooldownRemaining > 0 ||
                !whatsappDeviceId
              }
              title={
                !whatsappDeviceId
                  ? "Select a specific device to pull templates from Meta"
                  : cooldownRemaining > 0
                    ? `Rate limit protection: available in ${cooldownRemaining}s`
                    : "Pull approved templates from Meta Graph API for this device"
              }
            >
              <ArrowsClockwise
                className={`mr-1.5 size-4 ${isPulling ? "animate-spin" : ""}`}
              />
              {isPulling
                ? "Pulling..."
                : cooldownRemaining > 0
                  ? `Pull from Meta (${cooldownRemaining}s)`
                  : "Pull from Meta"}
            </Button>

            <Button
              size="sm"
              className="h-9"
              onClick={() => router.push("/portal/whatsapp/templates/new")}
            >
              <Plus weight="bold" className="mr-1.5 size-4" />
              Create Template
            </Button>
          </div>
        </div>

        {/* ── TanStack DataTable ────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-2 text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button variant="outline" onClick={() => void reload()}>
              <ArrowsClockwise className="mr-2 size-4" />
              Retry
            </Button>
          </div>
        ) : (
          <DataTable
            tableId="portal-whatsapp-templates"
            columns={columns}
            data={templates}
            searchPlaceholder="Search templates..."
            searchableColumns={["name", "category"]}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
