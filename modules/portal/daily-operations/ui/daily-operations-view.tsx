import Link from "next/link"
import type { ElementType } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowRightIcon,
  BookOpenIcon,
  Cloud,
  ClockIcon,
  LifebuoyIcon,
  ReceiptIcon,
  StarIcon,
  WarningCircleIcon,
} from "@/components/ui/phosphor-icons"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  DailyOperationsDTO,
  DailyOperationsMetricDTO,
} from "../daily-operations.dto"

type Locale = "id" | "en" | string

type DailyOperationsViewProps = {
  overview: DailyOperationsDTO
  /** URLs are localized by the server page before they reach this view. */
  localizedHrefs?: Record<string, string>
  locale?: Locale
}

type EntryPoint = {
  title: string
  description: string
  href: string
  icon: ElementType
}

const entryPoints: EntryPoint[] = [
  {
    title: "Documentation Registry",
    description: "Kelola dokumentasi kontekstual untuk route dan workflow tim.",
    href: "/portal/documentations",
    icon: BookOpenIcon,
  },
  {
    title: "Support Tickets",
    description:
      "Prioritaskan dan balas tiket dukungan dari seluruh organisasi.",
    href: "/portal/support-tickets",
    icon: LifebuoyIcon,
  },
  {
    title: "Billing",
    description: "Pantau order, invoice, pembayaran, dan aktivitas penagihan.",
    href: "/portal/billing",
    icon: ReceiptIcon,
  },
  {
    title: "App Hosting",
    description: "Kelola cluster dan deployment aplikasi yang di-hosting.",
    href: "/portal/app",
    icon: Cloud,
  },
]

const getAgeLabel = (ageMinutes: number | null, locale: Locale) => {
  if (ageMinutes === null)
    return locale === "en" ? "Age unavailable" : "Usia tidak tersedia"
  if (ageMinutes < 1) return locale === "en" ? "Just now" : "Baru saja"

  if (locale === "en") {
    if (ageMinutes < 60)
      return `${ageMinutes} ${ageMinutes === 1 ? "minute" : "minutes"} ago`
    const hours = Math.floor(ageMinutes / 60)
    if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
    const days = Math.floor(hours / 24)
    return `${days} ${days === 1 ? "day" : "days"} ago`
  }

  if (ageMinutes < 60) return `${ageMinutes} menit lalu`
  const hours = Math.floor(ageMinutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

const getStatus = (metric: DailyOperationsMetricDTO, locale: Locale) => {
  if (!metric.available) {
    return {
      label: locale === "en" ? "Unavailable" : "Tidak tersedia",
      variant: "warning" as const,
    }
  }

  if (metric.count === 0) {
    return {
      label: locale === "en" ? "Clear" : "Bersih",
      variant: "success" as const,
    }
  }

  return {
    label: locale === "en" ? "Needs action" : "Perlu tindakan",
    variant: "destructive" as const,
  }
}

const getCleanMessage = (metric: DailyOperationsMetricDTO, locale: Locale) => {
  if (locale === "en") return `Queue clear — no ${metric.label.toLowerCase()}`
  return `Antrean bersih — tidak ada ${metric.label.toLowerCase()}`
}

function MetricCard({
  metric,
  localizedHrefs,
  locale,
  action,
}: {
  metric: DailyOperationsMetricDTO
  localizedHrefs?: Record<string, string>
  action: boolean
}) {
  const status = getStatus(metric, locale)
  const href = localizedHrefs?.[metric.key] ?? metric.href
  const unavailableMessage =
    locale === "en"
      ? "This queue could not be loaded. Other queues remain available."
      : "Antrean ini tidak dapat dimuat. Antrean lainnya tetap tersedia."
  const activeMessage =
    metric.available && metric.count === 0
      ? getCleanMessage(metric, locale)
      : metric.message || unavailableMessage

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm leading-5">{metric.label}</CardTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold tracking-tight">
            {metric.count}
          </p>
          {metric.ageMinutes !== null && metric.count > 0 && (
            <span className="flex items-center gap-1 text-right text-xs text-muted-foreground">
              <ClockIcon aria-hidden="true" className="size-3.5" />
              <span>{getAgeLabel(metric.ageMinutes, locale)}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="min-h-10 space-y-1 text-sm">
          <p
            className={
              metric.available
                ? "text-muted-foreground"
                : "text-amber-700 dark:text-amber-400"
            }
          >
            {activeMessage}
          </p>
          {metric.available &&
            metric.count > 0 &&
            metric.ageMinutes !== null && (
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "Oldest item" : "Item tertua"}:{" "}
                {getAgeLabel(metric.ageMinutes, locale)}
              </p>
            )}
          {!metric.available && (
            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <WarningCircleIcon aria-hidden="true" className="size-3.5" />
              {unavailableMessage}
            </p>
          )}
        </div>
        <Button asChild className="mt-auto w-full" size="sm" variant="outline">
          <Link href={href}>
            {action
              ? locale === "en"
                ? "Review queue"
                : "Tinjau antrean"
              : locale === "en"
                ? "Open queue"
                : "Buka antrean"}
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function DailyOperationsView({
  overview,
  localizedHrefs,
  locale = "id",
}: DailyOperationsViewProps) {
  const isEnglish = locale === "en"

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {isEnglish
            ? "Portal — Daily Operations"
            : "Portal — Operasional hari ini"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEnglish
            ? "A focused view of queues that need attention and the workspaces to resolve them."
            : "Pantau antrean yang membutuhkan perhatian dan workspace untuk menanganinya."}
        </p>
      </header>

      <section aria-labelledby="action-required-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <StarIcon
            aria-hidden="true"
            className="size-5 text-amber-500"
            weight="fill"
          />
          <h2 id="action-required-heading" className="text-lg font-semibold">
            {isEnglish ? "Action Required" : "Perlu tindakan"}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overview.actionRequired.map((metric) => (
            <MetricCard
              key={metric.key}
              metric={metric}
              localizedHrefs={localizedHrefs}
              locale={locale}
              action
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="queue-summary-heading" className="space-y-4">
        <div>
          <h2 id="queue-summary-heading" className="text-lg font-semibold">
            {isEnglish ? "Queue Summary" : "Ringkasan antrean"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEnglish
              ? "Activity recorded in the last 24 hours."
              : "Aktivitas yang tercatat dalam 24 jam terakhir."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {overview.queueSummary.map((metric) => (
            <MetricCard
              key={metric.key}
              metric={metric}
              localizedHrefs={localizedHrefs}
              locale={locale}
              action={false}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="workspace-heading" className="space-y-4">
        <div>
          <h2 id="workspace-heading" className="text-lg font-semibold">
            {isEnglish ? "Workspace Entry Points" : "Akses Cepat"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEnglish
              ? "Jump directly into an operational workspace."
              : "Buka workspace operasional secara langsung."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entryPoints.map((entry) => {
            const Icon = entry.icon
            return (
              <Card
                key={entry.href}
                className="border border-border bg-background"
              >
                <CardHeader className="gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <CardTitle className="text-sm">{entry.title}</CardTitle>
                  </div>
                  <CardDescription>{entry.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    asChild
                    className="w-full"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={localizedHrefs?.[entry.href] ?? entry.href}>
                      {isEnglish ? "Open workspace" : "Buka workspace"}
                      <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {isEnglish ? "Last updated" : "Diperbarui"}:{" "}
        {new Date(overview.generatedAt).toLocaleString(
          isEnglish ? "en-US" : "id-ID"
        )}
      </p>
    </main>
  )
}
