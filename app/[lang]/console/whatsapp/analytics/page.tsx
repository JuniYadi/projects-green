"use client"

import * as React from "react"
import {
  ChartLine,
  Funnel,
  Calendar,
  ArrowsClockwise,
  WarningCircle,
} from "@phosphor-icons/react"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

type PageState = "idle" | "loading" | "error" | "loaded"

interface ComparisonRow {
  date: string
  phoneNumberId?: string
  metric: string
  metaValue: number
  localValue: number
  delta: number
  deltaPercent: number
}

interface CostRow {
  phoneNumberId?: string
  conversationCategory?: string
  date: string
  metaCost: number
  localCost: number
  delta: number
  currency: string
}

interface SyncResult {
  ok: boolean
  syncedCount: number
  discrepancies: ComparisonRow[]
}

interface ReportResult {
  ok: boolean
  from: string
  to: string
  deviceId: string
  comparisons: ComparisonRow[]
  summary: {
    totalMeta: number
    totalLocal: number
    totalDelta: number
    rowsWithDiscrepancy: number
  }
}

interface CostResult {
  ok: boolean
  rows: CostRow[]
  totalMetaCost: number
  totalLocalCost: number
  totalDelta: number
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US")
}

function deltaBadge(deltaPercent: number) {
  const abs = Math.abs(deltaPercent)
  if (abs <= 0.05) return { label: "OK", variant: "secondary" as const }
  if (deltaPercent > 0) return { label: `+${(deltaPercent * 100).toFixed(1)}%`, variant: "destructive" as const }
  return { label: `${(deltaPercent * 100).toFixed(1)}%`, variant: "warning" as const }
}

function deltaBadgeCost(delta: number) {
  if (delta === 0) return { label: "Match", variant: "secondary" as const }
  if (delta > 0) return { label: `+${delta.toFixed(4)}`, variant: "destructive" as const }
  return { label: `${delta.toFixed(4)}`, variant: "warning" as const }
}

export default function WhatsAppAnalyticsPage() {
  const [state, setState] = React.useState<PageState>("idle")
  const [error, setError] = React.useState("")
  const [tab, setTab] = React.useState<"comparison" | "cost">("comparison")
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [selectedDevice, setSelectedDevice] = React.useState("")

  const [startDate, setStartDate] = React.useState(
    () => new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0]
  )
  const [endDate, setEndDate] = React.useState(
    () => new Date().toISOString().split("T")[0]
  )

  const [syncResult, setSyncResult] = React.useState<SyncResult | null>(null)
  const [reportResult, setReportResult] = React.useState<ReportResult | null>(null)
  const [costResult, setCostResult] = React.useState<CostResult | null>(null)

  // Load devices on mount
  React.useEffect(() => {
    whatsappClient.devices.list().then((res) => {
      setDevices(res.devices)
      if (res.devices.length > 0) setSelectedDevice(res.devices[0].id)
    }).catch(() => {})
  }, [])

  const handleSync = async () => {
    if (!selectedDevice) return
    setState("loading")
    setSyncResult(null)
    setError("")
    try {
      const res = await whatsappClient.analytics.sync({
        deviceId: selectedDevice,
        startDate,
        endDate,
        granularity: "DAY",
      })
      setSyncResult(res)
      setState("loaded")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState("error")
    }
  }

  const handleReport = async () => {
    if (!selectedDevice) return
    setState("loading")
    setReportResult(null)
    setError("")
    try {
      const res = await whatsappClient.analytics.report({
        deviceId: selectedDevice,
        startDate,
        endDate,
      })
      setReportResult(res)
      setState("loaded")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState("error")
    }
  }

  const handleCostReconciliation = async () => {
    if (!selectedDevice) return
    setState("loading")
    setCostResult(null)
    setError("")
    try {
      const res = await whatsappClient.analytics.costReconciliation({
        deviceId: selectedDevice,
        startDate,
        endDate,
      })
      setCostResult(res)
      setState("loaded")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState("error")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Compare Meta-reported analytics with local data.
            </p>
          </div>
          {devices.length > 0 && (
            <div className="flex items-center gap-2">
              <Funnel className="size-4 text-muted-foreground" />
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.phoneNumber ?? d.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Date Range */}
      <div className="flex items-center gap-3">
        <Calendar className="size-4 text-muted-foreground" />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === "comparison" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("comparison")}
        >
          <ChartLine className="mr-1 size-4" />
          Comparison
        </Button>
        <Button
          variant={tab === "cost" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("cost")}
        >
          <WarningCircle className="mr-1 size-4" />
          Cost Reconciliation
        </Button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {tab === "comparison" && (
          <>
            <Button onClick={handleSync} disabled={state === "loading" || !selectedDevice}>
              <ArrowsClockwise className={`mr-1 size-4 ${state === "loading" ? "animate-spin" : ""}`} />
              Sync from Meta
            </Button>
            <Button variant="outline" onClick={handleReport} disabled={state === "loading" || !selectedDevice}>
              Generate Report
            </Button>
          </>
        )}
        {tab === "cost" && (
          <Button onClick={handleCostReconciliation} disabled={state === "loading" || !selectedDevice}>
            <WarningCircle className="mr-1 size-4" />
            Run Reconciliation
          </Button>
        )}
      </div>

      {state === "error" && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {state === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {/* Sync Result Summary */}
      {syncResult && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Synced <strong>{syncResult.syncedCount}</strong> records.
              {syncResult.discrepancies.length > 0 && (
                <span className="ml-2 text-destructive">
                  {syncResult.discrepancies.length} discrepancies found.
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comparison Report */}
      {reportResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Comparison Report ({reportResult.from} to {reportResult.to})
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Meta: <strong>{formatNumber(reportResult.summary.totalMeta)}</strong></span>
                <span>Local: <strong>{formatNumber(reportResult.summary.totalLocal)}</strong></span>
                <span>Delta: <strong className={reportResult.summary.totalDelta !== 0 ? "text-destructive" : ""}>
                  {formatNumber(reportResult.summary.totalDelta)}
                </strong></span>
                <span>Discrepant rows: <strong>{reportResult.summary.rowsWithDiscrepancy}</strong></span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reportResult.comparisons.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No data for the selected range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Metric</th>
                      <th className="pb-2 pr-4 font-medium text-right">Meta</th>
                      <th className="pb-2 pr-4 font-medium text-right">Local</th>
                      <th className="pb-2 pr-4 font-medium text-right">Delta</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportResult.comparisons.map((row, i) => {
                      const badge = deltaBadge(row.deltaPercent)
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4">{row.date}</td>
                          <td className="py-2 pr-4 capitalize">{row.metric}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.metaValue)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.localValue)}</td>
                          <td className="py-2 pr-4 text-right">{row.delta > 0 ? "+" : ""}{formatNumber(row.delta)}</td>
                          <td className="py-2">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost Reconciliation */}
      {costResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cost Reconciliation</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Meta: <strong>{costResult.totalMetaCost.toFixed(4)}</strong></span>
                <span>Local: <strong>{costResult.totalLocalCost.toFixed(4)}</strong></span>
                <span>Delta: <strong className={costResult.totalDelta !== 0 ? "text-destructive" : ""}>
                  {costResult.totalDelta.toFixed(4)}
                </strong></span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {costResult.rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No cost data for the selected range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium text-right">Meta Cost</th>
                      <th className="pb-2 pr-4 font-medium text-right">Local Cost</th>
                      <th className="pb-2 pr-4 font-medium text-right">Delta</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costResult.rows.map((row, i) => {
                      const badge = deltaBadgeCost(row.delta)
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4">{row.date}</td>
                          <td className="py-2 pr-4">{row.conversationCategory ?? "N/A"}</td>
                          <td className="py-2 pr-4 text-right font-mono">{row.metaCost.toFixed(4)}</td>
                          <td className="py-2 pr-4 text-right font-mono">{row.localCost.toFixed(4)}</td>
                          <td className="py-2 pr-4 text-right font-mono">{row.delta > 0 ? "+" : ""}{row.delta.toFixed(4)}</td>
                          <td className="py-2">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            <span className="ml-1 text-xs text-muted-foreground">{row.currency}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Idle state */}
      {state === "idle" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ChartLine className="mb-4 size-12 text-muted-foreground" weight="fill" />
            <h3 className="mb-1 text-lg font-medium">No data loaded</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Select a device and date range, then sync from Meta or generate a report.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
