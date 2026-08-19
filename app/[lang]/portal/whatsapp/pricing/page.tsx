"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Plus } from "@phosphor-icons/react"
import { toast } from "sonner"
import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

const PRICING_QUERY_KEY = ["admin", "whatsapp", "pricing", "rates"] as const
const CATEGORIES = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
  "SERVICE",
] as const

type PricingCategory = (typeof CATEGORIES)[number]

type QuotaRateItem = {
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

type BasePriceItem = {
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

type PricingRatesResponse = {
  ok: boolean
  quotaRates: QuotaRateItem[]
  basePrices: BasePriceItem[]
}

type QuotaForm = {
  country: string
  category: PricingCategory
  quotaCredit: string
  effectiveFrom: string
  description: string
}

type BasePriceForm = {
  country: string
  category: PricingCategory
  basePrice: string
  metaCost: string
  currency: string
  effectiveFrom: string
}

const emptyQuotaForm: QuotaForm = {
  country: "",
  category: "MARKETING",
  quotaCredit: "",
  effectiveFrom: "",
  description: "",
}

const emptyBasePriceForm: BasePriceForm = {
  country: "",
  category: "MARKETING",
  basePrice: "",
  metaCost: "",
  currency: "IDR",
  effectiveFrom: "",
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function validateCountry(country: string) {
  if (!/^[A-Z]{2}$/.test(country.trim().toUpperCase())) {
    return "Country must be a two-letter ISO code"
  }
  return null
}

function validateAmount(value: string, label: string) {
  const amount = Number(value)
  if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
    return `${label} must be greater than zero`
  }
  return null
}

export default function PortalWhatsappPricingPage() {
  const queryClient = useQueryClient()
  const [countryFilter, setCountryFilter] = React.useState("all")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [quotaDialogOpen, setQuotaDialogOpen] = React.useState(false)
  const [basePriceDialogOpen, setBasePriceDialogOpen] = React.useState(false)
  const [quotaForm, setQuotaForm] = React.useState<QuotaForm>(emptyQuotaForm)
  const [basePriceForm, setBasePriceForm] =
    React.useState<BasePriceForm>(emptyBasePriceForm)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  )

  const {
    data: pricingData,
    isLoading,
    isError,
  } = useQuery<PricingRatesResponse>({
    queryKey: PRICING_QUERY_KEY,
    queryFn: async () => {
      const { data: response, error } =
        await eden.api.admin.whatsapp.pricing.rates.get()
      if (error || !response) {
        throw new Error("Failed to load WhatsApp pricing rates")
      }
      return response as unknown as PricingRatesResponse
    },
  })

  const quotaMutation = useMutation({
    mutationFn: async (payload: {
      category: PricingCategory
      country: string
      quotaCredit: number
      description?: string
      effectiveFrom: string
    }) => {
      const { data, error } =
        await eden.api.admin.whatsapp.pricing["quota-rate"].post(payload)
      if (
        error ||
        !data ||
        (typeof data === "object" && "ok" in data && data.ok === false)
      ) {
        throw new Error("Failed to save quota credit rate")
      }
      return data
    },
  })

  const basePriceMutation = useMutation({
    mutationFn: async (payload: {
      category: PricingCategory
      country: string
      basePrice: number
      metaCost?: number
      currency: string
      effectiveFrom: string
    }) => {
      const { data, error } =
        await eden.api.admin.whatsapp.pricing["base-price"].post(payload)
      if (
        error ||
        !data ||
        (typeof data === "object" && "ok" in data && data.ok === false)
      ) {
        throw new Error("Failed to save wholesale base price")
      }
      return data
    },
  })

  const quotaRates = pricingData?.quotaRates ?? []
  const basePrices = pricingData?.basePrices ?? []
  const countries = [
    ...new Set([...quotaRates, ...basePrices].map((rate) => rate.country)),
  ].sort()
  const matchesFilter = React.useCallback(
    (item: { country: string; category: string }) =>
      (countryFilter === "all" || item.country === countryFilter) &&
      (categoryFilter === "all" || item.category === categoryFilter),
    [categoryFilter, countryFilter]
  )
  const filteredQuotaRates = quotaRates.filter(matchesFilter)
  const filteredBasePrices = basePrices.filter(matchesFilter)

  const closeQuotaDialog = (open: boolean) => {
    setQuotaDialogOpen(open)
    if (!open) {
      setQuotaForm(emptyQuotaForm)
      setFormError(null)
    }
  }

  const closeBasePriceDialog = (open: boolean) => {
    setBasePriceDialogOpen(open)
    if (!open) {
      setBasePriceForm(emptyBasePriceForm)
      setFormError(null)
    }
  }

  const handleQuotaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    const country = quotaForm.country.trim().toUpperCase()
    const countryError = validateCountry(country)
    const amountError = validateAmount(
      quotaForm.quotaCredit,
      "Quota Credit deduction"
    )
    if (countryError || amountError || !quotaForm.effectiveFrom) {
      setFormError(countryError ?? amountError ?? "Effective From is required")
      return
    }

    try {
      await quotaMutation.mutateAsync({
        category: quotaForm.category,
        country,
        quotaCredit: Number(quotaForm.quotaCredit),
        description: quotaForm.description.trim(),
        effectiveFrom: quotaForm.effectiveFrom,
      })
      await queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY })
      setQuotaDialogOpen(false)
      setQuotaForm(emptyQuotaForm)
      setSuccessMessage("Quota credit rate saved successfully.")
      toast.success("Quota credit rate saved successfully.")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save quota credit rate"
      setFormError(message)
      toast.error(message)
    }
  }

  const handleBasePriceSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setFormError(null)
    const country = basePriceForm.country.trim().toUpperCase()
    const countryError = validateCountry(country)
    const amountError = validateAmount(basePriceForm.basePrice, "Base Price")
    const metaCostError = basePriceForm.metaCost
      ? validateAmount(basePriceForm.metaCost, "Meta Cost")
      : null
    if (
      countryError ||
      amountError ||
      metaCostError ||
      !basePriceForm.effectiveFrom
    ) {
      setFormError(
        countryError ??
          amountError ??
          metaCostError ??
          "Effective From is required"
      )
      return
    }

    try {
      await basePriceMutation.mutateAsync({
        category: basePriceForm.category,
        country,
        basePrice: Number(basePriceForm.basePrice),
        metaCost: basePriceForm.metaCost
          ? Number(basePriceForm.metaCost)
          : undefined,
        currency: basePriceForm.currency.trim() || "IDR",
        effectiveFrom: basePriceForm.effectiveFrom,
      })
      await queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY })
      setBasePriceDialogOpen(false)
      setBasePriceForm(emptyBasePriceForm)
      setSuccessMessage("Wholesale base price saved successfully.")
      toast.success("Wholesale base price saved successfully.")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save wholesale base price"
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            WhatsApp Pricing &amp; Quota Matrix
          </h1>
          <p className="text-sm text-muted-foreground">
            Temporal wholesale Base Prices and Quota Credit deductions per
            message category.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setSuccessMessage(null)
              setQuotaDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Quota Rate
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSuccessMessage(null)
              setBasePriceDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Base Price
          </Button>
        </div>
      </div>

      {successMessage && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">
          {successMessage}
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Failed to load WhatsApp pricing rates.
        </p>
      )}

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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Category Quota Deductions (Quota Mode)</CardTitle>
              <CardDescription>
                Credits deducted per message while device quota balance is
                positive.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger aria-label="Country">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger aria-label="Category">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
                  {filteredQuotaRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-muted/40">
                      <td className="py-2.5 font-medium">{rate.category}</td>
                      <td className="py-2.5">
                        <Badge variant="secondary">{rate.country}</Badge>
                      </td>
                      <td className="py-2.5 font-semibold text-primary">
                        -{rate.quotaCredit} credits
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDate(rate.effectiveFrom)}
                        {rate.effectiveTo
                          ? ` → ${formatDate(rate.effectiveTo)}`
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
              {filteredQuotaRates.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No quota rates match the selected filters.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <th className="pb-2 font-medium">Country</th>
                    <th className="pb-2 font-medium">Base Price</th>
                    <th className="pb-2 font-medium">BASE (20%)</th>
                    <th className="pb-2 font-medium">TIER 1 (15%)</th>
                    <th className="pb-2 font-medium">TIER 2 (10%)</th>
                    <th className="pb-2 font-medium">TIER 3 (5%)</th>
                    <th className="pb-2 font-medium">Effective From</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBasePrices.map((bp) => {
                    const base = Number(bp.basePrice)
                    const calc = (pct: number) =>
                      `Rp ${base + Math.ceil((base * pct) / 100) + Math.ceil((base * 11) / 100)}`
                    return (
                      <tr key={bp.id} className="hover:bg-muted/40">
                        <td className="py-2.5 font-medium">{bp.category}</td>
                        <td className="py-2.5">
                          <Badge variant="secondary">{bp.country}</Badge>
                        </td>
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
                          {formatDate(bp.effectiveFrom)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredBasePrices.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No base prices match the selected filters.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={quotaDialogOpen} onOpenChange={closeQuotaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Quota Rate</DialogTitle>
            <DialogDescription>
              Configure the quota credit deduction for a country and category.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleQuotaSubmit}>
            <div>
              <Label htmlFor="quota-country">Country</Label>
              <Input
                id="quota-country"
                value={quotaForm.country}
                onChange={(event) =>
                  setQuotaForm((form) => ({
                    ...form,
                    country: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="ID"
              />
            </div>
            <div>
              <Label htmlFor="quota-category">Category</Label>
              <Select
                value={quotaForm.category}
                onValueChange={(category) =>
                  setQuotaForm((form) => ({
                    ...form,
                    category: category as PricingCategory,
                  }))
                }
              >
                <SelectTrigger id="quota-category" aria-label="Quota category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quota-credit">Quota Credit deduction</Label>
              <Input
                id="quota-credit"
                type="number"
                min="0"
                step="any"
                value={quotaForm.quotaCredit}
                onChange={(event) =>
                  setQuotaForm((form) => ({
                    ...form,
                    quotaCredit: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="quota-effective-from">Effective From</Label>
              <Input
                id="quota-effective-from"
                type="date"
                value={quotaForm.effectiveFrom}
                onChange={(event) =>
                  setQuotaForm((form) => ({
                    ...form,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="quota-description">Description (optional)</Label>
              <Input
                id="quota-description"
                value={quotaForm.description}
                onChange={(event) =>
                  setQuotaForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            {formError && quotaDialogOpen && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeQuotaDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={quotaMutation.isPending}>
                {quotaMutation.isPending ? "Saving..." : "Save Quota Rate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={basePriceDialogOpen} onOpenChange={closeBasePriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Base Price</DialogTitle>
            <DialogDescription>
              Configure a PAYG wholesale base price for a country and category.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleBasePriceSubmit}>
            <div>
              <Label htmlFor="base-country">Country</Label>
              <Input
                id="base-country"
                value={basePriceForm.country}
                onChange={(event) =>
                  setBasePriceForm((form) => ({
                    ...form,
                    country: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="ID"
              />
            </div>
            <div>
              <Label htmlFor="base-category">Category</Label>
              <Select
                value={basePriceForm.category}
                onValueChange={(category) =>
                  setBasePriceForm((form) => ({
                    ...form,
                    category: category as PricingCategory,
                  }))
                }
              >
                <SelectTrigger
                  id="base-category"
                  aria-label="Base price category"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="base-price">Base Price</Label>
              <Input
                id="base-price"
                type="number"
                min="0"
                step="any"
                value={basePriceForm.basePrice}
                onChange={(event) =>
                  setBasePriceForm((form) => ({
                    ...form,
                    basePrice: event.target.value,
                  }))
                }
                placeholder="100"
              />
            </div>
            <div>
              <Label htmlFor="meta-cost">Meta Cost (optional)</Label>
              <Input
                id="meta-cost"
                type="number"
                min="0"
                step="any"
                value={basePriceForm.metaCost}
                onChange={(event) =>
                  setBasePriceForm((form) => ({
                    ...form,
                    metaCost: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={basePriceForm.currency}
                onChange={(event) =>
                  setBasePriceForm((form) => ({
                    ...form,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="base-effective-from">Effective From</Label>
              <Input
                id="base-effective-from"
                type="date"
                value={basePriceForm.effectiveFrom}
                onChange={(event) =>
                  setBasePriceForm((form) => ({
                    ...form,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </div>
            {formError && basePriceDialogOpen && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeBasePriceDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={basePriceMutation.isPending}>
                {basePriceMutation.isPending ? "Saving..." : "Save Base Price"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
