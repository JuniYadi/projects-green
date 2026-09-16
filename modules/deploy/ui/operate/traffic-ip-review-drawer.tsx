"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
} from "@phosphor-icons/react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CountryFlag } from "@/components/ui/country-flag"
import type {
  TrafficIpDetailDTO,
  TrafficSignal,
} from "../../opensearch/opensearch-traffic.types"

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
        label: "Kemungkinan Manusia",
        variant: "outline" as const,
        icon: <User size={13} className="text-emerald-500" />,
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
      }
    case "likely_automated":
      return {
        label: "Otomatis / Bot / Scanner",
        variant: "outline" as const,
        icon: <Robot size={13} className="text-rose-500" />,
        className:
          "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium",
      }
    case "mixed":
      return {
        label: "Tercampur (Mixed / NAT)",
        variant: "outline" as const,
        icon: <ShieldWarning size={13} className="text-amber-500" />,
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium",
      }
    case "unknown":
    default:
      return {
        label: "Tidak Diketahui",
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
  const [activeTab, setActiveTab] = useState<"paths" | "clients" | "timeline">(
    "paths"
  )

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
                  {ip || "Alamat IP"}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {[data?.city, data?.countryName].filter(Boolean).join(", ") ||
                    "Sedang memuat data geolokasi..."}
                </SheetDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => refetch()}
              className="h-8 px-2"
              title="Refresh Bukti IP"
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
              Mengumpulkan bukti jejak trafik IP dari OpenSearch...
            </p>
          </div>
        ) : isError ? (
          <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
            <p className="font-semibold">Gagal memuat jejak bukti IP</p>
            <p className="mt-1">
              {error instanceof Error
                ? error.message
                : "Terjadi kesalahan sistem"}
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
                    Keyakinan: {data.signal.confidence}%
                  </span>
                </div>

                {data.blockInfo?.isBlocked ? (
                  <Badge
                    variant="destructive"
                    className="flex items-center gap-1 font-mono text-[11px]"
                  >
                    <Prohibit size={12} />
                    <span>
                      DIBLOKIR ({data.blockInfo.status.toUpperCase()})
                    </span>
                  </Badge>
                ) : null}
              </div>

              {/* Reasons why this classification was assigned */}
              <div className="space-y-1.5 rounded-md bg-muted/20 p-3 text-xs text-foreground">
                <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <WarningCircle size={14} />
                  <span>Alasan & Bukti Klasifikasi:</span>
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
                  Total Request
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {data.totalRequests.toLocaleString("id-ID")}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">
                  Success Rate
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {data.successRate}%
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">
                  Kecepatan (Burst)
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <span>{data.velocity.maxRpm} RPM</span>
                  {data.velocity.isBurst ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                    >
                      Burst
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">
                  Aset Statis
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
                  Distribusi Status HTTP
                </span>
                <span className="text-muted-foreground">
                  {data.successRate}% Berhasil (2xx)
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
                <span>Pertama dilihat:</span>
                <span className="font-mono font-medium text-foreground">
                  {new Date(data.firstSeen).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock size={14} />
                <span>Terakhir dilihat:</span>
                <span className="font-mono font-medium text-foreground">
                  {new Date(data.lastSeen).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* 5. Deep Evidence Tabs: Paths / User-Agents / Timeline */}
            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "paths" | "clients" | "timeline")
              }
              className="space-y-3"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="paths" className="text-xs">
                  <FileCode size={14} className="mr-1.5" />
                  Path Dikunjungi
                </TabsTrigger>
                <TabsTrigger value="clients" className="text-xs">
                  <Browser size={14} className="mr-1.5" />
                  Klien / User-Agent
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">
                  <Clock size={14} className="mr-1.5" />
                  Aktivitas Waktu
                </TabsTrigger>
              </TabsList>

              {/* Paths Tab */}
              <TabsContent value="paths" className="space-y-4 pt-1">
                {/* 4xx / Scanner Probe Paths */}
                {data.pathsByStatus.status4xx.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <WarningCircle size={14} />
                      <span>Path Status 4xx (Error / Scanner Target):</span>
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
                    <span>Path Status 2xx (Berhasil):</span>
                  </div>
                  {data.pathsByStatus.status2xx.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      Tidak ada rekaman permintaan 2xx
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
                      <span>Path Status 5xx (Gangguan Server):</span>
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
                    Tidak ada User-Agent tercatat
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
                    Tidak ada log timeline
                  </div>
                ) : (
                  <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
                    {data.timeline.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-muted-foreground">
                          {new Date(t.timestamp).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {t.requests} req
                          </span>
                          {t.errors > 0 ? (
                            <Badge
                              variant="destructive"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {t.errors} err
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
                  <h4 className="text-xs font-semibold text-foreground">
                    Tindakan Akses & Keamanan
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Blokir atau batasi lalu lintas dari IP ini di level ingress
                    gateway
                  </p>
                </div>

                {data.blockInfo?.isBlocked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-destructive text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => onBlockAction?.(data.ip, "unblock")}
                  >
                    Buka Blokir (Unblock)
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onBlockAction?.(data.ip, "block")}
                  >
                    <Prohibit size={14} className="mr-1.5" />
                    Blokir Akses IP
                  </Button>
                )}
              </div>

              {data.blockInfo ? (
                <div className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-[11px]">
                  <div className="font-medium text-foreground">
                    Alasan: {data.blockInfo.reason}
                  </div>
                  <div className="text-muted-foreground">
                    Dibuat oleh: {data.blockInfo.createdBy} •{" "}
                    {new Date(data.blockInfo.createdAt).toLocaleString("id-ID")}
                  </div>
                  {data.blockInfo.expiresAt ? (
                    <div className="text-muted-foreground">
                      Kedaluwarsa:{" "}
                      {new Date(data.blockInfo.expiresAt).toLocaleString(
                        "id-ID"
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      Durasi: Permanen
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
