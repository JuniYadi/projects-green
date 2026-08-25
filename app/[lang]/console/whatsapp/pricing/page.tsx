"use client"
import {
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

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
  Sparkle,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ServiceOrderDialog } from "@/components/billing/service-order-dialog"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { LockedFeatureTeaser } from "@/modules/whatsapp/onboarding/locked-feature-teaser"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
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
    if (!Number.isFinite(d.getTime())) return String(iso)
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
  const [isOrderOpen, setIsOrderOpen] = React.useState(false)
  const onboarding = useWhatsAppOnboarding()

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
  if (onboarding.isFeatureLocked("pricing_ledger")) {
    return (
      <>
        <LockedFeatureTeaser
          featureTitle="Pricing, Quotas & Ledger"
          featureDescription="Granular conversation costing breakdown, balance deductions, top-ups, and transaction audit ledger."
          unlockLevel={3}
          prerequisiteDescription="Send your first message and approve a template to unlock granular ledger billing."
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel="Complete Active Mission"
        />
        <FlightHudWidget
          onboarding={onboarding}
          onSubscribeClick={() => setIsOrderOpen(true)}
        />
        <ServiceOrderDialog
          productCode="WHATSAPP"
          productTitle="WhatsApp Gateway"
          open={isOrderOpen}
          onOpenChange={setIsOrderOpen}
          onSuccess={() => {}}
        />
      </>
    )
  }

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
            {t?.pricing?.heading ?? "WhatsApp Pricing"} & Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            <WhatsAppText id="s93" />
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
            <WhatsAppText id="s94" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOrderOpen(true)}
          >
            <Sparkle className="mr-1.5 size-4 text-primary" />
            Subscribe WhatsApp Plan
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={localizePathname({
                pathname: "/console/whatsapp/usage",
                locale,
              })}
            >
              {t?.usage?.heading ?? "Usage"}
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
              {t?.messages?.sendMessage ?? "Send Message"}
            </Link>
          </Button>
        </div>
      </div>

      {/* Dynamic Status Alert Banner */}
      {(() => {
        const targetDevices =
          selectedDeviceId === "all"
            ? devices
            : devices.filter((d) => d.deviceId === selectedDeviceId)

        if (targetDevices.length === 0) return null

        const allActive =
          targetDevices.length > 0 &&
          targetDevices.every((d) => (d.quotaRemaining ?? 0) > 0)
        const noneActive =
          targetDevices.length > 0 &&
          targetDevices.every((d) => (d.quotaRemaining ?? 0) <= 0)
        const isMixed = !allActive && !noneActive

        return (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Info className="size-4 shrink-0 text-primary" />
              <span>
                <WhatsAppText id="s95" />
                <span
                  className={`font-semibold ${
                    allActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isMixed
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-destructive line-through"
                  }`}
                >
                  Quota Credit{" "}
                  {allActive ? "" : isMixed ? "(Partial)" : "(Exhausted)"}
                </span>
                <WhatsAppText id="s96" />
                <span
                  className={`font-semibold ${
                    noneActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isMixed
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  PAYG Overage{" "}
                  {noneActive
                    ? "(Active)"
                    : isMixed
                      ? "(Partial Fallback)"
                      : "(Fallback)"}
                </span>
                <WhatsAppText id="s97" />
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
        )
      })()}

      {/* Category Rates & Multi-Tier Comparison Table */}
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              WhatsApp Category Rates & Tier Comparison
            </CardTitle>
            <CardDescription className="text-xs">
              <WhatsAppText id="s98" />
            </CardDescription>
          </div>
          {devices.length > 1 && (
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 text-muted-foreground" />
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="rounded-md border bg-background px-2.5 py-1 text-xs"
                aria-label={getWhatsAppText("s99")}
              >
                <option value="all">
                  <WhatsAppText id="s100" />
                  {devices.length})
                </option>
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
                <WhatsAppText id="s101" />
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <WhatsAppText id="s102" />
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
                          <WhatsAppText id="s103" /> {device.phoneNumber}
                        </caption>
                        <thead className="border-b bg-muted/20 text-muted-foreground">
                          <tr>
                            <th scope="col" className="px-4 py-3 font-semibold">
                              Category
                            </th>
                            <th scope="col" className="px-4 py-3 text-center">
                              <span
                                className={`font-semibold ${
                                  hasQuota
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive line-through"
                                }`}
                              >
                                Quota Credit
                              </span>
                              <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                                <WhatsAppText id="s104" />
                              </div>
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                              <span
                                className={
                                  activeTier === "BASE"
                                    ? hasQuota
                                      ? "font-bold text-amber-600 dark:text-amber-400"
                                      : "font-bold text-emerald-600 dark:text-emerald-400"
                                    : "font-semibold text-muted-foreground"
                                }
                              >
                                BASE
                              </span>
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                              <span
                                className={
                                  activeTier === "TIER_1"
                                    ? hasQuota
                                      ? "font-bold text-amber-600 dark:text-amber-400"
                                      : "font-bold text-emerald-600 dark:text-emerald-400"
                                    : "font-semibold text-muted-foreground"
                                }
                              >
                                TIER 1
                              </span>
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                              <span
                                className={
                                  activeTier === "TIER_2"
                                    ? hasQuota
                                      ? "font-bold text-amber-600 dark:text-amber-400"
                                      : "font-bold text-emerald-600 dark:text-emerald-400"
                                    : "font-semibold text-muted-foreground"
                                }
                              >
                                TIER 2
                              </span>
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                              <span
                                className={
                                  activeTier === "TIER_3"
                                    ? hasQuota
                                      ? "font-bold text-amber-600 dark:text-amber-400"
                                      : "font-bold text-emerald-600 dark:text-emerald-400"
                                    : "font-semibold text-muted-foreground"
                                }
                              >
                                TIER 3
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {device.categories.map((cat) => {
                            const formatPrice = (
                              val: string | null | undefined,
                              curr: string | null | undefined
                            ) => {
                              if (!val) return "—"
                              const num = Number(val)
                              if (!Number.isFinite(num)) return "—"
                              const currencyCode =
                                curr && curr.trim()
                                  ? curr.trim().toUpperCase()
                                  : "IDR"
                              const parts = val.split(".")
                              const valueDecimals =
                                parts.length > 1 ? parts[1].length : 0
                              const isZeroDecimalDefault =
                                currencyCode === "IDR" ||
                                currencyCode === "JPY" ||
                                currencyCode === "KRW"
                              const minFractionDigits = isZeroDecimalDefault
                                ? valueDecimals > 0
                                  ? Math.min(valueDecimals, 4)
                                  : 0
                                : Math.max(2, Math.min(valueDecimals, 4))
                              const maximumFractionDigits = Math.max(
                                minFractionDigits,
                                Math.min(valueDecimals, 4)
                              )
                              let locale = "en-US"
                              if (currencyCode === "IDR") locale = "id-ID"
                              else if (currencyCode === "EUR") locale = "de-DE"
                              else if (currencyCode === "GBP") locale = "en-GB"
                              else if (currencyCode === "JPY") locale = "ja-JP"
                              else if (currencyCode === "AUD") locale = "en-AU"
                              else if (currencyCode === "SGD") locale = "en-SG"
                              else if (currencyCode === "MYR") locale = "ms-MY"
                              try {
                                return new Intl.NumberFormat(locale, {
                                  style: "currency",
                                  currency: currencyCode,
                                  minimumFractionDigits: minFractionDigits,
                                  maximumFractionDigits: maximumFractionDigits,
                                }).format(num)
                              } catch {
                                return `${currencyCode} ${num}`
                              }
                            }

                            const pBase = formatPrice(
                              cat.tierPrices?.BASE ?? cat.overagePrice,
                              cat.currency
                            )
                            const pTier1 = formatPrice(
                              cat.tierPrices?.TIER_1,
                              cat.currency
                            )
                            const pTier2 = formatPrice(
                              cat.tierPrices?.TIER_2,
                              cat.currency
                            )
                            const pTier3 = formatPrice(
                              cat.tierPrices?.TIER_3,
                              cat.currency
                            )
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
                                      : "text-destructive line-through"
                                  }`}
                                >
                                  -{formatQuotaCredit(cat.quotaCredit)}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "BASE"
                                      ? hasQuota
                                        ? "font-bold text-amber-600 dark:text-amber-400"
                                        : "font-bold text-emerald-600 dark:text-emerald-400"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {pBase}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "TIER_1"
                                      ? hasQuota
                                        ? "font-bold text-amber-600 dark:text-amber-400"
                                        : "font-bold text-emerald-600 dark:text-emerald-400"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {pTier1}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "TIER_2"
                                      ? hasQuota
                                        ? "font-bold text-amber-600 dark:text-amber-400"
                                        : "font-bold text-emerald-600 dark:text-emerald-400"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {pTier2}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right ${
                                    activeTier === "TIER_3"
                                      ? hasQuota
                                        ? "font-bold text-amber-600 dark:text-amber-400"
                                        : "font-bold text-emerald-600 dark:text-emerald-400"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {pTier3}
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
              <WhatsAppText id="s105" />
            </CardDescription>
            <CardTitle className="text-xl font-bold">
              {ledgerSummary.totalCredits.toLocaleString()} Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              <WhatsAppText id="s106" />
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
              <WhatsAppText id="s107" />
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
              <WhatsAppText id="s108" />
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
                <WhatsAppText id="s109" />
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
                placeholder={getWhatsAppText("s110")}
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
                  <SelectItem value="all">
                    <WhatsAppText id="s111" />
                  </SelectItem>
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
                  <SelectItem value="all">
                    <WhatsAppText id="s112" />
                  </SelectItem>
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
                  <SelectValue placeholder={getWhatsAppText("s113")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <WhatsAppText id="s47" />
                  </SelectItem>
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
              <WhatsAppText id="s114" />
            </Button>
          </form>
          {/* Ledger Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">
                    <WhatsAppText id="s115" />
                  </TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Source Type</TableHead>
                  <TableHead className="text-xs">Deduction</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">
                    <WhatsAppText id="s116" />
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
                      <WhatsAppText id="s117" />
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
                <WhatsAppText id="s118" />
                {page} <WhatsAppText id="s14" />
                {totalPages} ({ledgerTotal} entries)
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

      <ServiceOrderDialog
        productCode="WHATSAPP"
        productTitle="WhatsApp Gateway"
        open={isOrderOpen}
        onOpenChange={setIsOrderOpen}
        onSuccess={() => {
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
