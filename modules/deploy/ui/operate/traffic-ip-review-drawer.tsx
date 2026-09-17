"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ShieldWarning,
  Robot,
  User,
  Question,
  Clock,
  GlobeHemisphereWest,
  ArrowClockwise,
  WarningCircle,
  CheckCircle,
  Prohibit,
  FileCode,
  Browser,
  LockKey,
  TerminalWindow,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CountryFlag } from "@/components/ui/country-flag"
import type {
  TrafficIpDetailDTO,
  TrafficSignal,
} from "../../opensearch/opensearch-traffic.types"
import type { BlockDurationOption } from "../../ip-block/ip-block.service"

const t = (text: string): string => text

export interface TrafficIpReviewDrawerProps {
  appSlug: string
  ip: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  granularity?: "daily" | "monthly" | "yearly"
  date?: string
  month?: string
  year?: string
  onBlockAction?: (ip: string, action: "block" | "unblock") => void
}

export function getSignalBadge(signal: TrafficSignal, _confidence?: number) {
  switch (signal) {
    case "likely_human":
      return {
        label: t("Kemungkinan Manusia"),
        variant: "outline" as const,
        icon: <User size={13} className="text-emerald-500" />,
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
      }
    case "likely_automated":
      return {
        label: t("Otomatis / Bot / Scanner"),
        variant: "outline" as const,
        icon: <Robot size={13} className="text-rose-500" />,
        className:
          "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium",
      }
    case "mixed":
      return {
        label: t("Tercampur (Mixed / NAT)"),
        variant: "outline" as const,
        icon: <ShieldWarning size={13} className="text-amber-500" />,
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium",
      }
    case "unknown":
    default:
      return {
        label: t("Tidak Diketahui"),
        variant: "outline" as const,
        icon: <Question size={13} className="text-muted-foreground" />,
        className:
          "border-border bg-muted/20 text-muted-foreground font-medium",
      }
  }
}

export function TrafficIpReviewDrawer({
  appSlug,
  ip,
  open,
  onOpenChange,
  granularity = "daily",
  date,
  month,
  year,
  onBlockAction,
}: TrafficIpReviewDrawerProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<
    "logs" | "paths" | "clients" | "timeline"
  >("logs")
  const [isBlockFormOpen, setIsBlockFormOpen] = useState(false)
  const [blockDuration, setBlockDuration] = useState<BlockDurationOption>("24h")
  const [blockReason, setBlockReason] = useState("")

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<TrafficIpDetailDTO>({
      queryKey: [
        "traffic-ip-detail",
        appSlug,
        ip,
        granularity,
        date,
        month,
        year,
      ],
      queryFn: async () => {
        if (!ip) throw new Error("No IP provided")
        const params = new URLSearchParams()
        if (granularity) params.set("granularity", granularity)
        if (granularity === "daily" && date) params.set("date", date)
        else if (granularity === "monthly" && month) params.set("month", month)
        else if (granularity === "yearly" && year) params.set("year", year)

        const res = await fetch(
          `/api/deploy/apps/${encodeURIComponent(appSlug)}/traffic/ips/${encodeURIComponent(ip)}?${params.toString()}`
        )
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.message || "Failed to load IP detail")
        }
        const json = await res.json()
        return json.data as TrafficIpDetailDTO
      },
      enabled: Boolean(open && ip && appSlug),
    })

  const blockMutation = useMutation({
    mutationFn: async (payload: {
      ipAddress: string
      reason: string
      duration: BlockDurationOption
    }) => {
      const res = await fetch(
        `/api/deploy/apps/${encodeURIComponent(appSlug)}/traffic/blocks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || "Failed to block IP")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(t(`Alamat IP ${ip} berhasil diblokir`))
      setIsBlockFormOpen(false)
      setBlockReason("")
      refetch()
      queryClient.invalidateQueries({ queryKey: ["traffic-ips-investigation"] })
      onBlockAction?.(ip ?? "", "block")
    },
    onError: (err: Error) => {
      toast.error(err.message || t("Gagal memblokir IP"))
    },
  })

  const unblockMutation = useMutation({
    mutationFn: async (ipAddress: string) => {
      const res = await fetch(
        `/api/deploy/apps/${encodeURIComponent(appSlug)}/traffic/blocks/${encodeURIComponent(ipAddress)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || "Failed to unblock IP")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(t(`Blokir terhadap IP ${ip} berhasil dicabut`))
      refetch()
      queryClient.invalidateQueries({ queryKey: ["traffic-ips-investigation"] })
      onBlockAction?.(ip ?? "", "unblock")
    },
    onError: (err: Error) => {
      toast.error(err.message || t("Gagal mencabut blokir IP"))
    },
  })

  const signalMeta = data
    ? getSignalBadge(data.signal.classification, data.signal.confidence)
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CountryFlag
                country={data?.countryCode || "UNKNOWN"}
                className="h-4 w-6 shrink-0 rounded-xs object-cover shadow-2xs"
                fallback={
                  <GlobeHemisphereWest
                    size={18}
                    className="shrink-0 text-muted-foreground"
                  />
                }
              />
              <div>
                <SheetTitle className="font-mono text-base font-semibold tracking-tight text-foreground">
                  {ip || t("Alamat IP")}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {[data?.city, data?.countryName].filter(Boolean).join(", ") ||
                    t("Sedang memuat data geolokasi...")}
                </SheetDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => refetch()}
              className="h-8 px-2"
              title={t("Refresh Bukti IP")}
            >
              <ArrowClockwise
                size={14}
                className={isFetching ? "animate-spin" : ""}
              />
            </Button>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-xs text-muted-foreground">
            <ArrowClockwise size={24} className="animate-spin text-primary" />
            <p className="mt-2 font-medium">
              {t("Mengumpulkan bukti jejak trafik IP dari OpenSearch...")}
            </p>
          </div>
        ) : isError ? (
          <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
            <p className="font-semibold">{t("Gagal memuat jejak bukti IP")}</p>
            <p className="mt-1">
              {error instanceof Error
                ? error.message
                : t("Terjadi kesalahan sistem")}
            </p>
          </div>
        ) : data ? (
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {/* 1. Traffic Signal & Classification Card */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={signalMeta?.variant}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs ${signalMeta?.className}`}
                  >
                    {signalMeta?.icon}
                    <span>{signalMeta?.label}</span>
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {t("Keyakinan:")} {data.signal.confidence}%
                  </span>
                </div>

                {data.blockInfo?.isBlocked ? (
                  <Badge
                    variant="destructive"
                    className="flex items-center gap-1 font-mono text-[11px]"
                  >
                    <Prohibit size={12} />
                    <span>
                      {t("DIBLOKIR")} ({data.blockInfo.status.toUpperCase()})
                    </span>
                  </Badge>
                ) : null}
              </div>

              {/* Reasons why this classification was assigned */}
              <div className="space-y-1.5 rounded-md bg-muted/20 p-3 text-xs text-foreground">
                <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <WarningCircle size={14} />
                  <span>{t("Alasan & Bukti Klasifikasi:")}</span>
                </div>
                <ul className="list-inside list-disc space-y-1 pl-1 text-[11px] text-muted-foreground">
                  {data.signal.reasons.map((reason, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 2. Key Metrics Summary Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">
                  {t("Total Request")}
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {data.totalRequests.toLocaleString("id-ID")}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">
                  {t("Success Rate")}
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {data.successRate}%
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">
                  {t("Kecepatan (Burst)")}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <span>{data.velocity.maxRpm} RPM</span>
                  {data.velocity.isBurst ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                    >
                      {t("Burst")}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">
                  {t("Aset Statis")}
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {data.staticAssetShare}%
                </div>
              </div>
            </div>

            {/* 3. HTTP Status Class Breakdown Bar */}
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  {t("Distribusi Status HTTP")}
                </span>
                <span className="text-muted-foreground">
                  {data.successRate}% {t("Berhasil (2xx)")}
                </span>
              </div>

              <div className="flex h-2 overflow-hidden rounded-full bg-muted/20">
                <div
                  style={{
                    width: `${(data.statusCounts.status2xx / (data.totalRequests || 1)) * 100}%`,
                  }}
                  className="h-full bg-emerald-500"
                  title={`2xx: ${data.statusCounts.status2xx}`}
                />
                <div
                  style={{
                    width: `${(data.statusCounts.status3xx / (data.totalRequests || 1)) * 100}%`,
                  }}
                  className="h-full bg-sky-500"
                  title={`3xx: ${data.statusCounts.status3xx}`}
                />
                <div
                  style={{
                    width: `${(data.statusCounts.status4xx / (data.totalRequests || 1)) * 100}%`,
                  }}
                  className="h-full bg-amber-500"
                  title={`4xx: ${data.statusCounts.status4xx}`}
                />
                <div
                  style={{
                    width: `${(data.statusCounts.status5xx / (data.totalRequests || 1)) * 100}%`,
                  }}
                  className="h-full bg-rose-500"
                  title={`5xx: ${data.statusCounts.status5xx}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  2xx: {data.statusCounts.status2xx.toLocaleString("id-ID")}
                </span>
                <span className="font-medium text-sky-600 dark:text-sky-400">
                  3xx: {data.statusCounts.status3xx.toLocaleString("id-ID")}
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  4xx: {data.statusCounts.status4xx.toLocaleString("id-ID")}
                </span>
                <span className="font-medium text-rose-600 dark:text-rose-400">
                  5xx: {data.statusCounts.status5xx.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* 4. First Seen & Last Seen Timestamps */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock size={14} />
                <span>{t("Pertama dilihat:")}</span>
                <span className="font-mono font-medium text-foreground">
                  {new Date(data.firstSeen).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock size={14} />
                <span>{t("Terakhir dilihat:")}</span>
                <span className="font-mono font-medium text-foreground">
                  {new Date(data.lastSeen).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* 5. Deep Evidence Tabs: Logs / Paths / User-Agents / Timeline */}
            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "logs" | "paths" | "clients" | "timeline")
              }
              className="space-y-3"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="logs" className="text-xs">
                  <TerminalWindow size={14} className="mr-1.5" />
                  {t("Log")}
                </TabsTrigger>
                <TabsTrigger value="paths" className="text-xs">
                  <FileCode size={14} className="mr-1.5" />
                  {t("Path")}
                </TabsTrigger>
                <TabsTrigger value="clients" className="text-xs">
                  <Browser size={14} className="mr-1.5" />
                  {t("Klien")}
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">
                  <Clock size={14} className="mr-1.5" />
                  {t("Waktu")}
                </TabsTrigger>
              </TabsList>

              {/* Logs Tab */}
              <TabsContent value="logs" className="space-y-2 pt-1">
                {!data.recentLogs || data.recentLogs.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    {t(
                      "Tidak ada log permintaan OpenSearch tercatat untuk IP ini pada periode yang dipilih"
                    )}
                  </div>
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {data.recentLogs.map((log) => {
                      const statusColor =
                        log.statusCode >= 500
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                          : log.statusCode >= 400
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                            : log.statusCode >= 300
                              ? "border-sky-500/30 bg-sky-500/10 text-sky-500"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-1.5 py-0 text-[10px] font-semibold",
                                statusColor
                              )}
                            >
                              {log.statusCode}
                            </Badge>
                            <span className="font-semibold text-foreground">
                              {log.method}
                            </span>
                            <span
                              className="truncate text-muted-foreground"
                              title={log.path}
                            >
                              {log.path}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{log.latencyMs}ms</span>
                            <span>•</span>
                            <span>
                              {new Date(log.timestamp).toLocaleTimeString(
                                "id-ID"
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Paths Tab */}
              <TabsContent value="paths" className="space-y-4 pt-1">
                {/* 4xx / Scanner Probe Paths */}
                {data.pathsByStatus.status4xx.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <WarningCircle size={14} />
                      <span>
                        {t("Path Status 4xx (Error / Scanner Target):")}
                      </span>
                    </div>
                    <div className="divide-y divide-border rounded-md border border-border bg-card">
                      {data.pathsByStatus.status4xx.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 font-mono text-xs"
                        >
                          <span className="truncate text-foreground">
                            {p.path}
                          </span>
                          <Badge variant="outline" className="ml-2 shrink-0">
                            {p.count} req
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 2xx Normal Paths */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={14} />
                    <span>{t("Path Status 2xx (Berhasil):")}</span>
                  </div>
                  {data.pathsByStatus.status2xx.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      {t("Tidak ada rekaman permintaan 2xx")}
                    </div>
                  ) : (
                    <div className="divide-y divide-border rounded-md border border-border bg-card">
                      {data.pathsByStatus.status2xx.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 font-mono text-xs"
                        >
                          <span className="truncate text-foreground">
                            {p.path}
                          </span>
                          <Badge variant="outline" className="ml-2 shrink-0">
                            {p.count} req
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5xx Server Error Paths */}
                {data.pathsByStatus.status5xx.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <WarningCircle size={14} />
                      <span>{t("Path Status 5xx (Gangguan Server):")}</span>
                    </div>
                    <div className="divide-y divide-border rounded-md border border-border bg-card">
                      {data.pathsByStatus.status5xx.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 font-mono text-xs"
                        >
                          <span className="truncate text-foreground">
                            {p.path}
                          </span>
                          <Badge variant="outline" className="ml-2 shrink-0">
                            {p.count} req
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </TabsContent>

              {/* User Agents Tab */}
              <TabsContent value="clients" className="space-y-3 pt-1">
                {data.userAgents.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    {t("Tidak ada User-Agent tercatat")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.userAgents.map((ua, idx) => (
                      <div
                        key={idx}
                        className="space-y-1 rounded-md border border-border bg-card p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {ua.browser}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">
                              {ua.os} ({ua.device})
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {ua.count} req
                          </Badge>
                        </div>
                        <div className="font-mono text-[11px] break-all text-muted-foreground">
                          {ua.raw}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="space-y-3 pt-1">
                {data.timeline.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    {t("Tidak ada log timeline")}
                  </div>
                ) : (
                  <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
                    {data.timeline.map((timelineItem, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-muted-foreground">
                          {new Date(timelineItem.timestamp).toLocaleTimeString(
                            "id-ID",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {timelineItem.requests} req
                          </span>
                          {timelineItem.errors > 0 ? (
                            <Badge
                              variant="destructive"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {timelineItem.errors} err
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* 6. Security Actions / IP Block Controls */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <LockKey size={14} />
                    <span>{t("Tindakan Akses & Keamanan")}</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "Blokir atau batasi lalu lintas dari IP ini di level ingress gateway aplikasi"
                    )}
                  </p>
                </div>

                {data.blockInfo?.isBlocked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unblockMutation.isPending}
                    className="h-8 border-destructive text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => unblockMutation.mutate(data.ip)}
                  >
                    {unblockMutation.isPending
                      ? t("Membuka...")
                      : t("Buka Blokir (Unblock)")}
                  </Button>
                ) : !isBlockFormOpen ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setIsBlockFormOpen(true)}
                  >
                    <Prohibit size={14} className="mr-1.5" />
                    {t("Blokir Akses IP")}
                  </Button>
                ) : null}
              </div>

              {/* Block Form when open */}
              {isBlockFormOpen && !data.blockInfo?.isBlocked ? (
                <div className="space-y-3 rounded-md border border-border bg-muted/10 p-3">
                  <div className="text-xs font-medium text-foreground">
                    {t("Formulir Pemblokiran IP:")}{" "}
                    <span className="font-mono">{data.ip}</span>
                  </div>

                  {/* Duration Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {t("Durasi Blokir:")}
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { value: "1h", label: t("1 Jam") },
                          { value: "24h", label: t("24 Jam") },
                          { value: "7d", label: t("7 Hari") },
                          { value: "permanent", label: t("Permanen") },
                        ] as const
                      ).map((d) => (
                        <Button
                          key={d.value}
                          type="button"
                          variant={
                            blockDuration === d.value ? "default" : "outline"
                          }
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setBlockDuration(d.value)}
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Preset Reasons */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {t("Pilih Alasan Cepat:")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Scanner Probe (.env, .git)",
                        "Error Ekstrem (4xx/5xx)",
                        "Bot/Scraper Tanpa Izin",
                        "Burst Velocity Anomali",
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setBlockReason(preset)}
                          className="rounded border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reason Text Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {t("Alasan Pemblokiran (Wajib):")}
                    </label>
                    <Input
                      type="text"
                      placeholder={t("Masukkan alasan pemblokiran...")}
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Scope Confirmation Notice */}
                  <div className="rounded bg-muted/30 p-2 text-[10px] text-muted-foreground">
                    <strong>{t("Cakupan:")}</strong>{" "}
                    {t("Pemblokiran hanya diterapkan pada aplikasi saat ini")} (
                    {appSlug}) {t("di level cluster HAProxy edge.")}
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setIsBlockFormOpen(false)
                        setBlockReason("")
                      }}
                      disabled={blockMutation.isPending}
                    >
                      {t("Batal")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!blockReason.trim() || blockMutation.isPending}
                      onClick={() =>
                        blockMutation.mutate({
                          ipAddress: data.ip,
                          reason: blockReason.trim(),
                          duration: blockDuration,
                        })
                      }
                    >
                      {blockMutation.isPending
                        ? t("Memproses...")
                        : t("Konfirmasi Blokir IP")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Existing Block Info Display */}
              {data.blockInfo ? (
                <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-3 text-[11px]">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-foreground">
                      {t("Alasan:")} {data.blockInfo.reason}
                    </div>
                    <Badge
                      variant={
                        data.blockInfo.status === "active"
                          ? "destructive"
                          : data.blockInfo.status === "failed"
                            ? "outline"
                            : "secondary"
                      }
                      className="text-[10px] uppercase"
                    >
                      {data.blockInfo.status}
                    </Badge>
                  </div>

                  {data.blockInfo.errorMessage ? (
                    <div className="rounded bg-destructive/10 p-2 text-destructive">
                      {t("Peringatan Penegakan:")} {data.blockInfo.errorMessage}
                    </div>
                  ) : null}

                  <div className="text-muted-foreground">
                    {t("Dibuat oleh:")} {data.blockInfo.createdBy} •{" "}
                    {new Date(data.blockInfo.createdAt).toLocaleString("id-ID")}
                  </div>
                  {data.blockInfo.expiresAt ? (
                    <div className="text-muted-foreground">
                      {t("Kedaluwarsa:")}{" "}
                      {new Date(data.blockInfo.expiresAt).toLocaleString(
                        "id-ID"
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      {t("Durasi: Permanen")}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
