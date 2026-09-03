"use client"

import * as React from "react"
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Percent,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface FinancialSummary {
  period: {
    startDate: string
    endDate: string
  }
  kpi: {
    totalDeliveredMessages: number
    totalRevenueIdr: string
    totalMetaBaseCostIdr: string
    totalMetaVatCostIdr: string
    totalMetaNetCostIdr: string
    grossProfitIdr: string
    grossMarginPct: string
    status: "HEALTHY" | "MODERATE" | "RISK"
  }
  categoryBreakdown: Array<{
    category: string
    volume: number
    metaBaseCostIdr: string
    metaVatCostIdr: string
    metaTotalCostIdr: string
    revenueIdr: string
    grossProfitIdr: string
    marginPct: string
  }>
}

interface OrgProfitabilityItem {
  organizationId: string
  organizationName?: string
  deviceCount: number
  totalDelivered: number
  metaBaseCostIdr: string
  metaVatCostIdr: string
  metaTotalCostIdr: string
  revenueIdr: string
  grossProfitIdr: string
  marginPct: string
  marginStatus: "HEALTHY" | "MODERATE" | "RISK"
}

export function AdminWhatsappAnalyticsView() {
  const [syncing, setSyncing] = React.useState(false)
  const [summary, setSummary] = React.useState<FinancialSummary | null>(null)
  const [orgs, setOrgs] = React.useState<OrgProfitabilityItem[]>([])
  const [days, setDays] = React.useState("30")
  const [refreshToken, setRefreshToken] = React.useState(0)

  React.useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const [sumRes, orgsRes] = await Promise.all([
          fetch(`/api/admin/whatsapp/analytics/summary?days=${days}`),
          fetch(`/api/admin/whatsapp/analytics/organizations?days=${days}`),
        ])
        const sumJson = (await sumRes.json()) as {
          ok?: boolean
          data?: FinancialSummary
        }
        const orgsJson = (await orgsRes.json()) as {
          ok?: boolean
          data?: OrgProfitabilityItem[]
        }
        if (!ignore) {
          if (sumJson.ok && sumJson.data) setSummary(sumJson.data)
          if (orgsJson.ok && Array.isArray(orgsJson.data))
            setOrgs(orgsJson.data)
        }
      } catch (err) {
        console.error("Failed to load admin WhatsApp analytics:", err)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [days, refreshToken])

  const handleSyncMeta = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/admin/whatsapp/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days) }),
      })
      const json = (await res.json()) as { ok?: boolean }
      if (json.ok) {
        setRefreshToken((prev) => prev + 1)
      }
    } catch (err) {
      console.error("Failed to sync Meta pricing analytics:", err)
    } finally {
      setSyncing(false)
    }
  }

  const formatIdr = (val?: string | number) => {
    if (val === undefined || val === null) return "Rp 0"
    const num = typeof val === "string" ? parseFloat(val) : val
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            WhatsApp Analytics & Profit
          </h1>
          <p className="text-sm text-muted-foreground">
            Rekonsiliasi biaya riil Meta (+ PPN 11%), pendapatan langganan, dan
            margin keuntungan platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">7 Hari Terakhir</option>
            <option value="30">30 Hari Terakhir</option>
            <option value="60">60 Hari Terakhir</option>
            <option value="90">90 Hari Terakhir</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncMeta}
            disabled={syncing}
          >
            <RefreshCw
              className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Menyinkronkan..." : "Sync Meta Pricing"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Omzet</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatIdr(summary?.kpi.totalRevenueIdr)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Dari alokasi kuota & overage pelanggan
            </p>
          </CardContent>
        </Card>

        {/* Total Meta Expense (COGS inc. PPN 11%) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Modal Meta (COGS)
            </CardTitle>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatIdr(summary?.kpi.totalMetaNetCostIdr)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Inc. PPN 11%: {formatIdr(summary?.kpi.totalMetaVatCostIdr)}
            </p>
          </CardContent>
        </Card>

        {/* Realized Gross Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Laba / Rugi Kotor
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                parseFloat(summary?.kpi.grossProfitIdr ?? "0") < 0
                  ? "text-destructive"
                  : "text-primary"
              }`}
            >
              {formatIdr(summary?.kpi.grossProfitIdr)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {parseFloat(summary?.kpi.grossProfitIdr ?? "0") < 0
                ? "Rugi operasional biaya pesan"
                : "Laba kotor sebelum biaya server"}
            </p>
          </CardContent>
        </Card>

        {/* Profit Margin % */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Kesehatan Margin
            </CardTitle>
            <Percent className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span
                className={`text-2xl font-bold ${
                  parseFloat(summary?.kpi.grossMarginPct ?? "0") < 0
                    ? "text-destructive"
                    : ""
                }`}
              >
                {summary?.kpi.grossMarginPct ?? "0"}%
              </span>
              {summary?.kpi.status === "HEALTHY" ? (
                <Badge
                  variant="outline"
                  className="border-primary text-xs text-primary"
                >
                  <CheckCircle2 className="mr-1 size-3" /> Sehat
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-destructive text-xs text-destructive"
                >
                  <AlertTriangle className="mr-1 size-3" /> Waspada
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.kpi.totalDeliveredMessages ?? 0} total pesan terkirim
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan per Kategori Pesan</CardTitle>
          <CardDescription>
            Perbandingan omzet tagihan vs modal riil Meta (termasuk PPN 11%) per
            kategori.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Volume Pesan</TableHead>
                <TableHead className="text-right">Omzet Tagihan</TableHead>
                <TableHead className="text-right">
                  Modal Meta (Inc. PPN)
                </TableHead>
                <TableHead className="text-right">Laba / Rugi (Net)</TableHead>
                <TableHead className="text-right">Margin (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.categoryBreakdown?.map((item) => {
                const isNegative = parseFloat(item.grossProfitIdr) < 0
                return (
                  <TableRow key={item.category}>
                    <TableCell className="font-medium">
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.volume.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatIdr(item.revenueIdr)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      <div>{formatIdr(item.metaTotalCostIdr)}</div>
                      <div className="text-[10px] text-muted-foreground/70">
                        PPN: {formatIdr(item.metaVatCostIdr)}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        isNegative ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {formatIdr(item.grossProfitIdr)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        isNegative ? "text-destructive" : ""
                      }`}
                    >
                      {item.marginPct}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Organization Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kesehatan Margin per Tenant / Perusahaan</CardTitle>
          <CardDescription>
            Evaluasi unit ekonomi per organisasi untuk memantau tenant yang
            ber-margin tinggi vs margin berisiko.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Belum ada data rekonsiliasi organisasi pada periode ini. Klik
              &quot;Sync Meta Pricing&quot; untuk memperbarui data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Tenant / Organisasi</TableHead>
                  <TableHead className="text-right">Devices</TableHead>
                  <TableHead className="text-right">Volume Pesan</TableHead>
                  <TableHead className="text-right">Total Tagihan</TableHead>
                  <TableHead className="text-right">
                    Modal Meta (+PPN)
                  </TableHead>
                  <TableHead className="text-right">Laba / Rugi</TableHead>
                  <TableHead className="text-right">Margin (%)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => {
                  const isNegative = parseFloat(org.grossProfitIdr) < 0
                  return (
                    <TableRow key={org.organizationId}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {org.organizationName || org.organizationId}
                        </div>
                        {org.organizationName &&
                          org.organizationName !== org.organizationId && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {org.organizationId}
                            </div>
                          )}
                      </TableCell>
                      <TableCell className="text-right">
                        {org.deviceCount}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {org.totalDelivered.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatIdr(org.revenueIdr)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatIdr(org.metaTotalCostIdr)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          isNegative ? "text-destructive" : "text-primary"
                        }`}
                      >
                        {formatIdr(org.grossProfitIdr)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          isNegative ? "text-destructive" : ""
                        }`}
                      >
                        {org.marginPct}%
                      </TableCell>
                      <TableCell className="text-center">
                        {org.marginStatus === "HEALTHY" ? (
                          <Badge
                            variant="outline"
                            className="border-primary text-primary"
                          >
                            Healthy
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-destructive text-destructive"
                          >
                            Risk
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
