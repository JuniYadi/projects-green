"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowsClockwise,
  CaretDown,
  Check,
  CheckCircle,
  Copy,
  Cpu,
  GlobeHemisphereWest,
  HardDrive,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { eden } from "@/lib/eden"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { Button } from "@/components/ui/button"
import { ReinstallTemplateDialog } from "./reinstall-template-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  formatBytes,
  formatCores,
  formatThroughput,
} from "@/modules/deploy/telemetry.service"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"
import type { ClusterTelemetrySummary } from "@/modules/deploy/telemetry.types"

type AppOverviewTabProps = {
  stack: StackSummaryDTO
  locale: string
}

export type HealthVerdict = {
  tone: "healthy" | "warning" | "down" | "unknown" | "deploying"
  headline: string
  detail: string
}

const COPY: Record<"id" | "en", Record<string, string>> = {
  id: {
    statusTitle: "Status aplikasi",
    deploying: "Deployment sedang berlangsung",
    deployingDetail:
      "Versi terbaru sedang dibangun atau diterapkan ke cluster.",
    running: "Aplikasi kamu jalan normal",
    runningDetail: "Pod aktif dan siap menerima permintaan.",
    restarting: "Aplikasi jalan, tapi sempat restart",
    restartingDetail: "Cek log untuk melihat penyebabnya.",
    notReady: "Aplikasi belum siap melayani",
    notReadyDetail: "Pod sudah ada tapi health check belum lolos.",
    down: "Aplikasi tidak jalan",
    downDetail: "Tidak ada pod aktif. Cek log deploy terakhir.",
    unreachable: "Aplikasi jalan tapi tidak bisa diakses",
    unreachableDetail:
      "Belum ada bagian aplikasi yang siap melayani pengunjung.",
    unknown: "Status belum bisa dibaca",
    unknownDetail: "Data monitoring belum masuk. Coba lagi sebentar lagi.",
    checking: "Mengecek status aplikasi…",
    openApp: "Buka web",
    viewLogs: "Lihat log",
    terminal: "Terminal",
    metrics: "Lihat grafik lengkap",
    accessTitle: "Alamat & akses",
    accessDesc: "Cara menghubungi aplikasi ini dari luar dan dari dalam",
    publicUrl: "Alamat publik",
    publicIp: "IP publik",
    noPublicIp: "Tidak ada IP khusus",
    noPublicIpHint:
      "Untuk pakai domain sendiri, buat DNS record tipe CNAME (bukan A) yang mengarah ke alamat publik di atas.",
    internalHost: "Alamat internal",
    podName: "Nama pod",
    namespace: "Namespace",
    restarts: "Restart",
    responseTime: "Waktu respons",
    copy: "Salin",
    copyUrl: "Salin URL",
    copied: "Tersalin",
    usageTitle: "Pemakaian resource",
    usageDesc: "Ringkasan 1 jam terakhir — detail ada di tab Grafik lengkap",
    developerInfo: "Info developer",
    showDeveloperInfo: "Lihat info developer",
    hideDeveloperInfo: "Sembunyikan info developer",
    subscriptionTitle: "Langganan & tagihan",
    subscriptionDesc: "Paket aktif, jenis plan, dan siklus perpanjangan",
    catalogPlan: "Plan",
    priceCycle: "Harga & siklus",
    billingStatus: "Status tagihan",
    billingActive: "Aktif",
    orderedOn: "Dipesan pada",
    nextRenewal: "Perpanjangan berikutnya",
    autoRenewMonthly: "Perpanjang otomatis tiap bulan",
    platformSpecTitle: "Spesifikasi platform",
    platformSpecDesc: "Jenis template, port layanan, dan alokasi resource",
    templateEngine: "Template",
    servicePort: "Port layanan",
    allocatedResources: "Resource yang dialokasikan",
    envSecrets: "Environment variable",
    envSecretsFallback: "Sudah dikonfigurasi",
    configStatus: "Status konfigurasi",
    configSynced: "Tersinkron",
    technicalSpecsTitle: "Spesifikasi Teknis & Jaringan Internal",
    technicalSpecsDesc:
      "Detail port, DNS, endpoint privat, dan konfigurasi lingkungan",
    technicalSpecsToggleOpen: "Tutup",
    technicalSpecsToggleClosed: "Lihat Rincian",
    cpuUsage: "Penggunaan CPU",
    memoryUsage: "Penggunaan Memori (RAM)",
    trafficThroughput: "Throughput Jaringan",
  },
  en: {
    statusTitle: "Application status",
    deploying: "Deployment in progress",
    deployingDetail:
      "A new version is building or being deployed to the cluster.",
    running: "Your app is running normally",
    runningDetail: "The pod is active and ready to serve requests.",
    restarting: "Running, but it restarted recently",
    restartingDetail: "Check the logs to see why.",
    notReady: "Not ready to serve yet",
    notReadyDetail: "The pod exists but health checks have not passed.",
    down: "Your app is not running",
    downDetail: "No active pod. Check the latest deploy logs.",
    unreachable: "Running but unreachable",
    unreachableDetail: "No part of your app is ready to serve visitors yet.",
    unknown: "Status not available",
    unknownDetail: "Monitoring data has not arrived yet. Try again shortly.",
    checking: "Checking application status…",
    openApp: "Open app",
    viewLogs: "View logs",
    terminal: "Terminal",
    metrics: "View full charts",
    accessTitle: "Address & access",
    accessDesc: "How to reach this app from outside and from inside",
    publicUrl: "Public address",
    publicIp: "Public IP",
    noPublicIp: "No dedicated IP",
    noPublicIpHint:
      "To use your own domain, create a CNAME record (not an A record) in your DNS settings, pointing to the public address above.",
    internalHost: "Internal address",
    podName: "Pod name",
    namespace: "Namespace",
    restarts: "Restarts",
    responseTime: "Response time",
    copy: "Copy",
    copyUrl: "Copy URL",
    copied: "Copied",
    usageTitle: "Resource usage",
    usageDesc: "Last hour at a glance — full detail lives in Full charts",
    developerInfo: "Developer info",
    showDeveloperInfo: "Show developer info",
    hideDeveloperInfo: "Hide developer info",
    subscriptionTitle: "Subscription & billing",
    subscriptionDesc: "Active package, catalog plan, and renewal cycle",
    catalogPlan: "Plan",
    priceCycle: "Price & cycle",
    billingStatus: "Billing status",
    billingActive: "Active",
    orderedOn: "Ordered on",
    nextRenewal: "Next renewal",
    autoRenewMonthly: "Auto-renews monthly",
    platformSpecTitle: "Platform specification",
    platformSpecDesc: "Template, service port, and allocated resources",
    templateEngine: "Template",
    servicePort: "Service port",
    allocatedResources: "Allocated resources",
    envSecrets: "Environment variables",
    envSecretsFallback: "Already configured",
    configStatus: "Configuration status",
    configSynced: "Synced",
    technicalSpecsTitle: "Technical Specs & Internal Networking",
    technicalSpecsDesc:
      "Port details, DNS, private endpoints, and environment configuration",
    technicalSpecsToggleOpen: "Close",
    technicalSpecsToggleClosed: "View Details",
    cpuUsage: "CPU Utilization",
    memoryUsage: "Memory Working Set",
    trafficThroughput: "Network Throughput",
  },
}

/**
 * Turn raw pod + ingress telemetry into the one sentence a tenant actually
 * asked for: "is my server up?". Ordered worst-first so a real outage is
 * never masked by a softer warning.
 */
export function resolveHealthVerdict(
  telemetry: ClusterTelemetrySummary | undefined,
  t: Record<string, string>,
  stackStatus?: string
): HealthVerdict {
  const normalizedStatus = stackStatus?.toUpperCase()
  if (
    normalizedStatus === "BUILDING" ||
    normalizedStatus === "QUEUED" ||
    normalizedStatus === "DEPLOYING"
  ) {
    return {
      tone: "deploying",
      headline: t.deploying,
      detail: t.deployingDetail,
    }
  }

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

  const ingress = telemetry.ingress
  const ingressBusy = ingress
    ? ingress.trafficRps > 0 || ingress.activeSessions > 0
    : false
  if (ingress && ingress.healthyServers === 0 && ingressBusy) {
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
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard error
    }
  }

  return (
    <div className="space-y-1 border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-xs text-foreground">
            {value}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`${copyLabel} ${label}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check size={13} className="text-emerald-500" />
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
  const router = useRouter()
  const [reinstallOpen, setReinstallOpen] = useState(false)
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const isTemplate =
    stack.sourceType === "TEMPLATE" || Boolean(stack.templateId)
  const t = COPY[locale.startsWith("id") ? "id" : "en"]
  const telemetryMessages =
    getMessagesForMaybeLocale(locale).console.deploy.clusterTelemetryCards

  const { data: telemetry } = useQuery<ClusterTelemetrySummary>({
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

  const responseMs = telemetry?.ingress
    ? `${Math.round(telemetry.ingress.avgResponseTimeSeconds * 1000)} ms`
    : null

  const tabHref = (tab: string) =>
    `/${locale}/console/app/platform/${stack.slug}?tab=${tab}`

  const orderedDate = stack.orderedAt || stack.createdAt
  const formattedOrdered = orderedDate
    ? new Date(orderedDate).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—"

  // CPU metric calculations
  const cpuCurrent = telemetry?.cpu?.currentCores ?? 0
  const cpuLimit =
    telemetry?.cpu?.limitCores && telemetry.cpu.limitCores > 0
      ? telemetry.cpu.limitCores
      : stack.cpu
        ? stack.cpu >= 100
          ? stack.cpu / 1000
          : stack.cpu
        : 1
  const cpuPercent =
    cpuLimit > 0
      ? Math.min(100, Math.max(0, Math.round((cpuCurrent / cpuLimit) * 100)))
      : 0

  // Memory metric calculations
  const memCurrentBytes = telemetry?.memory?.currentBytes ?? 0
  const memLimitBytes =
    telemetry?.memory?.limitBytes && telemetry.memory.limitBytes > 0
      ? telemetry.memory.limitBytes
      : (stack.memory ?? 512) * 1024 * 1024
  const memPercent =
    memLimitBytes > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((memCurrentBytes / memLimitBytes) * 100))
        )
      : 0

  return (
    <div className="space-y-6">
      {/* 1. VITAL HEALTH GAUGES */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {t.usageTitle}
            </h3>
            <p className="text-xs text-muted-foreground">{t.usageDesc}</p>
          </div>
          <Link
            href={tabHref("metrics")}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t.metrics} →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card: CPU Utilization */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.cpuUsage}
                </span>
                <Cpu size={16} className="text-muted-foreground" />
              </div>
              <CardTitle className="text-lg font-bold">{cpuPercent}%</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${cpuPercent}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {formatCores(cpuCurrent)} / {formatCores(cpuLimit)}
              </p>
            </CardContent>
          </Card>

          {/* Card: Memory Working Set */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.memoryUsage}
                </span>
                <HardDrive size={16} className="text-muted-foreground" />
              </div>
              <CardTitle className="text-lg font-bold">{memPercent}%</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${memPercent}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {formatBytes(memCurrentBytes)} / {formatBytes(memLimitBytes)}
              </p>
            </CardContent>
          </Card>

          {/* Card: Network Throughput & Response Time */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.trafficThroughput}
                </span>
                <GlobeHemisphereWest
                  size={16}
                  className="text-muted-foreground"
                />
              </div>
              <CardTitle className="text-lg font-bold">
                {responseMs ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-muted-foreground">
                {t.responseTime}:{" "}
                <strong className="text-foreground">
                  {responseMs ?? "Normal"}
                </strong>
              </p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {telemetryMessages.rx}{" "}
                {formatThroughput(telemetry?.network?.currentRxBytes ?? 0)}{" "}
                {telemetryMessages.txWithBullet}{" "}
                {formatThroughput(telemetry?.network?.currentTxBytes ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. PROGRESSIVE DISCLOSURE: PLATFORM SPECS & INTERNAL NETWORKING */}
      <Collapsible
        open={technicalOpen}
        onOpenChange={setTechnicalOpen}
        className="rounded-xl border border-border/80 bg-card shadow-xs"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div>
              <h4 className="text-sm font-bold text-foreground">
                {t.technicalSpecsTitle}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t.technicalSpecsDesc}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>
                {technicalOpen
                  ? t.technicalSpecsToggleOpen
                  : t.technicalSpecsToggleClosed}
              </span>
              <CaretDown
                size={14}
                className={cn(
                  "transition-transform duration-200",
                  technicalOpen && "rotate-180"
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border/60 p-4 pt-3 text-xs">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Left Column: Addressing & Networking */}
            <div className="space-y-3">
              <h5 className="font-semibold text-foreground">{t.accessTitle}</h5>

              <CopyableRow
                label={t.internalHost}
                value={`${stack.slug}:${stack.port ?? 8080}`}
                copyLabel={t.copy}
                copiedLabel={t.copied}
              />

              <div className="space-y-1 border-b border-border/40 pb-2.5">
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
            </div>

            {/* Right Column: Platform Specifications */}
            <div className="space-y-3">
              <h5 className="font-semibold text-foreground">
                {t.platformSpecTitle}
              </h5>

              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">
                  {isTemplate ? t.templateEngine : "Framework"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {stack.templateName ??
                      stack.framework ??
                      stack.templateId ??
                      "Custom Container"}
                  </span>
                  {isTemplate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReinstallOpen(true)}
                      className="h-6 gap-1 px-1.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <ArrowsClockwise size={12} />
                      <span>
                        {locale.startsWith("id")
                          ? "Ganti Template"
                          : "Change Template"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">{t.servicePort}</span>
                <span className="font-mono font-medium text-foreground">
                  {stack.port ? `Port ${stack.port}` : "Port 8080"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">
                  {t.allocatedResources}
                </span>
                <span className="font-medium text-foreground">
                  {stack.cpu
                    ? stack.cpu >= 100
                      ? `${stack.cpu / 1000} vCPU`
                      : `${stack.cpu} vCPU`
                    : "1 vCPU"}{" "}
                  • {stack.memory ? `${stack.memory} MB RAM` : "2048 MB RAM"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">{t.envSecrets}</span>
                <span className="font-medium text-foreground">
                  {stack.envCount !== undefined
                    ? locale.startsWith("id")
                      ? `${stack.envCount} variabel`
                      : `${stack.envCount} ${stack.envCount === 1 ? "variable" : "variables"}`
                    : t.envSecretsFallback}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">{t.orderedOn}</span>
                <span className="font-medium text-foreground">
                  {formattedOrdered}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.configStatus}</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-500">
                  <CheckCircle size={13} />
                  {t.configSynced}
                </span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {isTemplate && (
        <ReinstallTemplateDialog
          stack={stack}
          open={reinstallOpen}
          onOpenChange={setReinstallOpen}
          onSuccess={() => {
            router.refresh()
          }}
          locale={locale}
        />
      )}
    </div>
  )
}
