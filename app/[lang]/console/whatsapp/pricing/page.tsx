"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  CurrencyDollar,
  Phone,
  Warning,
  PaperPlaneTilt,
  Info,
  Receipt,
  CheckCircle,
  Clock,
  ArrowCounterClockwise,
  MagnifyingGlass,
  Funnel,
  ArrowsClockwise,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"

type LedgerEntry = {
  id: string
  organizationId: string
  waMessageId: string
  phoneNumber: string
  category: string
  quotaKey: string
  quotaValue: number
  status: string
  isReverted: boolean
  revertReason: string | null
  revertedAt: string | null
  lastStatus: string | null
  whatsappDeviceId: string | null
  createdAt: string
  updatedAt: string
  devicePhoneNumber?: string | null
}

function formatPhone(phone: string): string {
  if (phone.startsWith("+")) return phone
  return `+${phone}`
}

function formatQuotaCredit(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return value

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(iso: string | Date): string {
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso
    return d.toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(iso)
  }
}

export default function WhatsAppPricingPage() {
  const params = useParams<{ lang?: string }>()
  const searchParams = useSearchParams()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.whatsapp
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>("all")

  // Pricing rates query
  const {
    data: pricing,
    isLoading: isPricingLoading,
    error: pricingError,
    refetch: refetchPricing,
  } = useQuery({
    queryKey: ["whatsapp", "messages", "pricing"],
    queryFn: async () => {
      const payload = await whatsappClient.messages.pricing()
      if (!payload.ok) throw new Error("Pricing information is unavailable")
      return payload
    },
    staleTime: 30_000,
  })

  // Ledger state & query
  const [ledgerLoading, setLedgerLoading] = React.useState(true)
  const [ledgerData, setLedgerData] = React.useState<LedgerEntry[]>([])
  const [ledgerSummary, setLedgerSummary] = React.useState({
    totalCredits: 0,
    totalRefundedCredits: 0,
    activeCredits: 0,
  })
  const [ledgerTotal, setLedgerTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const [statusFilter, setStatusFilter] = React.useState(
    searchParams.get("status") || "all"
  )
  const [categoryFilter, setCategoryFilter] = React.useState(
    searchParams.get("category") || "all"
  )
  const [searchQuery, setSearchQuery] = React.useState(
    searchParams.get("search") || ""
  )
  const [ledgerSelectedDevice, setLedgerSelectedDevice] = React.useState(
    searchParams.get("deviceId") || "all"
  )

  React.useEffect(() => {
    let cancelled = false
    const loadLedger = async () => {
      setLedgerLoading(true)
      try {
        const res = await whatsappClient.usage.ledger({
          page,
          limit: 20,
          status: statusFilter !== "all" ? statusFilter : undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          deviceId:
            ledgerSelectedDevice !== "all" ? ledgerSelectedDevice : undefined,
          search: searchQuery.trim() || undefined,
        })
        if (cancelled) return
        if (res && res.ok) {
          setLedgerData((res.data as unknown as LedgerEntry[]) ?? [])
          setLedgerTotal(res.total ?? 0)
          setTotalPages(res.totalPages ?? 1)
          if (res.summary) setLedgerSummary(res.summary)
        }
      } catch (err) {
        console.error("Failed to load WhatsApp ledger:", err)
      } finally {
        if (!cancelled) setLedgerLoading(false)
      }
    }
    loadLedger()
    return () => {
      cancelled = true
    }
  }, [
    page,
    statusFilter,
    categoryFilter,
    ledgerSelectedDevice,
    searchQuery,
    refreshKey,
  ])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const devices = pricing?.devices ?? []
  const filteredDevices =
    selectedDeviceId === "all"
      ? devices
      : devices.filter((d) => d.deviceId === selectedDeviceId)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t.pricing.heading} & Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Category rates, quota deduction policies, and itemized transaction
            ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPricing()
              setRefreshKey((k) => k + 1)
            }}
            disabled={ledgerLoading}
            className="gap-1.5"
          >
            <ArrowsClockwise
              className={`size-4 ${ledgerLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={localizePathname({
                pathname: "/console/whatsapp/usage",
                locale,
              })}
            >
              {t.usage.heading}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link
              href={localizePathname({
                pathname: "/console/whatsapp/messages",
                locale,
              })}
            >
              <PaperPlaneTilt className="mr-1.5 size-4" />
              {t.messages.sendMessage}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Info className="size-4 shrink-0 text-primary" />
          <span>
            In-quota messages deduct from your plan quota allowance first (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Quota Credit
            </span>
            ). When monthly quota is exhausted, Pay-As-You-Go overage (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              PAYG Overage
            </span>
            ) rates apply directly from your prepaid wallet balance.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          asChild
          className="ml-3 h-7 shrink-0 text-xs"
        >
          <Link
            href={localizePathname({
              pathname: "/console/billing/topup",
              locale,
            })}
          >
            <CurrencyDollar className="mr-1 size-3.5" />
            Top Up Balance
          </Link>
        </Button>
      </div>

      {/* Category Rates & Multi-Tier Comparison Table */}
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              WhatsApp Category Rates & Tier Comparison
            </CardTitle>
            <CardDescription className="text-xs">
              Compare in-quota deduction against Pay-As-You-Go (PAYG) overage
              rates across volume tiers.
            </CardDescription>
          </div>
          {devices.length > 1 && (
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 text-muted-foreground" />
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="rounded-md border bg-background px-2.5 py-1 text-xs"
                aria-label="Filter by WhatsApp device"
              >
                <option value="all">All Devices ({devices.length})</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {formatPhone(d.phoneNumber)} ({d.country})
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isPricingLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : pricingError ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Warning className="mb-2 size-6 text-destructive" weight="fill" />
              <p className="text-xs font-medium text-destructive">
                Pricing rates unavailable.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => refetchPricing()}
              >
                Retry
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No active WhatsApp devices found.
            </div>
          ) : (
            <div className="space-y-6">
              {filteredDevices.map((device) => {
                const activeTier = device.rateTier ?? "BASE"
                const hasQuota = (device.quotaRemaining ?? 0) > 0
                return (
                  <div
                    key={device.deviceId}
                    className="overflow-hidden rounded-lg border text-xs"
                  >
                    <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Phone className="size-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">
                          {formatPhone(device.phoneNumber)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Country: {device.country}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={
                            hasQuota
                              ? "bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400"
                              : "bg-destructive/10 font-medium text-destructive"
                          }
                        >
                          {hasQuota
                            ? `Quota Active (${device.quotaRemaining.toLocaleString()} remaining)`
                            : "Quota Exhausted (PAYG Active)"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Rate Tier:
                        </span>
                        <Badge variant="secondary" className="font-semibold">
                          {activeTier}
                        </Badge>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <caption className="sr-only">
                          Category deduction rates and multi-tier pricing for{" "}
                          {device.phoneNumber}
                        </caption>
                        <thead className="border-b bg-muted/20 text-muted-foreground">
                          <tr>
                            <th scope="col" className="px-4 py-3 font-semibold">
                              Category
                            </th>
                            <th scope="col" className="px-4 py-3 text-center">
                              <div
                                className={`inline-flex items-center rounded px-2 py-0.5 font-semibold ${
                                  hasQuota
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-destructive/10 text-destructive line-through"
                                }`}
                              >
                                Quota Credit{" "}
                                {hasQuota ? "(Active)" : "(Exhausted)"}
                              </div>
                              <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                                In-Quota Allowance
                              </div>
                            </th>
                            <th
                              scope="col"
                              className={`px-4 py-3 text-right ${activeTier === "BASE" ? (hasQuota ? "bg-amber-500/10" : "bg-emerald-500/10") : ""}`}
                            >
                              <div className="inline-flex items-center gap-1">
                                {activeTier === "BASE" && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      hasQuota
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {hasQuota ? "Fallback" : "Active"}
                                  </span>
                                )}
                                <span
                                  className={
                                    activeTier === "BASE"
                                      ? `font-bold ${hasQuota ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`
                                      : "font-semibold"
                                  }
                                >
                                  BASE
                                </span>
                              </div>
                              <div className="text-[10px] font-normal text-muted-foreground">
                                Min Top-Up: Rp 100k
                              </div>
                            </th>
                            <th
                              scope="col"
                              className={`px-4 py-3 text-right ${activeTier === "TIER_1" ? (hasQuota ? "bg-amber-500/10" : "bg-emerald-500/10") : ""}`}
                            >
                              <div className="inline-flex items-center gap-1">
                                {activeTier === "TIER_1" && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      hasQuota
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {hasQuota ? "Fallback" : "Active"}
                                  </span>
                                )}
                                <span
                                  className={
                                    activeTier === "TIER_1"
                                      ? `font-bold ${hasQuota ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`
                                      : "font-semibold"
                                  }
                                >
                                  TIER 1
                                </span>
                              </div>
                              <div className="text-[10px] font-normal text-muted-foreground">
                                Min Top-Up: Rp 10M
                              </div>
                            </th>
                            <th
                              scope="col"
                              className={`px-4 py-3 text-right ${activeTier === "TIER_2" ? (hasQuota ? "bg-amber-500/10" : "bg-emerald-500/10") : ""}`}
                            >
                              <div className="inline-flex items-center gap-1">
                                {activeTier === "TIER_2" && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      hasQuota
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {hasQuota ? "Fallback" : "Active"}
                                  </span>
                                )}
                                <span
                                  className={
                                    activeTier === "TIER_2"
                                      ? `font-bold ${hasQuota ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`
                                      : "font-semibold"
                                  }
                                >
                                  TIER 2
                                </span>
                              </div>
                              <div className="text-[10px] font-normal text-muted-foreground">
                                Min Top-Up: Rp 25M
                              </div>
                            </th>
                            <th
                              scope="col"
                              className={`px-4 py-3 text-right ${activeTier === "TIER_3" ? (hasQuota ? "bg-amber-500/10" : "bg-emerald-500/10") : ""}`}
                            >
                              <div className="inline-flex items-center gap-1">
                                {activeTier === "TIER_3" && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      hasQuota
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {hasQuota ? "Fallback" : "Active"}
                                  </span>
                                )}
                                <span
                                  className={
                                    activeTier === "TIER_3"
                                      ? `font-bold ${hasQuota ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`
                                      : "font-semibold"
                                  }
                                >
                                  TIER 3
                                </span>
                              </div>
                              <div className="text-[10px] font-normal text-muted-foreground">
                                Min Top-Up: Rp 50M
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {device.categories.map((cat) => {
                            const basePriceNum =
                              cat.category === "MARKETING"
                                ? 587
                                : cat.category === "UTILITY" ||
                                    cat.category === "AUTHENTICATION"
                                  ? 357
                                  : 300

                            const calcTierPrice = (feePct: number) => {
                              const fee = Math.ceil(
                                (basePriceNum * feePct) / 100
                              )
                              const ppn = Math.ceil((basePriceNum * 11) / 100)
                              return basePriceNum + fee + ppn
                            }

                            const pBase = calcTierPrice(20)
                            const pTier1 = calcTierPrice(15)
                            const pTier2 = calcTierPrice(10)
                            const pTier3 = calcTierPrice(5)

                            return (
                              <tr
                                key={cat.category}
                                className="hover:bg-muted/20"
                              >
                                <th
                                  scope="row"
                                  className="px-4 py-2.5 font-medium"
                                >
                                  {cat.category}
                                </th>
                                <td
                                  className={`px-4 py-2.5 text-center font-semibold ${
                                    hasQuota
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-muted-foreground line-through"
                                  }`}
                                >
                                  -{formatQuotaCredit(cat.quotaCredit)}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "BASE"
                                      ? "bg-muted/30 font-bold"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  Rp {pBase.toLocaleString("id-ID")}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "TIER_1"
                                      ? "bg-muted/30 font-bold"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  Rp {pTier1.toLocaleString("id-ID")}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "TIER_2"
                                      ? "bg-muted/30 font-bold"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  Rp {pTier2.toLocaleString("id-ID")}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "TIER_3"
                                      ? "bg-muted/30 font-bold"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  Rp {pTier3.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">
              Total Deducted Credits
            </CardDescription>
            <CardTitle className="text-xl font-bold">
              {ledgerSummary.totalCredits.toLocaleString()} Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              Total quota credits reserved/debited across all dispatches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">
              Refunded / Reverted
            </CardDescription>
            <CardTitle className="text-xl font-bold text-amber-500">
              {ledgerSummary.totalRefundedCredits.toLocaleString()} Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              Automatically refunded due to Meta delivery rejection
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">
              Net Billed Credits
            </CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-600">
              {ledgerSummary.activeCredits.toLocaleString()} Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              Confirmed delivered message quota
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Deduction & Refund Ledger */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Transaction & Deduction Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time record of all quota deductions, deliveries, and
                refunds.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ledger Filters */}
          <form
            onSubmit={handleSearch}
            className="flex flex-wrap items-center gap-3"
          >
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search phone or wamid..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="w-[140px]">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="PENDING">Pending Verify</SelectItem>
                  <SelectItem value="REFUNDED">Refunded / Reverted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  setCategoryFilter(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="MARKETING">MARKETING</SelectItem>
                  <SelectItem value="UTILITY">UTILITY</SelectItem>
                  <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                  <SelectItem value="SERVICE">SERVICE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Select
                value={ledgerSelectedDevice}
                onValueChange={(val) => {
                  setLedgerSelectedDevice(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {devices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {formatPhone(d.phoneNumber)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="h-9 gap-1.5 text-xs"
            >
              <Funnel className="size-3.5" />
              Apply Filter
            </Button>
          </form>
          {/* Ledger Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Recipient</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Source Type</TableHead>
                  <TableHead className="text-xs">Deduction</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">
                    Meta Message ID / Note
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-14" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!ledgerLoading && ledgerData.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-28 text-center text-xs text-muted-foreground"
                    >
                      <Receipt className="mx-auto mb-2 size-6 opacity-40" />
                      No deduction ledger entries found.
                    </TableCell>
                  </TableRow>
                )}
                {!ledgerLoading &&
                  ledgerData.map((row) => {
                    const isRefunded =
                      row.isReverted || row.status === "REVERTED_FAILED"
                    const isConfirmed = row.status === "CONFIRMED"
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <Phone className="size-3 text-muted-foreground" />
                            <span>{row.phoneNumber}</span>
                          </div>
                          {row.devicePhoneNumber && (
                            <span className="text-[10px] text-muted-foreground">
                              via {row.devicePhoneNumber}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] font-semibold"
                          >
                            {row.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-blue-500/10 px-1.5 py-0 text-[10px] text-blue-600 dark:text-blue-400"
                          >
                            QUOTA_ALLOWANCE
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold whitespace-nowrap">
                          {isRefunded ? (
                            <span className="text-muted-foreground line-through">
                              {row.quotaValue} credits
                            </span>
                          ) : (
                            <span>{row.quotaValue} credits</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isRefunded ? (
                            <Badge
                              variant="destructive"
                              className="gap-1 border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
                            >
                              <ArrowCounterClockwise className="size-2.5" />
                              REFUNDED
                            </Badge>
                          ) : isConfirmed ? (
                            <Badge
                              variant="default"
                              className="gap-1 bg-emerald-600 px-1.5 py-0 text-[10px] text-white"
                            >
                              <CheckCircle className="size-2.5" weight="fill" />
                              CONFIRMED
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="gap-1 px-1.5 py-0 text-[10px]"
                            >
                              <Clock className="size-2.5" />
                              PENDING
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate font-mono text-[11px] text-muted-foreground">
                            {row.waMessageId}
                          </div>
                          {row.revertReason && (
                            <div className="max-w-[200px] truncate text-[10px] text-amber-600 dark:text-amber-400">
                              {row.revertReason}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Showing page {page} of {totalPages} ({ledgerTotal} entries)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || ledgerLoading}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || ledgerLoading}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
