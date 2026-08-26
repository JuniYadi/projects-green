"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import type { CatalogPlan, CatalogProduct } from "@/lib/billing-client"

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

type PlanComparisonCardProps = {
  product: CatalogProduct
  className?: string
  onSelectPlan?: (plan: CatalogPlan) => void
}

export function PlanComparisonCard({
  product,
  className,
  onSelectPlan,
}: PlanComparisonCardProps) {
  const [selectedTerm, setSelectedTerm] = useState<BillingPeriod>(
    BILLING_PERIODS[0]
  )
  const [selectedPlan, setSelectedPlan] = useState<CatalogPlan | null>(null)

  const plansWithOffer = useMemo(
    () =>
      product.plans
        .map((plan) => ({
          plan,
          offer: plan.offers.find(
            (offer) => offer.billingPeriod === selectedTerm
          ),
        }))
        .filter((item) => item.offer !== undefined),
    [product.plans, selectedTerm]
  )

  const handleSelect = (plan: CatalogPlan) => {
    setSelectedPlan(plan)
    onSelectPlan?.(plan)
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{product.name}</CardTitle>
        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Term selector */}
        <div className="flex flex-wrap gap-2">
          {BILLING_PERIODS.map((term) => (
            <Button
              key={term}
              variant={selectedTerm === term ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTerm(term)}
              disabled={
                !plansWithOffer.some(
                  ({ plan }) =>
                    plan.offers.find(
                      (offer) => offer.billingPeriod === term
                    ) !== undefined
                )
              }
            >
              {TERM_LABELS[term]}
            </Button>
          ))}
        </div>

        {plansWithOffer.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {getMessages("en").console.billing.services.product.noPlansForTerm}
          </div>
        )}

        {plansWithOffer.length > 0 && (
          <div className="space-y-3">
            {plansWithOffer.map(({ plan, offer }) => {
              const isSelected = selectedPlan?.id === plan.id
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "border-2 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground"
                  )}
                >
                  <CardContent className="flex flex-col justify-between p-4 sm:flex-row sm:items-center">
                    <div className="space-y-2">
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      {Object.keys(plan.resources).length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {Object.entries(plan.resources).map(
                            ([name, value]) => (
                              <Badge key={name} variant="secondary">
                                {name}: {String(value)}
                              </Badge>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col items-end sm:mt-0">
                      {offer && (
                        <div className="text-2xl font-bold">
                          {formatPrice(offer.periodPrice, offer.currency)}
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleSelect(plan)}
                        className="mt-2"
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
