"use client"
import {
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import {
  Phone,
  Warning,
  Info,
  Receipt,
  CheckCircle,
  Clock,
  ArrowCounterClockwise,
  MagnifyingGlass,
  Funnel,
  ArrowsClockwise,
  Sparkle,
  Calculator,
  Chats,
  ShieldCheck,
  Megaphone,
  BellRinging,
} from "@phosphor-icons/react"
import { Slider } from "@/components/ui/slider"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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
  const messages = getMessages(locale)
  const t = messages.console.whatsapp
  const tLocked = messages.console.whatsapp.onboarding.lockedFeatures.pricing
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
  const [activeTab, setActiveTab] = React.useState(
    searchParams.get("tab") || "pricing"
  )
  const [selectedTier, setSelectedTier] = React.useState<
    "BASE" | "TIER_1" | "TIER_2" | "TIER_3" | null
  >(null)
  const [marketingVolume, setMarketingVolume] = React.useState(2500)
  const [utilityVolume, setUtilityVolume] = React.useState(1000)
  const [authVolume, setAuthVolume] = React.useState(500)
  const onboarding = useWhatsAppOnboarding({ locale })

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
          featureTitle={tLocked.title}
          featureDescription={tLocked.description}
          unlockLevel={3}
          prerequisiteDescription={tLocked.prerequisite}
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel={tLocked.activeLabel}
          locale={locale}
        />
        <FlightHudWidget
          onboarding={onboarding}
          onSubscribeClick={() => setIsOrderOpen(true)}
          locale={locale}
        />
        <ServiceOrderDialog
          productCode="WHATSAPP"
          productTitle="WhatsApp"
          open={isOrderOpen}
          onOpenChange={setIsOrderOpen}
          lang={locale}
          messages={getMessages(locale).console.billing.serviceOrder}
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

  const isIndonesian = locale === "id"
  // Determine active rate tier: follow device rateTier if available, otherwise fallback to TIER_3 for unsubscribed simulator
  const firstDevice = devices[0]
  const isReferenceDevice =
    firstDevice?.deviceId === "reference" || devices.length === 0
  const deviceTier =
    (firstDevice?.rateTier as "BASE" | "TIER_1" | "TIER_2" | "TIER_3") || "BASE"
  const effectiveTier =
    selectedTier ?? (isReferenceDevice ? "TIER_3" : deviceTier)

  const marketingCat = firstDevice?.categories?.find(
    (c) => c.category === "MARKETING"
  )
  const utilityCat = firstDevice?.categories?.find(
    (c) => c.category === "UTILITY"
  )
  const authCat = firstDevice?.categories?.find(
    (c) => c.category === "AUTHENTICATION"
  )

  const marketingPrice = Number(
    marketingCat?.tierPrices?.[effectiveTier] ?? marketingCat?.overagePrice ?? 0
  )
  const utilityPrice = Number(
    utilityCat?.tierPrices?.[effectiveTier] ?? utilityCat?.overagePrice ?? 0
  )
  const authPrice = Number(
    authCat?.tierPrices?.[effectiveTier] ?? authCat?.overagePrice ?? 0
  )
  const totalMarketingCost = marketingVolume * marketingPrice
  const totalUtilityCost = utilityVolume * utilityPrice
  const totalAuthCost = authVolume * authPrice
  const grandTotalEstimate =
    totalMarketingCost + totalUtilityCost + totalAuthCost
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t?.pricing?.heading ?? "WhatsApp Pricing"}
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
            size="sm"
            variant="outline"
            onClick={() => setIsOrderOpen(true)}
            className="gap-1.5"
          >
            <Sparkle className="size-4" />
            {isIndonesian ? "Berlangganan Paket" : "Subscribe Plan"}
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="pricing" className="gap-1.5 text-xs">
            <Calculator className="size-3.5" />
            {isIndonesian ? "Kalkulator & Tarif" : "Pricing & Calculator"}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5 text-xs">
            <Clock className="size-3.5" />
            {isIndonesian ? "Riwayat Transaksi" : "Transaction History"}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PRICING ESTIMATOR & RATE CARD */}
        <TabsContent value="pricing" className="space-y-6">
          <Card className="border-primary/20 bg-linear-to-b from-card to-muted/20 shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Calculator className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {isIndonesian
                        ? "Kalkulator & Simulasi Biaya Pesan"
                        : "Interactive Message Cost Estimator"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {isIndonesian
                        ? "Simulasikan kebutuhan volume pesan untuk estimasi biaya transparan."
                        : "Simulate message volumes for transparent estimated costs."}
                    </CardDescription>
                  </div>
                </div>

                {/* Tier Selector Chips */}
                <div className="flex items-center gap-1.5 rounded-lg border bg-background p-1 text-xs">
                  <span className="px-2 text-[11px] font-medium text-muted-foreground">
                    Tier:
                  </span>
                  {(
                    [
                      { id: "BASE", label: "BASE" },
                      { id: "TIER_1", label: "TIER 1" },
                      { id: "TIER_2", label: "TIER 2" },
                      { id: "TIER_3", label: "TIER 3" },
                    ] as const
                  ).map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedTier === tier.id ||
                        (selectedTier === null && effectiveTier === tier.id)
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {tier.label}
                      {tier.id === "TIER_3" && (
                        <span className="ml-1 text-[10px] opacity-80">★</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isPricingLoading ? (
                <div className="space-y-4 py-2">
                  <div className="grid gap-6 md:grid-cols-3">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-lg" />
                  </div>
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Marketing Slider */}
                    <div className="space-y-3 rounded-lg border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Megaphone className="size-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-semibold">
                            {isIndonesian
                              ? "Pesan Marketing"
                              : "Marketing Broadcasts"}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-primary">
                          {marketingVolume.toLocaleString()} msg
                        </span>
                      </div>
                      <Slider
                        value={[marketingVolume]}
                        min={0}
                        max={50000}
                        step={500}
                        onValueChange={(val) => setMarketingVolume(val[0] ?? 0)}
                      />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground/90">
                        <span>
                          @Rp {marketingPrice.toLocaleString("id-ID")}/msg
                        </span>
                        <span className="font-medium text-foreground">
                          Rp {totalMarketingCost.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>

                    {/* Utility Slider */}
                    <div className="space-y-3 rounded-lg border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BellRinging className="size-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-semibold">
                            {isIndonesian
                              ? "Pesan Utility / Notifikasi"
                              : "Utility & Alerts"}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-primary">
                          {utilityVolume.toLocaleString()} msg
                        </span>
                      </div>
                      <Slider
                        value={[utilityVolume]}
                        min={0}
                        max={25000}
                        step={250}
                        onValueChange={(val) => setUtilityVolume(val[0] ?? 0)}
                      />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground/90">
                        <span>
                          @Rp {utilityPrice.toLocaleString("id-ID")}/msg
                        </span>
                        <span className="font-medium text-foreground">
                          Rp {totalUtilityCost.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>

                    {/* Auth / OTP Slider */}
                    <div className="space-y-3 rounded-lg border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-semibold">
                            {isIndonesian
                              ? "Autentikasi / OTP"
                              : "Auth & OTP Codes"}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-primary">
                          {authVolume.toLocaleString()} msg
                        </span>
                      </div>
                      <Slider
                        value={[authVolume]}
                        min={0}
                        max={10000}
                        step={100}
                        onValueChange={(val) => setAuthVolume(val[0] ?? 0)}
                      />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground/90">
                        <span>@Rp {authPrice.toLocaleString("id-ID")}/msg</span>
                        <span className="font-medium text-foreground">
                          Rp {totalAuthCost.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Banner & CTA */}
                  <div className="flex flex-col items-center justify-between gap-4 rounded-lg bg-muted/50 p-4 sm:flex-row">
                    <div className="flex items-center gap-3">
                      <Chats className="size-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {isIndonesian
                            ? `Total Estimasi Biaya Bulanan (${effectiveTier}):`
                            : `Total Estimated Monthly Cost (${effectiveTier}):`}
                        </p>
                        <p className="text-lg font-bold text-foreground">
                          Rp {grandTotalEstimate.toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            / {isIndonesian ? "bulan" : "month"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setIsOrderOpen(true)}
                      className="w-full sm:w-auto"
                    >
                      <Sparkle className="mr-1.5 size-4" />
                      {isIndonesian
                        ? "Pilih Paket WhatsApp Sekarang"
                        : "Choose WhatsApp Plan"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
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

            const quotaStatusLabel = allActive
              ? ""
              : isMixed
                ? isIndonesian
                  ? " (Tersisa Sebagian)"
                  : " (Partial)"
                : isIndonesian
                  ? " (Habis)"
                  : " (Exhausted)"

            const paygStatusLabel = noneActive
              ? isIndonesian
                ? " (Aktif)"
                : " (Active)"
              : isMixed
                ? isIndonesian
                  ? " (Otomatis Saat Kuota Habis)"
                  : " (Partial Fallback)"
                : isIndonesian
                  ? " (Otomatis Saat Kuota Habis)"
                  : " (Fallback)"

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
                            : "text-destructive line-through opacity-90"
                      }`}
                    >
                      {isIndonesian ? "Kredit Kuota Paket" : "Quota Credit"}
                      {quotaStatusLabel}
                    </span>
                    <WhatsAppText id="s96" />
                    <span
                      className={`font-semibold ${
                        noneActive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {isIndonesian
                        ? "Tarif Pemakaian Tambahan (PAYG)"
                        : "PAYG Overage"}
                      {paygStatusLabel}
                    </span>
                    <WhatsAppText id="s97" />
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Category Rates & Multi-Tier Comparison Table */}
          <Card>
            <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {isIndonesian
                    ? "Daftar Tarif Kategori & Perbandingan Tier"
                    : "WhatsApp Category Rates & Tier Comparison"}
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
                    aria-label={getWhatsAppText("s99", locale)}
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
                  <Warning
                    className="mb-2 size-6 text-destructive"
                    weight="fill"
                  />
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
                              {isIndonesian ? "Negara" : "Country"}:{" "}
                              {device.country}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {isIndonesian ? "Tingkat Tier:" : "Rate Tier:"}
                            </span>
                            <Badge
                              variant="secondary"
                              className="font-semibold"
                            >
                              {activeTier}
                            </Badge>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b bg-muted/20 text-left text-xs">
                                <th
                                  scope="col"
                                  className="px-4 py-3 font-semibold"
                                >
                                  {isIndonesian ? "Kategori" : "Category"}
                                </th>
                                <th
                                  scope="col"
                                  className="px-4 py-3 text-center"
                                >
                                  <span
                                    className={`font-semibold ${
                                      hasQuota
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-destructive line-through"
                                    }`}
                                  >
                                    {isIndonesian
                                      ? "Biaya Kuota"
                                      : "Credit Cost"}
                                  </span>
                                  <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                                    {isIndonesian
                                      ? "Jatah Kuota Paket"
                                      : "In-Quota Allowance"}
                                  </div>
                                </th>
                                <th
                                  scope="col"
                                  className="px-4 py-3 text-right"
                                >
                                  <span
                                    className={
                                      activeTier === "BASE"
                                        ? hasQuota
                                          ? "font-bold text-amber-600 dark:text-amber-400"
                                          : "font-bold text-emerald-600 dark:text-emerald-400"
                                        : "font-semibold text-muted-foreground"
                                    }
                                  >
                                    BASE{" "}
                                    {activeTier === "BASE" && !isReferenceDevice
                                      ? isIndonesian
                                        ? "(Aktif Saat Ini)"
                                        : "(Active)"
                                      : ""}
                                  </span>
                                </th>
                                <th
                                  scope="col"
                                  className="px-4 py-3 text-right"
                                >
                                  <span
                                    className={
                                      activeTier === "TIER_1"
                                        ? hasQuota
                                          ? "font-bold text-amber-600 dark:text-amber-400"
                                          : "font-bold text-emerald-600 dark:text-emerald-400"
                                        : "font-semibold text-muted-foreground"
                                    }
                                  >
                                    TIER 1{" "}
                                    {activeTier === "TIER_1" &&
                                    !isReferenceDevice
                                      ? isIndonesian
                                        ? "(Aktif Saat Ini)"
                                        : "(Active)"
                                      : ""}
                                  </span>
                                </th>
                                <th
                                  scope="col"
                                  className="px-4 py-3 text-right"
                                >
                                  <span
                                    className={
                                      activeTier === "TIER_2"
                                        ? hasQuota
                                          ? "font-bold text-amber-600 dark:text-amber-400"
                                          : "font-bold text-emerald-600 dark:text-emerald-400"
                                        : "font-semibold text-muted-foreground"
                                    }
                                  >
                                    TIER 2{" "}
                                    {activeTier === "TIER_2" &&
                                    !isReferenceDevice
                                      ? isIndonesian
                                        ? "(Aktif Saat Ini)"
                                        : "(Active)"
                                      : ""}
                                  </span>
                                </th>
                                <th
                                  scope="col"
                                  className="px-4 py-3 text-right"
                                >
                                  <span
                                    className={
                                      activeTier === "TIER_3" ||
                                      (isReferenceDevice &&
                                        effectiveTier === "TIER_3")
                                        ? hasQuota
                                          ? "font-bold text-amber-600 dark:text-amber-400"
                                          : "font-bold text-emerald-600 dark:text-emerald-400"
                                        : "font-semibold text-muted-foreground"
                                    }
                                  >
                                    TIER 3{" "}
                                    {activeTier === "TIER_3" &&
                                    !isReferenceDevice
                                      ? isIndonesian
                                        ? "(Aktif Saat Ini)"
                                        : "(Active)"
                                      : isReferenceDevice
                                        ? isIndonesian
                                          ? "(Harga Promo)"
                                          : "(Promo)"
                                        : ""}
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
                                  let loc = "en-US"
                                  if (currencyCode === "IDR") loc = "id-ID"
                                  else if (currencyCode === "EUR") loc = "de-DE"
                                  else if (currencyCode === "GBP") loc = "en-GB"
                                  else if (currencyCode === "JPY") loc = "ja-JP"
                                  else if (currencyCode === "AUD") loc = "en-AU"
                                  else if (currencyCode === "SGD") loc = "en-SG"
                                  else if (currencyCode === "MYR") loc = "ms-MY"
                                  try {
                                    return new Intl.NumberFormat(loc, {
                                      style: "currency",
                                      currency: currencyCode,
                                      minimumFractionDigits: minFractionDigits,
                                      maximumFractionDigits,
                                    }).format(num)
                                  } catch {
                                    return `${currencyCode} ${num.toFixed(2)}`
                                  }
                                }

                                const pBase = formatPrice(
                                  cat.tierPrices?.BASE,
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
                                    className="hover:bg-muted/30"
                                  >
                                    <td className="px-4 py-2.5 font-medium">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px]"
                                      >
                                        {cat.category}
                                      </Badge>
                                    </td>
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
                                        activeTier === "TIER_3" ||
                                        (isReferenceDevice &&
                                          effectiveTier === "TIER_3")
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
        </TabsContent>

        {/* TAB 3: AUDIT LEDGER */}
        <TabsContent value="ledger" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">
                  <WhatsAppText id="s105" />
                </CardDescription>
                <CardTitle className="text-xl font-bold">
                  {ledgerSummary.totalCredits.toLocaleString()}{" "}
                  {isIndonesian ? "Kredit" : "Credits"}
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
                  {isIndonesian ? "Kredit Dikembalikan" : "Refunded / Reverted"}
                </CardDescription>
                <CardTitle className="text-xl font-bold text-amber-500">
                  {ledgerSummary.totalRefundedCredits.toLocaleString()}{" "}
                  {isIndonesian ? "Kredit" : "Credits"}
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
                  {isIndonesian
                    ? "Total Pemakaian Bersih"
                    : "Net Billed Credits"}
                </CardDescription>
                <CardTitle className="text-xl font-bold text-emerald-600">
                  {ledgerSummary.activeCredits.toLocaleString()}{" "}
                  {isIndonesian ? "Kredit" : "Credits"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground">
                  <WhatsAppText id="s108" />
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Deduction & Refund Ledger */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {isIndonesian
                      ? "Riwayat Pemotongan & Pengembalian Kuota"
                      : "Transaction & Deduction Ledger"}
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
                    placeholder={getWhatsAppText("s110", locale)}
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
                      <SelectValue
                        placeholder={getWhatsAppText("s302", locale)}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <WhatsAppText id="s111" />
                      </SelectItem>
                      <SelectItem value="CONFIRMED">
                        {isIndonesian ? "Berhasil Dipotong" : "Confirmed"}
                      </SelectItem>
                      <SelectItem value="PENDING">
                        {isIndonesian
                          ? "Menunggu Verifikasi"
                          : "Pending Verify"}
                      </SelectItem>
                      <SelectItem value="REFUNDED">
                        {isIndonesian
                          ? "Dibatalkan / Dikembalikan"
                          : "Refunded / Reverted"}
                      </SelectItem>
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
                      <SelectValue
                        placeholder={isIndonesian ? "Kategori" : "Category"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <WhatsAppText id="s112" />
                      </SelectItem>
                      <SelectItem value="MARKETING">MARKETING</SelectItem>
                      <SelectItem value="UTILITY">UTILITY</SelectItem>
                      <SelectItem value="AUTHENTICATION">
                        AUTHENTICATION
                      </SelectItem>
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
                      <SelectValue
                        placeholder={getWhatsAppText("s113", locale)}
                      />
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
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                >
                  <Funnel className="mr-1 size-3.5" />
                  <WhatsAppText id="s114" />
                </Button>
              </form>

              {/* Ledger Table */}
              {ledgerLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : ledgerData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Receipt className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-xs font-medium">
                    <WhatsAppText id="s115" />
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {searchQuery ||
                    statusFilter !== "all" ||
                    categoryFilter !== "all"
                      ? getWhatsAppText("s116", locale)
                      : getWhatsAppText("s117", locale)}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">
                          {isIndonesian ? "Waktu" : "Time"}
                        </TableHead>
                        <TableHead>
                          {isIndonesian ? "Nomor Tujuan" : "Recipient"}
                        </TableHead>
                        <TableHead>
                          {isIndonesian ? "Perangkat" : "Device"}
                        </TableHead>
                        <TableHead>
                          {isIndonesian ? "Kategori Pesan" : "Category"}
                        </TableHead>
                        <TableHead>
                          {isIndonesian ? "Status" : "Status"}
                        </TableHead>
                        <TableHead className="text-right">
                          {isIndonesian ? "Pemotongan Kredit" : "Credits"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerData.map((row) => (
                        <TableRow
                          key={row.id}
                          className={
                            row.isReverted
                              ? "bg-destructive/5 text-muted-foreground line-through"
                              : ""
                          }
                        >
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {formatDate(row.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] font-medium">
                            {formatPhone(row.phoneNumber)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5 font-mono text-[11px]">
                              {row.deviceName && (
                                <p className="font-sans font-medium text-foreground">
                                  {row.deviceName}
                                </p>
                              )}
                              <p className="text-muted-foreground">
                                {row.devicePhoneNumber
                                  ? formatPhone(row.devicePhoneNumber)
                                  : "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {row.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.isReverted ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                                title={row.revertReason || "Refunded"}
                              >
                                <ArrowCounterClockwise className="mr-1 size-3" />
                                {isIndonesian ? "Dikembalikan" : "Refunded"}
                              </Badge>
                            ) : row.status === "CONFIRMED" ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                              >
                                <CheckCircle className="mr-1 size-3" />
                                {isIndonesian ? "Terkonfirmasi" : "Confirmed"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                <Clock className="mr-1 size-3" />
                                {isIndonesian ? "Menunggu" : "Pending"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-[11px] font-semibold ${
                              row.isReverted
                                ? "text-amber-500"
                                : "text-emerald-600"
                            }`}
                          >
                            {row.isReverted ? "+" : "-"}
                            {row.quotaValue}{" "}
                            {isIndonesian ? "kredit" : "credits"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    {isIndonesian ? "Halaman " : "Page "}
                    <span className="font-medium text-foreground">{page}</span>
                    {isIndonesian ? " dari " : " of "}
                    <span className="font-medium text-foreground">
                      {totalPages}
                    </span>{" "}
                    ({ledgerTotal}{" "}
                    {isIndonesian ? "total transaksi" : "entries"})
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || ledgerLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="text-xs"
                    >
                      <WhatsAppText id="s304" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || ledgerLoading}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="text-xs"
                    >
                      <WhatsAppText id="s305" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Service Order Dialog */}
      <ServiceOrderDialog
        productCode="WHATSAPP"
        productTitle="WhatsApp"
        open={isOrderOpen}
        onOpenChange={setIsOrderOpen}
        lang={locale}
        messages={getMessages(locale).console.billing.serviceOrder}
        onSuccess={() => {}}
      />
    </div>
  )
}
