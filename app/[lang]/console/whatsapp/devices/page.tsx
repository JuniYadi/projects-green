"use client"

import * as React from "react"
import { Info, Phone } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getMessages } from "@/lib/i18n/messages"
import { ServiceOrderDialog } from "@/components/billing/service-order-dialog"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { detectCountryFromPhone } from "@/modules/whatsapp/messages/phone-number"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
import { DeviceHealthBadge } from "@/modules/whatsapp/ui/device-health-badge"
import { MetaNameStatusBadge } from "@/modules/whatsapp/ui/meta-name-status-badge"
import type {
  DeviceListItem,
  DeviceStatus,
} from "@/modules/whatsapp/devices/devices.schemas"
// ─── Status badge ───────────────────────────────────────────────────────────

type DeviceStatusBadgeProps = {
  status: DeviceStatus
  messages: ReturnType<typeof getMessages>
}

function DeviceStatusBadge({ status, messages }: DeviceStatusBadgeProps) {
  const variant: Record<DeviceStatus, "success" | "secondary" | "destructive"> =
    {
      ACTIVE: "success",
      NON_ACTIVE: "secondary",
      DISCONNECTED: "destructive",
      UNKNOWN: "secondary",
    }

  const label: Record<DeviceStatus, string> = {
    ACTIVE: messages.console.whatsapp.devices.active,
    NON_ACTIVE: messages.console.whatsapp.devices.inactive,
    DISCONNECTED: messages.console.whatsapp.devices.disconnected,
    UNKNOWN: messages.console.whatsapp.devices.unknown,
  }

  return <Badge variant={variant[status]}>{label[status]}</Badge>
}

function getCountryFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return ""
  const codePoints = iso
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}
// ─── Meta Name Status badge ──────────────────────────────────────────────────

// ─── Quota Progress Bar with Tooltip ─────────────────────────────────────────

type QuotaUsageCellProps = {
  device: DeviceListItem
  messages: ReturnType<typeof getMessages>
}

function QuotaUsageCell({ device, messages }: QuotaUsageCellProps) {
  const total = device.quotaBase > 0 ? device.quotaBase : 1000
  // In the billing model: quotaBaseOut is the REMAINING base quota!
  // So: used = total - remaining (quotaBaseOut)
  const remaining = Math.max(0, Math.min(device.quotaBaseOut, total))
  const used = Math.max(0, total - remaining)
  const percent = Math.min(Math.round((used / total) * 100), 100)

  // Color bar: used >= 90% (or remaining <= 10%) = red/destructive, 75-90% = amber, <75% = emerald
  const barColor =
    percent >= 90
      ? "bg-destructive"
      : percent >= 75
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex w-36 cursor-pointer flex-col gap-1.5 py-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {used.toLocaleString()} / {total.toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {percent}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex flex-col gap-1 text-xs">
          <p className="font-semibold">
            {messages.console.whatsapp.devices.quotaUsage}
          </p>
          <p>
            {messages.console.whatsapp.devices.quota
              .replace("{used}", used.toLocaleString())
              .replace("{total}", total.toLocaleString())}
          </p>
          <p className="text-muted-foreground">
            {remaining === 0
              ? `🔴 ${messages.console.whatsapp.devices.quotaExhausted}`
              : `🟢 ${messages.console.whatsapp.devices.remaining.replace("{remaining}", remaining.toLocaleString())}`}
          </p>
          {device.dailyLimitMessage > 0 && (
            <p className="text-muted-foreground">
              {messages.console.whatsapp.devices.dailyLimit.replace(
                "{limit}",
                device.dailyLimitMessage.toLocaleString()
              )}
            </p>
          )}
          {Number(device.balance) > 0 && (
            <p className="text-muted-foreground">
              {messages.console.whatsapp.devices.balance.replace(
                "{amount}",
                Number(device.balance).toLocaleString("id-ID")
              )}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Header With Info Tooltip ────────────────────────────────────────────────

function ColumnHeaderWithTooltip({
  title,
  tooltip,
}: {
  title: string
  tooltip: string
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1">
        <span>{title}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-hidden"
              aria-label={tooltip}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDeviceHealthStatus(
  device: DeviceListItem
): "CONNECTED" | "DISCONNECTED" | "UNKNOWN" {
  if (device.status === "DISCONNECTED") return "DISCONNECTED"
  if (device.status === "ACTIVE" && device.lastHeartbeatAt) {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
    return new Date(device.lastHeartbeatAt) > fifteenMinAgo
      ? "CONNECTED"
      : "DISCONNECTED"
  }
  return "UNKNOWN"
}

// ─── Page component ─────────────────────────────────────────────────────────

export default function WhatsAppDevicesPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isOrderOpen, setIsOrderOpen] = React.useState(false)
  const onboarding = useWhatsAppOnboarding({
    deviceCount: devices.length,
  })

  // ponytail: not wrapped in useCallback — stable enough for effect dep
  const loadDevices = async () => {
    try {
      const { devices: items } = await whatsappClient.devices.list()
      setDevices(items)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : messages.console.whatsapp.devices.unableToLoad
      )
    } finally {
      setIsLoading(false)
    }
  }
  const diagnoseDevice = React.useCallback((device: DeviceListItem) => {
    window.dispatchEvent(
      new CustomEvent("agent_p_trigger", {
        detail: {
          toolName: "whatsapp.device.diagnose",
          input: { deviceId: device.id },
          context: {
            deviceId: device.id,
            phoneNumber: device.phoneNumber,
            status: device.status,
          },
        },
      })
    )
  }, [])

  React.useEffect(() => {
    ;(async () => {
      await loadDevices()
    })()
    // ponytail: loadDevices is stable, only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnDef<DeviceListItem>[] = [
    {
      accessorFn: (row) =>
        `${row.phoneNumber} ${row.verifiedName ?? ""} ${row.name ?? ""}`,
      id: "device",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={messages.console.whatsapp.devices.heading}
        />
      ),
      cell: ({ row }) => {
        const device = row.original
        const detected = detectCountryFromPhone(device.phoneNumber)
        const flag = detected?.iso ? getCountryFlagEmoji(detected.iso) : ""
        const countryName = detected?.country ?? ""

        return (
          <div className="flex flex-col gap-0.5">
            <p className="font-mono text-sm font-medium tracking-tight">
              {device.phoneNumber}
            </p>
            {(flag || countryName) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {flag && <span className="text-sm leading-none">{flag}</span>}
                <span>{countryName}</span>
              </p>
            )}
          </div>
        )
      },
    },
    {
      id: "quotaUsage",
      header: () => (
        <ColumnHeaderWithTooltip
          title={messages.console.whatsapp.devices.quotaUsage}
          tooltip={messages.console.whatsapp.devices.quotaUsageTooltip}
        />
      ),
      cell: ({ row }) => (
        <QuotaUsageCell device={row.original} messages={messages} />
      ),
    },
    {
      id: "displayName",
      header: () => (
        <ColumnHeaderWithTooltip
          title={messages.console.whatsapp.devices.displayName}
          tooltip={messages.console.whatsapp.devices.displayNameTooltip}
        />
      ),
      cell: ({ row }) => {
        const device = row.original
        const name =
          device.verifiedName ||
          (device.name !== device.phoneNumber ? device.name : null)

        return (
          <MetaNameStatusBadge
            nameStatus={device.nameStatus}
            verifiedName={name}
            showName
          />
        )
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <DataTableColumnHeader
            column={column}
            title={messages.console.whatsapp.devices.statusTitle}
          />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-hidden"
                  aria-label={messages.console.whatsapp.devices.statusTooltip}
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {messages.console.whatsapp.devices.statusTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
      cell: ({ row }) => (
        <DeviceStatusBadge status={row.original.status} messages={messages} />
      ),
    },
    {
      accessorFn: getDeviceHealthStatus,
      id: "health",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <DataTableColumnHeader column={column} title="Health" />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-hidden"
                  aria-label={messages.console.whatsapp.devices.healthTooltip}
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {messages.console.whatsapp.devices.healthTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
      cell: ({ row }) => (
        <DeviceHealthBadge
          status={getDeviceHealthStatus(row.original)}
          lastHeartbeatAt={row.original.lastHeartbeatAt}
        />
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const device = row.original
        if (device.status === "DISCONNECTED") {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => diagnoseDevice(device)}
            >
              [ 🔍 Diagnosa Masalah ]
            </Button>
          )
        }
        if (device.status === "ACTIVE") {
          return (
            <Button asChild variant="outline" size="sm">
              <Link
                href={localizePathname({
                  pathname: "/console/whatsapp/devices/" + device.id,
                  locale,
                })}
              >
                {messages.console.whatsapp.devices.manage}
              </Link>
            </Button>
          )
        }
        if (device.status === "NON_ACTIVE") {
          return (
            <span className="text-xs text-muted-foreground">
              {messages.console.whatsapp.devices.notifyAdmin}
            </span>
          )
        }
        return <span className="text-muted-foreground">—</span>
      },
    },
  ]

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.console.whatsapp.devices.heading}
          </h1>
          <p className="text-muted-foreground">
            {messages.console.whatsapp.devices.description}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{messages.console.whatsapp.devices.cardTitle}</CardTitle>
            <CardDescription>
              {messages.console.whatsapp.devices.cardDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="size-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.console.whatsapp.devices.heading}
          </h1>
          <p className="text-muted-foreground">
            {messages.console.whatsapp.devices.description}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{messages.console.whatsapp.devices.cardTitle}</CardTitle>
            <CardDescription>
              {messages.console.whatsapp.devices.cardDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex flex-col items-center justify-center py-8 text-center"
              role="alert"
            >
              <p className="text-sm font-medium text-destructive">
                {errorMessage}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => void loadDevices()}
              >
                {messages.console.whatsapp.devices.unableToLoad}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.console.whatsapp.devices.heading}
          </h1>
          <p className="text-muted-foreground">
            {messages.console.whatsapp.devices.description}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsOrderOpen(true)}>
          <Phone className="mr-2 size-4" />
          {messages.console.whatsapp.devices.connectNewDevice}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{messages.console.whatsapp.devices.cardTitle}</CardTitle>
          <CardDescription>
            {messages.console.whatsapp.devices.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                {messages.console.whatsapp.devices.noDevices}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {messages.console.whatsapp.devices.noDevicesDescription}
              </p>
              <Button
                className="mt-4"
                size="sm"
                onClick={() => setIsOrderOpen(true)}
              >
                <Phone className="mr-2 size-4" />
                {messages.console.whatsapp.devices.connectNewDevice}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={devices}
              tableId="console-whatsapp-devices"
              searchPlaceholder="Search devices by name or phone..."
              searchableColumns={["device"]}
              initialSorting={[{ id: "device", desc: false }]}
              pageSize={10}
              facetFilters={[
                {
                  columnId: "status",
                  allLabel: "All Status",
                  label: "Status",
                  options: [
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "NON_ACTIVE" },
                    { label: "Disconnected", value: "DISCONNECTED" },
                    { label: "Unknown", value: "UNKNOWN" },
                  ],
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <ServiceOrderDialog
        productCode="WHATSAPP"
        productTitle="WhatsApp"
        open={isOrderOpen}
        onOpenChange={setIsOrderOpen}
        lang={locale}
        messages={messages?.console?.billing?.serviceOrder}
        onSuccess={() => {
          void loadDevices()
        }}
      />

      <FlightHudWidget
        onboarding={onboarding}
        onSubscribeClick={() => setIsOrderOpen(true)}
      />
    </div>
  )
}
