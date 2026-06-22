import { withAuth } from "@workos-inc/authkit-nextjs"
import Link from "next/link"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { prisma } from "@/lib/prisma"
import { toDeviceListItem } from "@/modules/whatsapp/devices/devices.dto"
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
import { Button } from "@/components/ui/button"

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
}

const formatDate = (date: string) => {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
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
  const accessWhere = isSuperAdmin ? {} : { organizationId: auth.organizationId }

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

    return {
      ...item,
      displayName: getDisplayName(record.whatsappProfile, item.name),
      organizationName:
        organizations.get(item.organizationId)?.name || item.organizationId,
    }
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WhatsApp Devices</h1>
        <p className="text-sm text-muted-foreground">
          Manage all WhatsApp Business devices across organizations.
        </p>
      </header>

      <section className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">All Devices</CardTitle>
                <CardDescription>
                  View and manage WhatsApp devices across all organizations
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
                  aria-label="Filter by organization"
                >
                  <option value="all">All organizations</option>
                  {organizationOptions.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Filter
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
                  Add Device
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
                    <TableHead>Organization Name</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Quota Base</TableHead>
                    <TableHead className="text-right">Daily Limit</TableHead>
                    <TableHead>Created</TableHead>
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
                        <div className="font-medium">{device.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {device.phoneNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={device.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(device.balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        {device.quotaBase.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {device.dailyLimitMessage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(device.createdAt)}
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
