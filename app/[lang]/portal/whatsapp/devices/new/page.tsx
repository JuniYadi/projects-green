import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { DeviceCreateWizard } from "./_components/device-create-wizard"

export const metadata: Metadata = { title: "Add WhatsApp Device" }

type NewDevicePageProps = {
  params: Promise<{ lang: string }>
}

export default async function NewDevicePage({ params }: NewDevicePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pPortalPages.whatsappDeviceNew

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>
      <DeviceCreateWizard locale={locale} />
    </main>
  )
}
