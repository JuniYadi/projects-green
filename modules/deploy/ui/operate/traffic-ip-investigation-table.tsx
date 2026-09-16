"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  MagnifyingGlass,
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  Eye,
  GlobeHemisphereWest,
  Info,
} from "@phosphor-icons/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CountryFlag } from "@/components/ui/country-flag"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  TrafficIpListResponseDTO,
  TrafficSignal,
} from "../../opensearch/opensearch-traffic.types"
import { getSignalBadge } from "./traffic-ip-review-drawer"

export interface TrafficIpInvestigationTableProps {
  appSlug: string
  granularity?: "daily" | "monthly" | "yearly"
  date?: string
  month?: string
  year?: string
  onReviewIp: (ip: string) => void
}

export function TrafficIpInvestigationTable({
  appSlug,
  granularity = "daily",
  date,
  month,
  year,
  onReviewIp,
}: TrafficIpInvestigationTableProps) {
  const [search, setSearch] = useState("")
  const [signalFilter, setSignalFilter] = useState<TrafficSignal | "all">("all")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "2xx" | "3xx" | "4xx" | "5xx"
  >("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [sortBy, setSortBy] = useState<
    "requests" | "2xx" | "4xx" | "5xx" | "success" | "lastSeen"
  >("requests")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<TrafficIpListResponseDTO>({
      queryKey: [
        "traffic-ips-investigation",
        appSlug,
        granularity,
        date,
        month,
        year,
        page,
        limit,
        search,
        signalFilter,
        statusFilter,
        sortBy,
        sortDir,
      ],
      queryFn: async () => {
        const params = new URLSearchParams()
        if (granularity) params.set("granularity", granularity)
        if (granularity === "daily" && date) params.set("date", date)
        else if (granularity === "monthly" && month) params.set("month", month)
        else if (granularity === "yearly" && year) params.set("year", year)

        params.set("page", String(page))
        params.set("limit", String(limit))
        if (search.trim()) params.set("search", search.trim())
        if (signalFilter !== "all") params.set("signal", signalFilter)
        if (statusFilter !== "all") params.set("statusFamily", statusFilter)
        params.set("sortBy", sortBy)
        params.set("sortDir", sortDir)

        const res = await fetch(
          `/api/deploy/apps/${encodeURIComponent(appSlug)}/traffic/ips?${params.toString()}`
        )
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.message || "Failed to load traffic IPs")
        }
        const json = await res.json()
        return json.data as TrafficIpListResponseDTO
      },
      enabled: Boolean(appSlug),
    })

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>Investigasi Trafik Klien IP (Top 100)</span>
              {data ? (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {data.total} IP
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs text-muted-foreground">
              Analisis forensik pengunjung, sinyal otomasi, dan investigasi
              mendalam sebelum blokir
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Coverage info banner */}
            {data && data.coveragePercentage < 100 ? (
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground">
                <Info size={13} className="shrink-0 text-primary" />
                <span>
                  Cakupan:{" "}
                  <strong className="text-foreground">
                    {data.coveragePercentage}%
                  </strong>{" "}
                  trafik ({data.otherRequestCount.toLocaleString("id-ID")} req
                  di luar sampel)
                </span>
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => refetch()}
              className="h-8 px-2.5"
              title="Refresh Data IP"
            >
              <ArrowClockwise
                size={14}
                className={isFetching ? "animate-spin" : ""}
              />
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <MagnifyingGlass
              size={14}
              className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Cari alamat IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Signal Filter Pills */}
          <div className="flex flex-wrap items-center rounded-lg border border-border bg-muted/10 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setSignalFilter("all")
                setPage(1)
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                signalFilter === "all"
                  ? "bg-background font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua Sinyal
            </button>
            <button
              type="button"
              onClick={() => {
                setSignalFilter("likely_human")
                setPage(1)
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                signalFilter === "likely_human"
                  ? "bg-background font-medium text-emerald-600 shadow-xs dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Manusia
            </button>
            <button
              type="button"
              onClick={() => {
                setSignalFilter("likely_automated")
                setPage(1)
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                signalFilter === "likely_automated"
                  ? "bg-background font-medium text-rose-600 shadow-xs dark:text-rose-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bot / Scanner
            </button>
            <button
              type="button"
              onClick={() => {
                setSignalFilter("mixed")
                setPage(1)
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                signalFilter === "mixed"
                  ? "bg-background font-medium text-amber-600 shadow-xs dark:text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tercampur
            </button>
          </div>

          {/* Status Family Filter Pills */}
          <div className="flex items-center rounded-lg border border-border bg-muted/10 p-0.5 text-xs">
            {(["all", "2xx", "3xx", "4xx", "5xx"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status)
                  setPage(1)
                }}
                className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
                  statusFilter === status
                    ? "bg-background font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {status.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Sort selector */}
          <select
            value={`${sortBy}-${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split("-")
              setSortBy(
                field as
                  "requests" | "2xx" | "4xx" | "5xx" | "success" | "lastSeen"
              )
              setSortDir(dir as "asc" | "desc")
              setPage(1)
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="requests-desc">Urutkan: Request Terbanyak</option>
            <option value="requests-asc">Urutkan: Request Tersedikit</option>
            <option value="4xx-desc">Urutkan: Error 4xx Terbanyak</option>
            <option value="5xx-desc">Urutkan: Error 5xx Terbanyak</option>
            <option value="success-asc">Urutkan: Sukses Terendah</option>
            <option value="lastSeen-desc">Urutkan: Waktu Terbaru</option>
          </select>

          {/* Limit selector */}
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value))
              setPage(1)
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="10">10 per halaman</option>
            <option value="25">25 per halaman</option>
            <option value="50">50 per halaman</option>
            <option value="100">100 per halaman</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center text-xs text-muted-foreground">
            <ArrowClockwise size={20} className="animate-spin text-primary" />
            <p className="mt-2 font-medium">Memuat data IP investigasi...</p>
          </div>
        ) : isError ? (
          <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
            <p className="font-semibold">Gagal memuat data investigasi IP</p>
            <p className="mt-1">
              {error instanceof Error
                ? error.message
                : "Terjadi kesalahan sistem"}
            </p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center text-xs text-muted-foreground">
            <p>Tidak ada alamat IP yang sesuai dengan filter pencarian</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="border-b border-border text-xs">
                  <TableHead className="w-[180px]">IP & Geolokasi</TableHead>
                  <TableHead className="w-[140px]">Sinyal Trafik</TableHead>
                  <TableHead className="w-[110px] text-right">
                    Total Request
                  </TableHead>
                  <TableHead className="min-w-[180px]">
                    Komposisi Status
                  </TableHead>
                  <TableHead className="w-[100px] text-right">Sukses</TableHead>
                  <TableHead className="w-[140px]">Klien & Perangkat</TableHead>
                  <TableHead className="w-[120px]">Terakhir Dilihat</TableHead>
                  <TableHead className="w-[80px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border text-xs">
                {data.items.map((item) => {
                  const signalMeta = getSignalBadge(
                    item.signal,
                    item.confidence
                  )
                  const total = item.requestsCount || 1
                  const segments = [
                    {
                      key: "2xx",
                      count: item.status2xx,
                      className: "bg-emerald-500",
                    },
                    {
                      key: "3xx",
                      count: item.status3xx,
                      className: "bg-sky-500",
                    },
                    {
                      key: "4xx",
                      count: item.status4xx,
                      className: "bg-amber-500",
                    },
                    {
                      key: "5xx",
                      count: item.status5xx,
                      className: "bg-rose-500",
                    },
                  ].filter((s) => s.count > 0)

                  return (
                    <TableRow key={item.ip} className="hover:bg-muted/10">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <CountryFlag
                            country={item.countryCode}
                            className="rounded-2xs h-3.5 w-5 shrink-0 object-cover shadow-2xs"
                            fallback={
                              <GlobeHemisphereWest
                                size={15}
                                className="shrink-0 text-muted-foreground"
                              />
                            }
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                              <span>{item.ip}</span>
                              {item.isBlocked ? (
                                <Badge
                                  variant="destructive"
                                  className="px-1 py-0 text-[9px] uppercase"
                                >
                                  Blok
                                </Badge>
                              ) : null}
                            </div>
                            <div className="max-w-[140px] truncate text-[11px] text-muted-foreground">
                              {[item.city, item.countryName]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5">
                        <Badge
                          variant={signalMeta.variant}
                          className={`flex items-center gap-1 px-2 py-0.5 text-[11px] ${signalMeta.className}`}
                        >
                          {signalMeta.icon}
                          <span>{signalMeta.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell className="py-2.5 text-right font-mono">
                        <div className="font-semibold text-foreground">
                          {item.requestsCount.toLocaleString("id-ID")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.percentage}%
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="space-y-1">
                          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/20">
                            {segments.map((s) => (
                              <div
                                key={s.key}
                                style={{ width: `${(s.count / total) * 100}%` }}
                                className={`h-full ${s.className}`}
                                title={`${s.key}: ${s.count}`}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                            {segments.map((s) => (
                              <span key={s.key}>
                                {s.count} {s.key}
                              </span>
                            ))}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5 text-right font-mono font-medium text-foreground">
                        {item.successRatio}%
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="truncate font-medium text-foreground">
                          {item.primaryClient}
                        </div>
                        <div className="text-[10px] text-muted-foreground capitalize">
                          {item.primaryDevice}
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5 text-[11px] text-muted-foreground">
                        {item.lastSeen
                          ? new Date(item.lastSeen).toLocaleTimeString(
                              "id-ID",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "-"}
                      </TableCell>

                      <TableCell className="py-2.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => onReviewIp(item.ip)}
                        >
                          <Eye size={13} className="mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {data && totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div>
              Menampilkan {Math.min((page - 1) * limit + 1, data.total)} -{" "}
              {Math.min(page * limit, data.total)} dari {data.total} IP
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2"
              >
                <CaretLeft size={13} />
              </Button>
              <span>
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2"
              >
                <CaretRight size={13} />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
