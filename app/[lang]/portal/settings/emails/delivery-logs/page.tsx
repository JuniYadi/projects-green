import { withAuth } from "@workos-inc/authkit-nextjs"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformAccessForUser } from "@/lib/platform-role"
import { DeliveryLogsView } from "./delivery-logs-view"

export const metadata: Metadata = { title: "Email Delivery Logs" }

export default async function DeliveryLogsPage({
  params,
}: Readonly<{
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pPortalPages.settingsEmailsDeliveryLogs
  const auth = await withAuth({ ensureSignedIn: true })

  const platformAccess = await getPlatformAccessForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  if (platformAccess.role !== "super_admin") {
    redirect(localizePathname({ pathname: "/portal", locale }))
  }
  if (!platformAccess.exists) {
    redirect(localizePathname({ pathname: "/portal", locale }))
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>
      <DeliveryLogsView />
    </main>
  )
}
