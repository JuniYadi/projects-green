import { withAuth } from "@workos-inc/authkit-nextjs"
import { notFound } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { prisma } from "@/lib/prisma"
import { toDeviceDetail } from "@/modules/whatsapp/devices/devices.dto"
import type { DeviceDetail } from "@/modules/whatsapp/devices/devices.schemas"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DeviceActions } from "./device-actions"
import { QuotaBalanceCard } from "./quota-balance-card"
import { TabsDeviceDetail } from "@/modules/whatsapp/webhooks/ui/tabs-device-detail"

type DeviceDetailPageProps = {
  params: Promise<{
    deviceId: string
    lang: string
  }>
}

const formatDate = (date: string | null) => {
  if (!date) return "N/A"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

type InfoRowProps = {
  label: string
  value: string | number | React.ReactNode
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

export default async function PortalWhatsAppDeviceDetailPage({
  params,
}: DeviceDetailPageProps) {
  const { deviceId, lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  const devicesPath = localizePathname({
    pathname: "/portal/whatsapp/devices",
    locale,
  })

  let device: DeviceDetail | null = null

  const auth = await withAuth({ ensureSignedIn: true })
  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  const deviceRecord = await prisma.whatsappDevice.findFirst({
    where: {
      id: deviceId,
      ...(platformRole === "super_admin"
        ? {}
        : { organizationId: auth.organizationId }),
    },
  })

  if (!deviceRecord) {
    notFound()
  }

  device = toDeviceDetail(deviceRecord)

  // Overview tab content (existing cards)
  const overviewContent = (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device Information</CardTitle>
          <CardDescription>Core device details and identifiers</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow label="Phone Number" value={device.phoneNumber} />
            <InfoRow label="Name" value={device.name || "-"} />
            <InfoRow
              label="Environment"
              value={<Badge variant="outline">{device.environment}</Badge>}
            />
            <InfoRow
              label="WhatsApp Business Account ID"
              value={device.whatsappBusinessAccountId || "-"}
            />
            <InfoRow
              label="WhatsApp Phone ID"
              value={device.whatsappPhoneId || "-"}
            />
            <InfoRow label="Business ID" value={device.businessId || "-"} />
            <InfoRow label="Callback URL" value={device.callbackUrl || "-"} />
          </dl>
        </CardContent>
      </Card>

      <QuotaBalanceCard
        deviceId={device.id}
        initialBalance={device.balance}
        initialQuotaBase={device.quotaBase}
        initialQuotaBaseOut={device.quotaBaseOut}
        initialDailyLimitMessage={device.dailyLimitMessage}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Owner organization mapping</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow
              label="Organization ID"
              value={
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {device.organizationId}
                </code>
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timestamps</CardTitle>
          <CardDescription>Creation and activity dates</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow label="Created" value={formatDate(device.createdAt)} />
            <InfoRow
              label="Last Updated"
              value={formatDate(device.updatedAt)}
            />
            <InfoRow label="Expires" value={formatDate(device.expiredAt)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <TabsDeviceDetail
      device={{
        id: device.id,
        phoneNumber: device.phoneNumber,
        name: device.name,
        status: device.status,
        organizationId: device.organizationId,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      }}
      backHref={devicesPath}
      overviewChildren={overviewContent}
      actions={
        <DeviceActions deviceId={device.id} deviceStatus={device.status} />
      }
    />
  )
}
