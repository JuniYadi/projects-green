"use client"

import { useState } from "react"

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
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch"
import {
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
} from "@/components/ui/phosphor-icons"
import type {
  ProductPlanEditorForm,
  ProductPlanOfferForm,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import {
  BILLING_PERIODS,
  type SupportedCurrency,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import { billingPeriodLabel } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

const CHARGE_UNIT_OPTIONS: {
  value: ProductPlanOfferForm["chargeUnit"]
  label: string
}[] = [
  { value: "SUBSCRIPTION", label: "Per subscription" },
  { value: "DEVICE", label: "Per device" },
]

function OfferTermMatrix({
  offer,
  currencies,
  onChange,
}: Readonly<{
  offer: ProductPlanOfferForm
  currencies: SupportedCurrency[]
  onChange: (next: Partial<ProductPlanOfferForm>) => void
}>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2">
        <Label className="text-xs">Billing period</Label>
        <Select
          value={offer.billingPeriod}
          onValueChange={(value) =>
            onChange({
              billingPeriod: value as ProductPlanOfferForm["billingPeriod"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BILLING_PERIODS.map((period) => (
              <SelectItem key={period} value={period}>
                {billingPeriodLabel(period)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Currency</Label>
        <Select
          value={offer.currency}
          onValueChange={(value) => onChange({ currency: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Charge unit</Label>
        <Select
          value={offer.chargeUnit}
          onValueChange={(value) =>
            onChange({
              chargeUnit: value as ProductPlanOfferForm["chargeUnit"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHARGE_UNIT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Price for period</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={offer.periodPrice}
          onChange={(e) => onChange({ periodPrice: e.target.value })}
        />
      </div>
    </div>
  )
}

function PlanOfferRow({
  offer,
  currencies,
  onUpdate,
  onRemove,
}: Readonly<{
  offer: ProductPlanOfferForm
  currencies: SupportedCurrency[]
  onUpdate: (next: Partial<ProductPlanOfferForm>) => void
  onRemove: () => void
}>) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <OfferTermMatrix
          offer={offer}
          currencies={currencies}
          onChange={onUpdate}
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Switch
            checked={offer.isActive}
            onCheckedChange={(checked) => onUpdate({ isActive: checked })}
          />
          <Label className="text-xs">Active</Label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label="Remove offer"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  currencies,
  onUpdate,
  onRemove,
}: Readonly<{
  plan: ProductPlanEditorForm
  currencies: SupportedCurrency[]
  onUpdate: (plan: ProductPlanEditorForm) => void
  onRemove: () => void
}>) {
  const [offerDialogOpen, setOfferDialogOpen] = useState(false)

  const addOffer = () => {
    const newOffer: ProductPlanOfferForm = {
      id: `new-offer-${crypto.randomUUID()}`,
      billingPeriod: "MONTHLY",
      periodPrice: "",
      currency: currencies[0] ?? "IDR",
      chargeUnit: "SUBSCRIPTION",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: "",
      isActive: true,
    }
    onUpdate({
      ...plan,
      offers: [...plan.offers, newOffer],
    })
  }

  const updateOffer = (index: number, next: Partial<ProductPlanOfferForm>) => {
    const offers = [...plan.offers]
    offers[index] = { ...offers[index], ...next }
    onUpdate({ ...plan, offers })
  }

  const removeOffer = (index: number) => {
    const offers = plan.offers.filter((_, i) => i !== index)
    onUpdate({ ...plan, offers })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{plan.name}</CardTitle>
            <CardDescription>
              Code: {plan.code} · {plan.offers.length} offer
              {plan.offers.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={plan.isActive}
              onCheckedChange={(checked) =>
                onUpdate({ ...plan, isActive: checked })
              }
            />
            <Label className="text-xs">Active</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label="Remove plan"
            >
              <TrashIcon className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pricing offers configured.
          </p>
        ) : (
          <div className="space-y-4">
            {plan.offers.map((offer, index) => (
              <div key={offer.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">
                    {billingPeriodLabel(offer.billingPeriod)} ·{" "}
                    {offer.chargeUnit === "DEVICE"
                      ? "per device"
                      : "per subscription"}
                  </p>
                  <p className="font-medium">
                    {offer.periodPrice
                      ? formatBillingMoney(offer.periodPrice, offer.currency)
                      : "—"}
                  </p>
                </div>
                <PlanOfferRow
                  offer={offer}
                  currencies={currencies}
                  onUpdate={(next) => updateOffer(index, next)}
                  onRemove={() => removeOffer(index)}
                />
              </div>
            ))}
          </div>
        )}

        <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addOffer}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add offer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Offer added</DialogTitle>
              <DialogDescription>
                A new offer has been added to this plan. Configure its pricing
                terms below.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOfferDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export function CatalogPlansTab({
  plans,
  currencies,
  onChange,
  showPreview,
}: Readonly<{
  plans: ProductPlanEditorForm[]
  currencies: SupportedCurrency[]
  onChange: (plans: ProductPlanEditorForm[]) => void
  showPreview?: boolean
}>) {
  const handleAddPlan = () => {
    const newPlan: ProductPlanEditorForm = {
      id: `new-plan-${crypto.randomUUID()}`,
      code: "",
      name: "",
      resources: {},
      isActive: true,
      offers: [],
    }
    onChange([...plans, newPlan])
  }

  const handleUpdatePlan = (plan: ProductPlanEditorForm) => {
    onChange(plans.map((p) => (p.id === plan.id ? plan : p)))
  }

  const handleRemovePlan = (id: string) => {
    onChange(plans.filter((p) => p.id !== id))
  }

  if (showPreview) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Preview mode: plans are displayed read-only.
        </p>
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {plan.name || plan.code}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {plan.offers.length} offer
                {plan.offers.length !== 1 ? "s" : ""} configured
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <PencilSimpleIcon className="h-10 w-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                No plans yet. Add a plan to start configuring pricing.
              </p>
            </div>
            <Button onClick={handleAddPlan}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={handleAddPlan}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add plan
            </Button>
          </div>
          <div className="space-y-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currencies={currencies}
                onUpdate={handleUpdatePlan}
                onRemove={() => handleRemovePlan(plan.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
