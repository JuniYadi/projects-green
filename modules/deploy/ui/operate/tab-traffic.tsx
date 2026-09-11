"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { TrafficSummaryCards } from "./traffic-summary-cards"
import { TrafficHourlyChart } from "./traffic-hourly-chart"
import { TrafficTopPagesCard } from "./traffic-top-pages-card"
import { TrafficLiveStreamTable } from "./traffic-live-stream-table"
import { Button } from "@/components/ui/button"
import { ArrowClockwise } from "@phosphor-icons/react"
import type { AppTrafficReportDTO } from "../../opensearch/opensearch-traffic.types"

export interface TabTrafficProps {
  appSlug: string
  locale?: string
}

export function TabTraffic({ appSlug }: TabTrafficProps) {
  const [granularity, setGranularity] = useState<
    "daily" | "monthly" | "yearly"
  >("daily")
  const [targetDate, setTargetDate] = useState<string>("")
  const [targetMonth, setTargetMonth] = useState<string>("")
  const [targetYear, setTargetYear] = useState<string>("")

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<AppTrafficReportDTO>({
      queryKey: [
        "app-traffic-report",
        appSlug,
        granularity,
        targetDate,
        targetMonth,
        targetYear,
      ],
      queryFn: async () => {
        const params = new URLSearchParams()
        params.set("granularity", granularity)
        if (granularity === "daily" && targetDate) {
          params.set("date", targetDate)
        } else if (granularity === "monthly" && targetMonth) {
          params.set("month", targetMonth)
        } else if (granularity === "yearly" && targetYear) {
          params.set("year", targetYear)
        }

        const res = await fetch(
          `/api/deploy/apps/${encodeURIComponent(appSlug)}/traffic/report?${params.toString()}`
        )
        if (!res.ok) throw new Error("Failed to fetch traffic report")
        const json = await res.json()
        return json.data as AppTrafficReportDTO
      },
      enabled: Boolean(appSlug),
    })

  return (
    <div className="space-y-6">
      {/* Header & Granularity Control */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Laporan Trafik & Pengunjung
          </h2>
          <p className="text-xs text-muted-foreground">
            Rekap statistik kunjungan web dari database snapshot historikal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity Pills */}
          <div className="flex items-center rounded-lg border border-border bg-muted/10 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setGranularity("daily")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === "daily"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Harian
            </button>
            <button
              type="button"
              onClick={() => setGranularity("monthly")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === "monthly"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => setGranularity("yearly")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === "yearly"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tahunan
            </button>
          </div>

          {/* Date Selector input */}
          {granularity === "daily" && (
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
            />
          )}

          {granularity === "monthly" && (
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
            />
          )}

          {granularity === "yearly" && (
            <input
              type="number"
              min="2024"
              max="2035"
              placeholder="Tahun (e.g. 2026)"
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              className="h-8 w-24 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
            />
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
            className="h-8 px-2.5"
            title="Refresh Laporan"
          >
            <ArrowClockwise
              size={14}
              className={isFetching ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-muted/10 text-xs text-muted-foreground">
          <ArrowClockwise size={24} className="animate-spin text-primary" />
          <p className="mt-2 font-medium">Memuat data laporan trafik...</p>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-xs text-destructive">
          <p className="font-semibold">Gagal memuat laporan trafik</p>
          <p className="mt-1">
            {error instanceof Error
              ? error.message
              : "Terjadi kesalahan sistem"}
          </p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* 1. Summary Cards */}
          <TrafficSummaryCards
            totalRequests={data.totalRequests}
            successRate={data.successRate}
            avgLatencyMs={data.avgLatencyMs}
            totalBytesFormatted={data.totalBytesFormatted}
            periodLabel={data.periodLabel}
          />

          {/* 2. Visual Hourly / Date / Monthly Chart */}
          <TrafficHourlyChart
            trend={data.trend}
            granularity={data.granularity}
            periodLabel={data.periodLabel}
          />

          {/* 3. Top Pages & Broken Links Card */}
          <TrafficTopPagesCard
            topPages={data.topPages}
            troubledPages={data.troubledPages}
          />

          {/* 4. Live Feed Stream Section */}
          <TrafficLiveStreamTable appSlug={appSlug} />
        </div>
      ) : null}
    </div>
  )
}
