import { withAuth } from "@workos-inc/authkit-nextjs"
import type { Metadata } from "next"
import Link from "next/link"

import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { prisma } from "@/lib/prisma"
import {
  toDeviceListItem,
  toDeviceHealthInfo,
} from "@/modules/whatsapp/devices/devices.dto"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import { getCachedOrganizations } from "@/lib/workos-directory"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge, DeviceEmptyState } from "./_components/devices-ui"
import { DeviceHealthBadge } from "@/modules/whatsapp/ui/device-health-badge"
import { MetaNameStatusBadge } from "@/modules/whatsapp/ui/meta-name-status-badge"
import { SyncButton } from "./_components/sync-button"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export const metadata: Metadata = { title: "WhatsApp Devices" }

function QuotaUsageCell({
  device,
  messages,
}: {
  device: DeviceListItem
  messages: ReturnType<typeof getMessages>
}) {
  const total = device.quotaBase > 0 ? device.quotaBase : 1000
  // In the billing model: quotaBaseOut is the REMAINING base quota!
  // When usage exceeds base quota, quotaBaseOut is negative (overdraft).
  const rawRemaining = Number(device.quotaBaseOut)
  const isOverdraft = rawRemaining < 0
  const used = total - rawRemaining
  const percent = total > 0 ? Math.round((used / total) * 100) : 0
  const barPercent = Math.min(Math.max(0, percent), 100)

  // Color bar: used >= 90% (or remaining <= 10%) = red/destructive, 75-90% = amber, <75% = emerald
  const barColor =
    percent >= 90 || isOverdraft
      ? "bg-destructive"
      : percent >= 75
        ? "bg-amber-500"
        : "bg-emerald-500"
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex w-36 cursor-pointer flex-col gap-1.5 py-1 text-left">
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-medium ${isOverdraft ? "text-destructive" : ""}`}
              >
                {used.toLocaleString()} / {total.toLocaleString()}
              </span>
              <span
                className={`text-[11px] font-semibold ${isOverdraft ? "text-destructive" : "text-muted-foreground"}`}
              >
                {percent}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${barPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">
                {messages.pPortalWhatsappDevices.usedLabel}{" "}
                {used.toLocaleString()}
              </span>
              <span
                className={
                  isOverdraft
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                }
              >
                {messages.pPortalWhatsappDevices.leftLabel}{" "}
                {rawRemaining.toLocaleString()}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex flex-col gap-1 text-xs">
          <p className="font-semibold">
            {messages.pPortalWhatsappDevices.quotaUsageTitle}
          </p>
          <p>
            {used.toLocaleString()} {messages.pPortalWhatsappDevices.ofLabel}{" "}
            {total.toLocaleString()}{" "}
            {messages.pPortalWhatsappDevices.messagesUsedLabel}
          </p>
          <p
            className={
              isOverdraft
                ? "font-medium text-destructive"
                : "text-muted-foreground"
            }
          >
            {isOverdraft
              ? `🔴 Overdraft: ${Math.abs(rawRemaining).toLocaleString()} messages over limit (${rawRemaining.toLocaleString()} left)`
              : rawRemaining === 0
                ? "🔴 Base quota exhausted"
                : `🟢 ${rawRemaining.toLocaleString()} messages remaining`}
          </p>
          {device.dailyLimitMessage > 0 && (
            <p className="text-muted-foreground">
              {messages.pPortalWhatsappDevices.dailyLimitLabel}{" "}
              {device.dailyLimitMessage.toLocaleString()}{" "}
              {messages.pPortalWhatsappDevices.messagesPerDayLabel}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
type DevicesPageProps = {
  params: Promise<{
    lang: string
  }>
  searchParams: Promise<{
    organizationId?: string
  }>
}

type DeviceRow = DeviceListItem & {
  displayName: string
  organizationName: string
  healthStatus: "CONNECTED" | "DISCONNECTED" | "UNKNOWN"
}

const formatDate = (date: string) => {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

const getDisplayName = (profile: unknown, fallback: string) => {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return fallback
  }

  const name = (profile as Record<string, unknown>).name
  return typeof name === "string" && name.trim() ? name.trim() : fallback
}

export default async function PortalWhatsAppDevicesPage({
  params,
  searchParams,
}: DevicesPageProps) {
  const { lang } = await params
  const { organizationId } = await searchParams
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)

  const auth = await withAuth({ ensureSignedIn: true })
  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  const isSuperAdmin = platformRole === "super_admin"
  const requestedOrganizationId =
    organizationId && organizationId !== "all" ? organizationId : undefined
  const selectedOrganizationId =
    requestedOrganizationId &&
    (isSuperAdmin || requestedOrganizationId === auth.organizationId)
      ? requestedOrganizationId
      : undefined
  const accessWhere = isSuperAdmin
    ? {}
    : { organizationId: auth.organizationId }

  const [organizationRows, deviceRecords] = await Promise.all([
    prisma.whatsappDevice.findMany({
      where: accessWhere,
      distinct: ["organizationId"],
      select: { organizationId: true },
      orderBy: { organizationId: "asc" },
    }),
    prisma.whatsappDevice.findMany({
      where: {
        ...accessWhere,
        ...(selectedOrganizationId
          ? { organizationId: selectedOrganizationId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const organizationIds = organizationRows.map((row) => row.organizationId)
  const organizations = await getCachedOrganizations(organizationIds)
  const organizationOptions = organizationIds.map((id) => ({
    id,
    name: organizations.get(id)?.name || id,
  }))

  const devices: DeviceRow[] = deviceRecords.map((record) => {
    const item = toDeviceListItem(record)
    const health = toDeviceHealthInfo(record)

    return {
      ...item,
      displayName: getDisplayName(record.whatsappProfile, item.name),
      organizationName:
        organizations.get(item.organizationId)?.name || item.organizationId,
      healthStatus: health.status,
    }
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {messages.pPortalWhatsappDevices.pageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.pPortalWhatsappDevices.pageDescription}
        </p>
      </header>

      <section className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {messages.pPortalWhatsappDevices.allDevicesTitle}
                </CardTitle>
                <CardDescription>
                  {messages.pPortalWhatsappDevices.allDevicesDescription}
                </CardDescription>
              </div>
              <form
                action={localizePathname({
                  pathname: "/portal/whatsapp/devices",
                  locale,
                })}
                className="flex items-center gap-2"
              >
                <select
                  name="organizationId"
                  defaultValue={selectedOrganizationId ?? "all"}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                  aria-label={
                    messages.pPortalWhatsappDevices
                      .filterByOrganizationAriaLabel
                  }
                >
                  <option value="all">
                    {messages.pPortalWhatsappDevices.allOrganizationsOption}
                  </option>
                  {organizationOptions.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  {messages.pPortalWhatsappDevices.filterButton}
                </Button>
              </form>
              <Link
                href={localizePathname({
                  pathname: "/portal/whatsapp/devices/new",
                  locale,
                })}
              >
                <Button size="sm">
                  <span
                    aria-hidden="true"
                    className="mr-1.5 text-base leading-none"
                  >
                    +
                  </span>
                  {messages.pPortalWhatsappDevices.addDeviceButton}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <DeviceEmptyState />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {messages.pPortalWhatsappDevices.organizationNameColumn}
                    </TableHead>
                    <TableHead>
                      {messages.pPortalWhatsappDevices.namePhoneColumn}
                    </TableHead>
                    <TableHead>
                      {messages.pPortalWhatsappDevices.metaNameStatusColumn}
                    </TableHead>
                    <TableHead>
                      {messages.pPortalWhatsappDevices.statusColumn}
                    </TableHead>
                    <TableHead>
                      {messages.pPortalWhatsappDevices.healthColumn}
                    </TableHead>
                    <TableHead>
                      {messages.pPortalWhatsappDevices.quotaUsageTitle}
                    </TableHead>
                    <TableHead className="text-right">
                      {messages.pPortalWhatsappDevices.dailyLimitColumn}
                    </TableHead>
                    <TableHead>
                      {messages.pPortalWhatsappDevices.createdColumn}
                    </TableHead>
                    <TableHead className="text-right">
                      {messages.pPortalWhatsappDevices.actionsColumn}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <Link
                          href={localizePathname({
                            pathname: `/portal/whatsapp/devices/${device.id}`,
                            locale,
                          })}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {device.organizationName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {device.verifiedName || device.displayName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {device.phoneNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <MetaNameStatusBadge
                          nameStatus={device.nameStatus}
                          verifiedName={device.verifiedName}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={device.status} />
                      </TableCell>
                      <TableCell>
                        <DeviceHealthBadge
                          status={device.healthStatus}
                          lastHeartbeatAt={device.lastHeartbeatAt}
                        />
                      </TableCell>
                      <TableCell>
                        <QuotaUsageCell device={device} messages={messages} />
                      </TableCell>
                      <TableCell className="text-right">
                        {device.dailyLimitMessage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(device.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <SyncButton deviceId={device.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
