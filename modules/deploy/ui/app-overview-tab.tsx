"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowSquareOut,
  CheckCircle,
  Copy,
  ListMagnifyingGlass,
  Question,
  Spinner,
  TerminalWindow,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClusterTelemetryCards } from "@/modules/deploy/ui/cluster-telemetry-cards"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"
import type { ClusterTelemetrySummary } from "@/modules/deploy/telemetry.types"

type AppOverviewTabProps = {
  stack: StackSummaryDTO
  locale: string
}

type HealthVerdict = {
  tone: "healthy" | "warning" | "down" | "unknown"
  headline: string
  detail: string
}

const COPY: Record<"id" | "en", Record<string, string>> = {
  id: {
    statusTitle: "Status aplikasi",
    running: "Aplikasi kamu jalan normal",
    runningDetail: "Pod aktif dan siap menerima permintaan.",
    restarting: "Aplikasi jalan, tapi sempat restart",
    restartingDetail: "Cek log untuk melihat penyebabnya.",
    notReady: "Aplikasi belum siap melayani",
    notReadyDetail: "Pod sudah ada tapi health check belum lolos.",
    down: "Aplikasi tidak jalan",
    downDetail: "Tidak ada pod aktif. Cek log deploy terakhir.",
    unreachable: "Aplikasi jalan tapi tidak bisa diakses",
    unreachableDetail: "Tidak ada backend sehat di ingress.",
    unknown: "Status belum bisa dibaca",
    unknownDetail: "Data monitoring belum masuk. Coba lagi sebentar lagi.",
    checking: "Mengecek status aplikasi…",
    openApp: "Buka aplikasi",
    viewLogs: "Lihat log",
    terminal: "Terminal",
    metrics: "Grafik lengkap",
    accessTitle: "Alamat & akses",
    accessDesc: "Cara menghubungi aplikasi ini dari luar dan dari dalam",
    publicUrl: "Alamat publik",
    publicIp: "IP publik",
    noPublicIp: "Tidak ada IP khusus",
    noPublicIpHint:
      "Aplikasi dilayani lewat ingress bersama. Untuk domain sendiri, arahkan CNAME ke alamat publik di atas — jangan pakai A record.",
    internalHost: "Alamat internal",
    podName: "Nama pod",
    namespace: "Namespace",
    restarts: "Restart",
    responseTime: "Waktu respons",
    copy: "Salin",
    copied: "Tersalin",
    usageTitle: "Pemakaian resource",
    usageDesc: "Ringkasan 1 jam terakhir — detail ada di tab Grafik lengkap",
  },
  en: {
    statusTitle: "Application status",
    running: "Your app is running normally",
    runningDetail: "The pod is active and ready to serve requests.",
    restarting: "Running, but it restarted recently",
    restartingDetail: "Check the logs to see why.",
    notReady: "Not ready to serve yet",
    notReadyDetail: "The pod exists but health checks have not passed.",
    down: "Your app is not running",
    downDetail: "No active pod. Check the latest deploy logs.",
    unreachable: "Running but unreachable",
    unreachableDetail: "No healthy backend registered at the ingress.",
    unknown: "Status not available",
    unknownDetail: "Monitoring data has not arrived yet. Try again shortly.",
    checking: "Checking application status…",
    openApp: "Open app",
    viewLogs: "View logs",
    terminal: "Terminal",
    metrics: "Full charts",
    accessTitle: "Address & access",
    accessDesc: "How to reach this app from outside and from inside",
    publicUrl: "Public address",
    publicIp: "Public IP",
    noPublicIp: "No dedicated IP",
    noPublicIpHint:
      "The app is served through a shared ingress. For a custom domain, point a CNAME at the public address above — do not use an A record.",
    internalHost: "Internal address",
    podName: "Pod name",
    namespace: "Namespace",
    restarts: "Restarts",
    responseTime: "Response time",
    copy: "Copy",
    copied: "Copied",
    usageTitle: "Resource usage",
    usageDesc: "Last hour at a glance — full detail lives in Full charts",
  },
}

const TONE_STYLES: Record<
  HealthVerdict["tone"],
  { wrap: string; icon: string }
> = {
  healthy: {
    wrap: "border-emerald-500/30 bg-emerald-500/5",
    icon: "text-emerald-500",
  },
  warning: {
    wrap: "border-amber-500/30 bg-amber-500/5",
    icon: "text-amber-500",
  },
  down: {
    wrap: "border-destructive/30 bg-destructive/5",
    icon: "text-destructive",
  },
  unknown: { wrap: "border-border bg-card", icon: "text-muted-foreground" },
}

/**
 * Turn raw pod + ingress telemetry into the one sentence a tenant actually
 * asked for: "is my server up?". Ordered worst-first so a real outage is
 * never masked by a softer warning.
 */
export function resolveHealthVerdict(
  telemetry: ClusterTelemetrySummary | undefined,
  t: Record<string, string>
): HealthVerdict {
  const pod = telemetry?.pods?.[0]
  if (!telemetry || !pod) {
    return { tone: "unknown", headline: t.unknown, detail: t.unknownDetail }
  }

  if (pod.status !== "Running") {
    return {
      tone: "down",
      headline: t.down,
      detail: pod.reason ? `${pod.status} — ${pod.reason}` : t.downDetail,
    }
  }

  if (pod.ready === false) {
    return { tone: "warning", headline: t.notReady, detail: t.notReadyDetail }
  }

  if (telemetry.ingress && telemetry.ingress.healthyServers === 0) {
    return {
      tone: "warning",
      headline: t.unreachable,
      detail: t.unreachableDetail,
    }
  }

  if (pod.restarts > 0) {
    return {
      tone: "warning",
      headline: t.restarting,
      detail: t.restartingDetail,
    }
  }

  return { tone: "healthy", headline: t.running, detail: t.runningDetail }
}

function CopyableRow({
  label,
  value,
  hint,
  copyLabel,
  copiedLabel,
}: {
  label: string
  value: string
  hint?: string
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[11px] text-foreground">
            {value}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`${copyLabel} ${label}`}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <CheckCircle size={13} className="text-emerald-500" />
            ) : (
              <Copy size={13} />
            )}
          </button>
        </div>
      </div>
      {hint ? (
        <p className="pr-7 text-[11px] leading-relaxed text-muted-foreground">
          {copied ? copiedLabel : hint}
        </p>
      ) : null}
    </div>
  )
}

export function AppOverviewTab({ stack, locale }: AppOverviewTabProps) {
  const t = COPY[locale.startsWith("id") ? "id" : "en"]
  const targetDomain = stack.customDomain || stack.subdomain

  const { data: telemetry, isLoading: healthLoading } =
    useQuery<ClusterTelemetrySummary>({
      queryKey: ["deploy", "app-health", stack.slug],
      queryFn: async () => {
        const { data: payload } = await eden.api.deploy.telemetry.get({
          $query: { range: "1h", appSlug: stack.slug },
        })
        if (!payload || !payload.ok || !payload.data) {
          throw new Error(payload?.message ?? "Unable to load app health")
        }
        return payload.data
      },
      refetchInterval: 30_000,
    })

  const pod = telemetry?.pods?.[0]
  const verdict = resolveHealthVerdict(telemetry, t)
  const tone = TONE_STYLES[verdict.tone]
  const VerdictIcon =
    verdict.tone === "healthy"
      ? CheckCircle
      : verdict.tone === "down"
        ? WarningCircle
        : verdict.tone === "warning"
          ? Warning
          : Question

  const responseMs = telemetry?.ingress
    ? `${Math.round(telemetry.ingress.avgResponseTimeSeconds * 1000)} ms`
    : null

  const tabHref = (tab: string) =>
    `/${locale}/console/app/platform/${stack.slug}?tab=${tab}`

  const formattedPrice = stack.catalogPlanPrice
    ? stack.catalogPlanCurrency === "IDR"
      ? `Rp ${Number(stack.catalogPlanPrice).toLocaleString("id-ID")} / bulan`
      : `$${stack.catalogPlanPrice} / month`
    : stack.hourlyCost
      ? `$${stack.hourlyCost} / hour (PAYG)`
      : "Included with Package"

  const orderedDate = stack.orderedAt || stack.createdAt
  const formattedOrdered = orderedDate
    ? new Date(orderedDate).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—"

  const formattedRenewal = stack.renewalAt
    ? new Date(stack.renewalAt).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Auto-renews monthly"

  return (
    <div className="space-y-6">
      {/* Answer block: the one question every tenant opens this page to ask. */}
      <section
        className={cn(
          "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
          tone.wrap
        )}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          {healthLoading && !telemetry ? (
            <Spinner
              size={22}
              className="mt-0.5 shrink-0 animate-spin text-muted-foreground"
            />
          ) : (
            <VerdictIcon
              size={22}
              weight="fill"
              className={cn("mt-0.5 shrink-0", tone.icon)}
            />
          )}
          <div className="space-y-1">
            <p className="text-base font-bold text-foreground">
              {healthLoading && !telemetry ? t.checking : verdict.headline}
            </p>
            <p className="text-xs text-muted-foreground">
              {healthLoading && !telemetry ? "" : verdict.detail}
            </p>
            {pod ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
                <span>
                  {t.restarts}: <strong>{pod.restarts}</strong>
                </span>
                {responseMs ? (
                  <span>
                    {t.responseTime}: <strong>{responseMs}</strong>
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        {/* Time-to-action: logs, shell and charts are one click, not a hunt. */}
        <div className="flex flex-wrap items-center gap-2">
          {targetDomain ? (
            <Button asChild size="sm" className="h-8 gap-1.5 px-3 text-xs">
              <a
                href={`https://${targetDomain}`}
                target="_blank"
                rel="noreferrer"
              >
                <ArrowSquareOut size={14} />
                <span>{t.openApp}</span>
              </a>
            </Button>
          ) : null}
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Link href={tabHref("logs")}>
              <ListMagnifyingGlass size={14} />
              <span>{t.viewLogs}</span>
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Link href={tabHref("terminal")}>
              <TerminalWindow size={14} />
              <span>{t.terminal}</span>
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: how to reach the app — the address questions. */}
        <div className="space-y-4 lg:col-span-6">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="px-4 pt-3.5 pb-2">
              <CardTitle className="text-sm font-bold">
                {t.accessTitle}
              </CardTitle>
              <CardDescription className="text-xs">
                {t.accessDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pt-0 pb-3.5 text-xs">
              {targetDomain ? (
                <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                  <span className="shrink-0 text-muted-foreground">
                    {t.publicUrl}
                  </span>
                  <a
                    href={`https://${targetDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                  >
                    <span className="truncate">{targetDomain}</span>
                    <ArrowSquareOut size={12} className="shrink-0" />
                  </a>
                </div>
              ) : null}

              <div className="space-y-1 border-b border-border/50 pb-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t.publicIp}</span>
                  <span className="font-medium text-foreground">
                    {t.noPublicIp}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t.noPublicIpHint}
                </p>
              </div>

              <CopyableRow
                label={t.internalHost}
                value={`${stack.slug}:${stack.port ?? 80}`}
                copyLabel={t.copy}
                copiedLabel={t.copied}
              />

              {pod ? (
                <CopyableRow
                  label={t.podName}
                  value={pod.pod}
                  copyLabel={t.copy}
                  copiedLabel={t.copied}
                />
              ) : null}

              {telemetry?.namespace ? (
                <CopyableRow
                  label={t.namespace}
                  value={telemetry.namespace}
                  copyLabel={t.copy}
                  copiedLabel={t.copied}
                />
              ) : null}
            </CardContent>
          </Card>

          {/* Card: Subscription & Billing */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="px-4 pt-3.5 pb-2">
              <CardTitle className="text-sm font-bold">
                Subscription & Billing
              </CardTitle>
              <CardDescription className="text-xs">
                Active package, catalog plan, and renewal cycle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pt-0 pb-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Catalog Plan</span>
                <span className="font-semibold text-foreground">
                  {stack.catalogPlanName ??
                    (stack.resourcePlanId
                      ? `${stack.resourcePlanId.toUpperCase()} Plan`
                      : "Small")}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Price & Cycle</span>
                <span className="font-semibold text-foreground">
                  {formattedPrice}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Billing Status</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-500">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Active ({stack.billingState ?? "Good Standing"})
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Ordered On</span>
                <span className="font-medium text-foreground">
                  {formattedOrdered}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-muted-foreground">Next Renewal</span>
                <span className="font-medium text-foreground">
                  {formattedRenewal}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: what this app is made of. */}
        <div className="space-y-4 lg:col-span-6">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="px-4 pt-3.5 pb-2">
              <CardTitle className="text-sm font-bold">
                Platform Specification
              </CardTitle>
              <CardDescription className="text-xs">
                Template engine, service port, and cluster routing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pt-0 pb-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Template / Engine</span>
                <span className="font-medium text-foreground">
                  {stack.templateName ??
                    stack.framework ??
                    stack.templateId ??
                    "Custom Container"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Service Port</span>
                <span className="font-mono font-medium text-foreground">
                  {stack.port ? `Port ${stack.port}` : "Port 80/443"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">
                  Allocated Resources
                </span>
                <span className="font-medium text-foreground">
                  {stack.cpu
                    ? stack.cpu >= 100
                      ? `${stack.cpu / 1000} vCPU`
                      : `${stack.cpu} vCPU`
                    : "0.5 vCPU"}{" "}
                  • {stack.memory ? `${stack.memory} MB RAM` : "512 MB RAM"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">
                  Environment Secrets
                </span>
                <span className="font-medium text-foreground">
                  {stack.envCount !== undefined
                    ? `${stack.envCount} Variables (Vault)`
                    : "Configured in Vault"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-muted-foreground">GitOps Status</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-500">
                  <CheckCircle size={13} />
                  ArgoCD Synced
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Charts demoted: a glance here, the real analysis in Metrics. */}
          <ClusterTelemetryCards
            appSlug={stack.slug}
            title={t.usageTitle}
            compact
          />
          <p className="px-1 text-[11px] text-muted-foreground">
            {t.usageDesc} —{" "}
            <Link
              href={tabHref("metrics")}
              className="text-primary hover:underline"
            >
              {t.metrics}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
