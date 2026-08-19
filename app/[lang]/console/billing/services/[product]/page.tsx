"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getCatalogProduct } from "@/lib/billing-client"
import type {
  CatalogOffer,
  CatalogPlan,
  CatalogProductDetailResponse,
} from "@/lib/billing-client"
import { cn } from "@/lib/utils"

const BILLING_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
] as const
type BillingPeriod = (typeof BILLING_PERIODS)[number]

const TERM_LABELS: Record<BillingPeriod, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
}

const CURRENCY_OPTIONS = [
  { code: "IDR", flag: "🇮🇩", label: "IDR" },
  { code: "USD", flag: "🇺🇸", label: "USD" },
] as const

function formatPrice(price: string, currency: string): string {
  const amount = Number.parseFloat(price)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

const PERIOD_ORDER: Record<BillingPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 2,
  SEMI_ANNUAL: 3,
  ANNUAL: 4,
}

type PlanOffer = {
  plan: CatalogPlan
  offer: CatalogOffer | undefined
}

export default function ProductDetailPage() {
  const params = useParams<{ lang?: string; product?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [selectedCurrency, setSelectedCurrency] = useState<string>("IDR")
  const [data, setData] = useState<CatalogProductDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const productCode = params?.product?.toUpperCase() ?? ""

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const result = await getCatalogProduct(productCode, selectedCurrency)
        setData(result)
      } catch {
        setError(messages.console.billing.services.errorDescription)
      } finally {
        setIsLoading(false)
      }
    }

    if (productCode) {
      void loadData()
    }
  }, [
    productCode,
    selectedCurrency,
    messages.console.billing.services.errorDescription,
  ])

  const productName = useMemo(() => {
    if (!data?.product) return productCode
    const known: Record<string, string> = {
      WHATSAPP: "WhatsApp",
      VPN: "VPN",
      APP_HOSTING: "App Hosting",
    }
    return known[data.product.code] ?? data.product.name
  }, [data, productCode])

  const plansWithOffer = useMemo<PlanOffer[]>(() => {
    if (!data?.product) return []
    return data.product.plans
      .map((plan) => {
        const sortedOffers = [...plan.offers].sort((a, b) => {
          const orderA = PERIOD_ORDER[a.billingPeriod as BillingPeriod] ?? 99
          const orderB = PERIOD_ORDER[b.billingPeriod as BillingPeriod] ?? 99
          if (orderA !== orderB) return orderA - orderB
          return (
            Number.parseFloat(a.periodPrice) - Number.parseFloat(b.periodPrice)
          )
        })
        return {
          plan,
          offer: sortedOffers[0],
        }
      })
      .filter((item) => item.offer !== undefined)
  }, [data])

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </header>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/console/billing/services">
            <ArrowLeftIcon className="mr-1 size-4" />
            {messages.console.billing.services.product.backToServices}
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              {messages.console.billing.services.product.heading.replace(
                "{product}",
                productName
              )}
            </h1>
            {data && (
              <p className="text-sm text-muted-foreground">
                {messages.console.billing.services.product.description.replace(
                  "{product}",
                  productName
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Select
              value={selectedCurrency}
              onValueChange={(val) => setSelectedCurrency(val)}
            >
              <SelectTrigger className="w-[120px] bg-background">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent align="end">
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="flex items-center gap-1.5">
                      <span>{c.flag}</span>
                      <span className="font-medium">{c.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {!error && data && (
        <>
          {/* Plan cards */}
          {plansWithOffer.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-sm font-medium">
                  {messages.console.billing.services.product.noPlansForTerm}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {plansWithOffer.map(({ plan, offer }) => {
                const checkoutUrl = offer
                  ? `/console/billing/checkout?pricingId=${encodeURIComponent(
                      offer.id
                    )}&product=${encodeURIComponent(
                      data.product.code
                    )}&plan=${encodeURIComponent(
                      plan.code
                    )}&billingPeriod=${encodeURIComponent(
                      offer.billingPeriod
                    )}&price=${encodeURIComponent(
                      offer.periodPrice
                    )}&currency=${encodeURIComponent(offer.currency)}`
                  : "#"

                return (
                  <Card
                    key={plan.id}
                    className="flex flex-col transition-shadow duration-200 hover:shadow-md"
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-4">
                      <div className="space-y-3">
                        {/* Resources */}
                        {Object.keys(plan.resources).length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                              {
                                messages.console.billing.services.product
                                  .resources
                              }
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(plan.resources)
                                .filter(
                                  ([name, value]) =>
                                    name !== "provisioningFields" &&
                                    typeof value !== "object" &&
                                    value !== null &&
                                    value !== undefined
                                )
                                .map(([name, value]) => (
                                  <Badge
                                    key={name}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {name}: {String(value)}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Charge unit */}
                        {offer && (
                          <p className="text-xs text-muted-foreground">
                            {offer.chargeUnit === "SUBSCRIPTION"
                              ? "Per subscription"
                              : "Per device"}
                          </p>
                        )}
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          {offer && (
                            <p className="text-2xl font-bold">
                              {formatPrice(offer.periodPrice, offer.currency)}
                            </p>
                          )}
                          {offer && (
                            <p className="text-xs text-muted-foreground">
                              /{" "}
                              {TERM_LABELS[
                                offer.billingPeriod as BillingPeriod
                              ].toLowerCase()}
                            </p>
                          )}
                        </div>
                        <Button asChild disabled={!offer}>
                          <Link
                            href={checkoutUrl}
                            className={cn(
                              !offer && "cursor-not-allowed opacity-50"
                            )}
                          >
                            {messages.console.billing.services.product.checkout}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </main>
  )
}
