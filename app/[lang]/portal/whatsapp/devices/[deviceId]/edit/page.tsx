import { withAuth } from "@workos-inc/authkit-nextjs"
import { notFound } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { prisma } from "@/lib/prisma"
import { DeviceEditForm, type DeviceEditInitialData } from "./device-edit-form"

type EditDevicePageProps = {
  params: Promise<{
    deviceId: string
    lang: string
  }>
}

const toPlainObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

const formatDateTimeLocal = (date: Date | null) => {
  if (!date) return ""
  return date.toISOString().slice(0, 16)
}

export default async function EditWhatsAppDevicePage({
  params,
}: EditDevicePageProps) {
  const { deviceId, lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  const auth = await withAuth({ ensureSignedIn: true })
  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  if (platformRole !== "super_admin") {
    notFound()
  }

  const deviceRecord = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
  })

  if (!deviceRecord) {
    notFound()
  }

  const whatsappProfile = toPlainObject(deviceRecord.whatsappProfile)
  const device: DeviceEditInitialData = {
    id: deviceRecord.id,
    phoneNumber: deviceRecord.phoneNumber,
    status: deviceRecord.status,
    whatsappBusinessAccountId: deviceRecord.whatsappBusinessAccountId ?? "",
    whatsappPhoneId: deviceRecord.whatsappPhoneId ?? "",
    whatsappApplicationId: deviceRecord.whatsappApplicationId ?? "",
    whatsappVersion: deviceRecord.whatsappVersion,
    callbackUrl: deviceRecord.callbackUrl ?? "",
    quotaBase: deviceRecord.quotaBase.toString(),
    quotaBaseOut: String(deviceRecord.quotaBaseOut),
    dailyLimitMessage: String(deviceRecord.dailyLimitMessage),
    balance: deviceRecord.balance.toString(),
    expiredAt: formatDateTimeLocal(deviceRecord.expiredAt),
    rates: deviceRecord.rates ?? "",
    s3: deviceRecord.s3Path ?? "",
    displayName:
      typeof whatsappProfile.name === "string" ? whatsappProfile.name : "",
    whatsappProfile,
    features: toPlainObject(deviceRecord.features),
  }

  const backHref = localizePathname({
    pathname: `/portal/whatsapp/devices/${deviceRecord.id}`,
    locale,
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Edit WhatsApp Device</h1>
        <p className="text-sm text-muted-foreground">
          Update Meta Cloud API credentials, token storage, quotas, and device
          metadata.
        </p>
      </header>

      <DeviceEditForm locale={locale} device={device} backHref={backHref} />
    </main>
  )
}
