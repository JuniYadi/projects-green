"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle } from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface QuotaRateItem {
  id: string
  category: string
  country: string
  quotaCredit: string
  description: string | null
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
  createdAt: string
}

interface BasePriceItem {
  id: string
  category: string
  country: string
  basePrice: string
  metaCost: string | null
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
  createdAt: string
}

interface PricingRatesResponse {
  ok: boolean
  quotaRates: QuotaRateItem[]
  basePrices: BasePriceItem[]
}

export default function PortalWhatsappPricingPage() {
  const { data: pricingData, isLoading } = useQuery<PricingRatesResponse>({
    queryKey: ["admin", "whatsapp", "pricing", "rates"],
    queryFn: async () => {
      const { data: response, error } =
        await eden.api.admin.whatsapp.pricing.rates.get()
      if (error || !response) {
        throw new Error("Failed to load WhatsApp pricing rates")
      }
      return response as unknown as PricingRatesResponse
    },
  })

  const basePrices = pricingData?.basePrices ?? []
  const quotaRates = pricingData?.quotaRates ?? []

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          WhatsApp Pricing &amp; Quota Matrix
        </h1>
        <p className="text-sm text-muted-foreground">
          Temporal wholesale Base Prices and Quota Credit deductions per message
          category.
        </p>
      </div>

      {/* Overview Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Base Allowance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,000 credits</div>
            <p className="text-xs text-muted-foreground">
              Monthly allocation per active device, resets on 1st of every
              month.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Tax &amp; Margins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">11% PPN</div>
            <p className="text-xs text-muted-foreground">
              BASE: +20% · T1: +15% · T2: +10% · T3: +5% margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rate Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle className="size-4" /> Zero-Margin Protected
            </div>
            <p className="text-xs text-muted-foreground">
              Quarterly price increases apply seamlessly via effective date
              ranges.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quota Deduction Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Category Quota Deductions (Quota Mode)</CardTitle>
          <CardDescription>
            Credits deducted per message while device quota balance is positive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Country</th>
                    <th className="pb-2 font-medium">Quota Deduction</th>
                    <th className="pb-2 font-medium">Effective Range</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quotaRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-muted/40">
                      <td className="py-2.5 font-medium">{rate.category}</td>
                      <td className="py-2.5">{rate.country}</td>
                      <td className="py-2.5 font-semibold text-primary">
                        -{rate.quotaCredit} credits
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {new Date(rate.effectiveFrom).toLocaleDateString()}
                        {rate.effectiveTo
                          ? ` → ${new Date(rate.effectiveTo).toLocaleDateString()}`
                          : " → Present"}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={rate.isActive ? "default" : "secondary"}
                        >
                          {rate.isActive ? "Active" : "Archived"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wholesale Base Prices & Calculated Overage */}
      <Card>
        <CardHeader>
          <CardTitle>PAYG Base Prices &amp; Tier Matrix</CardTitle>
          <CardDescription>
            Wholesale base prices and calculated customer overage costs once
            quota is exhausted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Base Price</th>
                    <th className="pb-2 font-medium">BASE (20%)</th>
                    <th className="pb-2 font-medium">TIER 1 (15%)</th>
                    <th className="pb-2 font-medium">TIER 2 (10%)</th>
                    <th className="pb-2 font-medium">TIER 3 (5%)</th>
                    <th className="pb-2 font-medium">Effective From</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {basePrices.map((bp) => {
                    const base = Number(bp.basePrice)
                    const calc = (pct: number) => {
                      const fee = Math.ceil((base * pct) / 100)
                      const ppn = Math.ceil((base * 11) / 100)
                      return `Rp ${base + fee + ppn}`
                    }
                    return (
                      <tr key={bp.id} className="hover:bg-muted/40">
                        <td className="py-2.5 font-medium">{bp.category}</td>
                        <td className="py-2.5 font-mono text-muted-foreground">
                          Rp {base}
                        </td>
                        <td className="py-2.5 font-semibold text-foreground">
                          {calc(20)}
                        </td>
                        <td className="py-2.5 font-semibold text-foreground">
                          {calc(15)}
                        </td>
                        <td className="py-2.5 font-semibold text-foreground">
                          {calc(10)}
                        </td>
                        <td className="py-2.5 font-semibold text-primary">
                          {calc(5)}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {new Date(bp.effectiveFrom).toLocaleDateString()}
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
    </div>
  )
}
