import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { DailyOperationsView } from "@/modules/portal/daily-operations/ui/daily-operations-view"
import { dailyOperationsService } from "@/modules/portal/daily-operations/daily-operations.service"

export default async function PortalPage({
  params,
}: Readonly<{
  params: Promise<{
    lang: string
  }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const overview = await dailyOperationsService.getOverview()

  const metrics = [...overview.actionRequired, ...overview.queueSummary]
  const workspacePaths = [
    "/portal/documentations",
    "/portal/support-tickets",
    "/portal/billing",
    "/portal/app",
  ]
  const localizedHrefs = Object.fromEntries(
    [
      ...metrics.map((metric) => [metric.key, metric.href] as const),
      ...workspacePaths.map((pathname) => [pathname, pathname] as const),
    ].map(([key, pathname]) => [key, localizePathname({ pathname, locale })])
  )

  return (
    <DailyOperationsView
      overview={overview}
      localizedHrefs={localizedHrefs}
      locale={locale}
    />
  )
}
