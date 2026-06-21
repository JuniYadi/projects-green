import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { DeviceCreateWizard } from "./_components/device-create-wizard"

type NewDevicePageProps = {
  params: Promise<{ lang: string }>
}

export default async function NewDevicePage({ params }: NewDevicePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Add WhatsApp Device</h1>
        <p className="text-sm text-muted-foreground">
          Register a new WhatsApp Business device with detailed configuration.
        </p>
      </header>
      <DeviceCreateWizard locale={locale} />
    </main>
  )
}
