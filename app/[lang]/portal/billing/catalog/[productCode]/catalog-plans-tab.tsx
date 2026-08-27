"use client"

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PlusIcon, TrashIcon } from "@/components/ui/phosphor-icons"
import type {
  BillingPeriod,
  ProductPlanEditorForm,
  ProductPlanOfferForm,
  SupportedCurrency,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import {
  BILLING_PERIODS,
  validateProductPlanIdentities,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import type { ProductPlanIdentityErrors } from "@/components/billing/admin/catalog/catalog-editor.types"
import { billingPeriodLabel } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import {
  getProvisionAdapter,
  type ProductProvisionAdapter,
} from "@/modules/billing/provisioning"
import type { ServiceType } from "@prisma/client"

const newOffer = (
  currency: SupportedCurrency,
  billingPeriod: BillingPeriod
): ProductPlanOfferForm => ({
  id: `new-offer-${crypto.randomUUID()}`,
  billingPeriod,
  periodPrice: "",
  currency,
  chargeUnit: "SUBSCRIPTION",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  isActive: true,
})

function newPlanCode(plans: ProductPlanEditorForm[]) {
  const usedCodes = new Set(plans.map((plan) => plan.code.trim()))
  let suffix = 1
  let code = `NEW_PLAN_${suffix}`

  while (usedCodes.has(code)) {
    suffix += 1
    code = `NEW_PLAN_${suffix}`
  }

  return code
}

function PlanCard({
  plan,
  currencies,
  onUpdate,
  onRemove,
  selectedPlanId,
  identityErrors,
  provisionAdapter,
}: Readonly<{
  plan: ProductPlanEditorForm
  currencies: SupportedCurrency[]
  onUpdate: (plan: ProductPlanEditorForm) => void
  onRemove: () => void
  selectedPlanId?: string | null
  identityErrors?: ProductPlanIdentityErrors[string]
  provisionAdapter?: ProductProvisionAdapter
}>) {
  const isSelected = selectedPlanId === plan.id
  const enabledTerms = plan.enabledTerms
  const offerByCell = useMemo(
    () =>
      new Map(
        plan.offers.map((offer) => [
          `${offer.currency}:${offer.billingPeriod}`,
          offer,
        ])
      ),
    [plan.offers]
  )

  const updateCell = (
    currency: SupportedCurrency,
    billingPeriod: BillingPeriod,
    periodPrice: string
  ) => {
    const key = `${currency}:${billingPeriod}`
    const existing = offerByCell.get(key)
    const offers = existing
      ? plan.offers.map((offer) =>
          offer.id === existing.id
            ? { ...offer, periodPrice, isActive: true }
            : offer
        )
      : [...plan.offers, { ...newOffer(currency, billingPeriod), periodPrice }]
    onUpdate({ ...plan, offers })
  }

  const toggleTerm = (billingPeriod: BillingPeriod, enabled: boolean) => {
    const nextTerms = enabled
      ? [...enabledTerms, billingPeriod]
      : enabledTerms.filter((term) => term !== billingPeriod)
    onUpdate({ ...plan, enabledTerms: nextTerms })
  }
  const rawProvisioning = plan.resources.provisioning
  const provisioning =
    rawProvisioning &&
    typeof rawProvisioning === "object" &&
    !Array.isArray(rawProvisioning)
      ? (rawProvisioning as Record<string, unknown>)
      : plan.resources
  const provisionConfig = provisionAdapter
    ? (provisionAdapter.parsePlanConfig?.(provisioning) ??
      provisionAdapter.defaultConfig ??
      provisioning)
    : null
  const provisionErrors =
    provisionAdapter?.validatePlanConfig?.(provisioning)?.errors
  const ProvisionConfig = provisionAdapter?.PlanConfigComponent

  return (
    <Card
      id={`catalog-plan-${plan.id}`}
      data-selected-plan={isSelected ? "true" : undefined}
      className={isSelected ? "ring-2 ring-primary" : undefined}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {plan.name || "Unnamed plan"}
            </CardTitle>
            <CardDescription>Code: {plan.code || "—"}</CardDescription>
            {isSelected && (
              <Badge variant="secondary">Selected from VPN package</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={plan.isActive}
              onCheckedChange={(checked) =>
                onUpdate({ ...plan, isActive: checked })
              }
              aria-label={`Enable ${plan.name || "plan"}`}
            />
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
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`catalog-plan-${plan.id}-name`}>Name *</Label>
            <Input
              id={`catalog-plan-${plan.id}-name`}
              value={plan.name}
              onChange={(event) =>
                onUpdate({ ...plan, name: event.target.value })
              }
              placeholder="Plan display name"
              aria-invalid={Boolean(identityErrors?.name)}
              aria-describedby={
                identityErrors?.name
                  ? `catalog-plan-${plan.id}-name-error`
                  : undefined
              }
            />
            {identityErrors?.name && (
              <p
                id={`catalog-plan-${plan.id}-name-error`}
                className="text-xs text-destructive"
                role="alert"
              >
                {identityErrors.name}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`catalog-plan-${plan.id}-code`}>Code *</Label>
            <Input
              id={`catalog-plan-${plan.id}-code`}
              value={plan.code}
              onChange={(event) =>
                onUpdate({ ...plan, code: event.target.value })
              }
              placeholder="e.g. PRIVATE"
              aria-invalid={Boolean(identityErrors?.code)}
              aria-describedby={
                identityErrors?.code
                  ? `catalog-plan-${plan.id}-code-error`
                  : undefined
              }
            />
            {identityErrors?.code && (
              <p
                id={`catalog-plan-${plan.id}-code-error`}
                className="text-xs text-destructive"
                role="alert"
              >
                {identityErrors.code}
              </p>
            )}
          </div>
        </div>

        {/* Billing Strategy & Stock Controls */}
        <div className="grid gap-4 rounded-md border p-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Billing Strategy</Label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`plan-${plan.id}-billing-strategy`}
                  value="FIXED_CYCLE"
                  checked={plan.billingStrategy !== "PRO_RATA"}
                  onChange={() =>
                    onUpdate({ ...plan, billingStrategy: "FIXED_CYCLE" })
                  }
                />
                Fixed Cycle (30-day term)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`plan-${plan.id}-billing-strategy`}
                  value="PRO_RATA"
                  checked={plan.billingStrategy === "PRO_RATA"}
                  onChange={() =>
                    onUpdate({ ...plan, billingStrategy: "PRO_RATA" })
                  }
                />
                Pro-rata (Calendar month)
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Inventory & Stock</Label>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={plan.stockControl === "TRACKED"}
                  onCheckedChange={(checked) =>
                    onUpdate({
                      ...plan,
                      stockControl: checked ? "TRACKED" : "UNLIMITED",
                      stockCount: checked ? (plan.stockCount ?? 0) : null,
                    })
                  }
                />
                Track stock
              </label>
            </div>
            {plan.stockControl === "TRACKED" && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={plan.stockCount ?? 0}
                    onChange={(event) =>
                      onUpdate({
                        ...plan,
                        stockCount:
                          Number.parseInt(event.target.value, 10) || 0,
                      })
                    }
                    placeholder="Available count"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(plan.allowBackorder)}
                    onChange={(event) =>
                      onUpdate({
                        ...plan,
                        allowBackorder: event.target.checked,
                      })
                    }
                  />
                  Allow backorders
                </label>
              </div>
            )}
          </div>
        </div>
        {ProvisionConfig && provisionConfig && (
          <ProvisionConfig
            value={provisionConfig}
            errors={provisionErrors}
            onChange={(config) =>
              onUpdate({
                ...plan,
                resources: {
                  ...plan.resources,
                  provisioning: { ...provisioning, ...config },
                },
              })
            }
          />
        )}
        {plan.offers.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-sm text-amber-700">
            Pricing required before this plan can be published.
          </p>
        )}
        <div className="space-y-2">
          <Label className="text-xs">Enabled terms</Label>
          <div className="flex flex-wrap gap-3">
            {BILLING_PERIODS.filter((period) => period !== "CUSTOM").map(
              (period) => (
                <label key={period} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={enabledTerms.includes(period)}
                    onCheckedChange={(checked) => toggleTerm(period, checked)}
                    aria-label={`Enable ${billingPeriodLabel(period)}`}
                  />
                  {billingPeriodLabel(period)}
                </label>
              )
            )}
          </div>
        </div>

        {currencies.length === 0 || enabledTerms.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Enable at least one currency and billing term to configure prices.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table
              className="w-full text-sm"
              aria-label={`${plan.name || "Plan"} price matrix`}
            >
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Currency</th>
                  {enabledTerms.map((period) => (
                    <th
                      key={period}
                      className="px-3 py-2 text-left font-medium"
                    >
                      {billingPeriodLabel(period)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currencies.map((currency) => (
                  <tr key={currency} className="border-t">
                    <th className="px-3 py-2 text-left font-medium">
                      {currency}
                    </th>
                    {enabledTerms.map((period) => {
                      const offer = offerByCell.get(`${currency}:${period}`)
                      return (
                        <td key={`${currency}-${period}`} className="p-2">
                          <Input
                            aria-label={`${currency} ${billingPeriodLabel(period)} price`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Required"
                            value={offer?.periodPrice ?? ""}
                            onChange={(event) =>
                              updateCell(currency, period, event.target.value)
                            }
                          />
                          {offer?.periodPrice &&
                          Number(offer.periodPrice) <= 0 ? (
                            <p className="mt-1 text-xs text-destructive">
                              Must be positive
                            </p>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {plan.offers.length > 0 && (
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {plan.offers.map((offer) => (
              <span key={offer.id}>
                {offer.currency} {billingPeriodLabel(offer.billingPeriod)}:{" "}
                {offer.periodPrice
                  ? formatBillingMoney(offer.periodPrice, offer.currency)
                  : "incomplete"}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CatalogPlansTab({
  plans,
  currencies,
  onChange,
  showPreview,
  selectedPlanId,
  productCode,
}: Readonly<{
  plans: ProductPlanEditorForm[]
  currencies: SupportedCurrency[]
  onChange: (plans: ProductPlanEditorForm[]) => void
  showPreview?: boolean
  selectedPlanId?: string | null
  productCode?: ServiceType
}>) {
  const identityErrors = validateProductPlanIdentities(plans)
  const provisionAdapter = productCode
    ? getProvisionAdapter(productCode)
    : undefined

  const handleAddPlan = () => {
    onChange([
      ...plans,
      {
        id: `new-plan-${crypto.randomUUID()}`,
        code: newPlanCode(plans),
        name: "",
        resources: {
          features: {},
          provisioning: {},
          provisioningFields: [],
        },
        isActive: true,
        enabledTerms: ["MONTHLY"],
        offers: [],
      },
    ])
  }

  if (showPreview) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Preview mode: plans are read-only.
        </p>
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-md border p-4">
            <p className="font-medium">{plan.name || "Unnamed plan"}</p>
            <div className="mt-2 grid gap-1 text-sm">
              {plan.offers.map((offer) => (
                <span key={offer.id}>
                  {offer.currency} · {billingPeriodLabel(offer.billingPeriod)} ·{" "}
                  {offer.periodPrice
                    ? formatBillingMoney(offer.periodPrice, offer.currency)
                    : "—"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans configured.</p>
      ) : (
        plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currencies={currencies}
            onUpdate={(next) =>
              onChange(plans.map((item) => (item.id === next.id ? next : item)))
            }
            onRemove={() =>
              onChange(plans.filter((item) => item.id !== plan.id))
            }
            provisionAdapter={provisionAdapter}
            selectedPlanId={selectedPlanId}
            identityErrors={identityErrors[plan.id]}
          />
        ))
      )}
      <Button variant="outline" className="w-full" onClick={handleAddPlan}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Add plan
      </Button>
    </div>
  )
}
