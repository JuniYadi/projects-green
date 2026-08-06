"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react"

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

function formatPrice(price: string, currency: string): string {
  const amount = Number.parseFloat(price)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

type PlanOffer = {
  plan: CatalogPlan
  offer: CatalogOffer | undefined
}

export default function ProductDetailPage() {
  const params = useParams<{ lang?: string; product?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [data, setData] = useState<CatalogProductDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTerm, setSelectedTerm] = useState<BillingPeriod>(
    BILLING_PERIODS[0]
  )

  const productCode = params?.product?.toUpperCase() ?? ""

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getCatalogProduct(productCode)
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
  }, [productCode, messages.console.billing.services.errorDescription])

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
      .map((plan) => ({
        plan,
        offer: plan.offers.find((o) => o.billingPeriod === selectedTerm),
      }))
      .filter((item) => item.offer !== undefined)
  }, [data, selectedTerm])

  const availableTerms = useMemo<BillingPeriod[]>(() => {
    if (!data?.product) return []
    const terms = new Set<BillingPeriod>()
    for (const plan of data.product.plans) {
      for (const offer of plan.offers) {
        if (
          offer.billingPeriod === "MONTHLY" ||
          offer.billingPeriod === "QUARTERLY" ||
          offer.billingPeriod === "SEMI_ANNUAL" ||
          offer.billingPeriod === "ANNUAL"
        ) {
          terms.add(offer.billingPeriod as BillingPeriod)
        }
      }
    }
    return BILLING_PERIODS.filter((t) => terms.has(t))
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
      <header className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/console/billing/services">
            <ArrowLeftIcon className="mr-1 size-4" />
            {messages.console.billing.services.product.backToServices}
          </Link>
        </Button>
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
        {data && (
          <p className="text-xs font-medium text-muted-foreground">
            {data.currency}
          </p>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {!error && data && (
        <>
          {/* Term selector */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {messages.console.billing.services.product.selectTerm}
            </p>
            <div className="flex flex-wrap gap-2" role="group">
              {BILLING_PERIODS.map((term) => {
                const hasTerm = availableTerms.includes(term)
                return (
                  <Button
                    key={term}
                    variant={selectedTerm === term ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTerm(term)}
                    disabled={!hasTerm}
                    aria-pressed={selectedTerm === term}
                    aria-disabled={!hasTerm}
                  >
                    {TERM_LABELS[term]}
                  </Button>
                )
              })}
            </div>
            {!availableTerms.includes(selectedTerm) && (
              <p className="text-xs text-muted-foreground">
                {messages.console.billing.services.product.unavailableTerm}
              </p>
            )}
          </div>

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
                              {Object.entries(plan.resources).map(
                                ([name, value]) => (
                                  <Badge
                                    key={name}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {name}: {String(value)}
                                  </Badge>
                                )
                              )}
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
