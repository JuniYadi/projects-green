"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { XIcon } from "@phosphor-icons/react"
import {
  getCatalog,
  type CatalogProduct,
  type VoucherDetailDTO,
} from "@/lib/billing-client"
import type { AppMessages } from "@/lib/i18n/messages/types"

const FALLBACK_BILLING_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "YEARLY",
  "CUSTOM",
]

const jsonArrayToList = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string")
      }
    } catch {
      // Keep malformed legacy values visible as empty selections.
    }
  }
  return []
}

const toDateTimeLocal = (value: string): string => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const currentDateTimeLocal = () => {
  const offset = new Date().getTimezoneOffset() * 60_000
  return new Date(Date.now() - offset).toISOString().slice(0, 16)
}

export function VoucherRulesTab({
  voucher,
  onUpdate,
  isNew = voucher.id === "new",
  fieldErrors = {},
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
  isNew?: boolean
  fieldErrors?: Record<string, string[]>
}) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pBillingPromotionsIdVoucherRulesTab
  const isProductPromo = voucher.kind === "PRODUCT_PROMOTION"
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  useEffect(() => {
    if (!isNew || !isProductPromo) return

    let cancelled = false
    // Reset the request state before loading the catalog for a new product promotion.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCatalogLoading(true)
    setCatalogError(null)

    void getCatalog()
      .then((response) => {
        if (!cancelled) setCatalogProducts(response.products)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCatalogError(
            error instanceof Error
              ? error.message
              : "Unable to load the product catalog."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isNew, isProductPromo])

  const allowedPackageCodes = jsonArrayToList(voucher.allowedPackageCodes)
  const allowedPlanCodes = jsonArrayToList(voucher.allowedPlanCodes)
  const allowedBillingPeriods = jsonArrayToList(voucher.allowedBillingPeriods)

  const planOptions = useMemo(
    () =>
      catalogProducts.flatMap((product) =>
        product.plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          productCode: product.code,
        }))
      ),
    [catalogProducts]
  )

  const periodOptions = useMemo(() => {
    const periods = catalogProducts.flatMap((product) =>
      product.plans.flatMap((plan) =>
        plan.offers.map((offer) => offer.billingPeriod)
      )
    )
    return periods.length > 0 ? [...new Set(periods)] : FALLBACK_BILLING_PERIODS
  }, [catalogProducts])

  const renderErrors = (field: string) => {
    const errors = fieldErrors[field]
    if (!errors?.length) return null

    return (
      <ul className="flex flex-col gap-1 text-sm text-destructive" role="alert">
        {errors.map((error, index) => (
          <li key={`${field}-${index}`}>{error}</li>
        ))}
      </ul>
    )
  }

  const toggleSelection = (
    field: "allowedPackageCodes" | "allowedPlanCodes" | "allowedBillingPeriods",
    current: string[],
    value: string,
    checked: boolean
  ) => {
    const next = checked
      ? [...new Set([...current, value])]
      : current.filter((item) => item !== value)
    onUpdate({ [field]: next })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.rulesAndRestrictions}</CardTitle>
        <CardDescription>
          {isProductPromo
            ? "Choose the catalog products or plans and billing terms where this promotion can be used."
            : "Set the expiration and audience rules for this balance credit."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="voucher-rules-expires-at">
            {t.expirationDateAndTimeLabel}
          </Label>
          <Input
            id="voucher-rules-expires-at"
            type="datetime-local"
            min={currentDateTimeLocal()}
            value={toDateTimeLocal(voucher.expiresAt)}
            onChange={(event) => onUpdate({ expiresAt: event.target.value })}
            aria-invalid={Boolean(fieldErrors.expiresAt?.length)}
          />
          <p className="text-xs text-muted-foreground">
            {t.expirationHelperText}
          </p>
          {renderErrors("expiresAt")}
        </div>
        {isProductPromo && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-min-amount">
                  {t.minimumOrderAmountLabel}
                </Label>
                <Input
                  id="voucher-min-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={voucher.minimumOrderAmount ?? ""}
                  onChange={(event) =>
                    onUpdate({
                      minimumOrderAmount: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  placeholder="e.g. 100000"
                  aria-invalid={Boolean(fieldErrors.minimumOrderAmount?.length)}
                />
                <p className="text-xs text-muted-foreground">
                  {t.minimumOrderAmountHelperText}
                </p>
                {renderErrors("minimumOrderAmount")}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-max-discount">
                  {t.maximumDiscountAmountLabel}
                </Label>
                <Input
                  id="voucher-max-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={voucher.maximumDiscountAmount ?? ""}
                  onChange={(event) =>
                    onUpdate({
                      maximumDiscountAmount: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  placeholder="e.g. 25000"
                  aria-invalid={Boolean(
                    fieldErrors.maximumDiscountAmount?.length
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {t.maximumDiscountAmountHelperText}
                </p>
                {renderErrors("maximumDiscountAmount")}
              </div>
            </div>

            {isNew ? (
              <div className="flex flex-col gap-6">
                <fieldset className="flex flex-col gap-3">
                  <legend className="text-sm font-medium">
                    {t.eligibleProductsOrPlansLegend}
                  </legend>
                  <p className="text-xs text-muted-foreground">
                    {t.eligibleProductsHelperText}
                  </p>
                  {catalogLoading && (
                    <p className="text-sm text-muted-foreground">
                      {t.loadingCatalogOptions}
                    </p>
                  )}
                  {catalogError && (
                    <p className="text-sm text-destructive" role="alert">
                      {catalogError}
                    </p>
                  )}
                  {!catalogLoading && catalogProducts.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {catalogProducts.map((product) => (
                        <label
                          key={product.code}
                          className="flex items-start gap-3 rounded-lg border border-border p-3"
                        >
                          <Checkbox
                            checked={allowedPackageCodes.includes(product.code)}
                            onCheckedChange={(checked) =>
                              toggleSelection(
                                "allowedPackageCodes",
                                allowedPackageCodes,
                                product.code,
                                Boolean(checked)
                              )
                            }
                          />
                          <span className="flex flex-col gap-1">
                            <span className="font-medium">{product.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {product.code}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {renderErrors("allowedPackageCodes")}
                  {renderErrors("allowedPlanCodes")}
                </fieldset>

                {planOptions.length > 0 && (
                  <fieldset className="flex flex-col gap-3">
                    <legend className="text-sm font-medium">
                      {t.eligiblePlansOptionalLegend}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {planOptions.map((plan) => (
                        <label
                          key={`${plan.productCode}-${plan.code}`}
                          className="flex items-start gap-3 rounded-lg border border-border p-3"
                        >
                          <Checkbox
                            checked={allowedPlanCodes.includes(plan.code)}
                            onCheckedChange={(checked) =>
                              toggleSelection(
                                "allowedPlanCodes",
                                allowedPlanCodes,
                                plan.code,
                                Boolean(checked)
                              )
                            }
                          />
                          <span className="flex flex-col gap-1">
                            <span className="font-medium">{plan.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {plan.productCode} / {plan.code}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                <fieldset className="flex flex-col gap-3">
                  <legend className="text-sm font-medium">
                    {t.allowedBillingPeriodsLegend}
                  </legend>
                  <p className="text-xs text-muted-foreground">
                    {t.allowedBillingPeriodsHelperText}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {periodOptions.map((period) => (
                      <label
                        key={period}
                        className="flex items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <Checkbox
                          checked={allowedBillingPeriods.includes(period)}
                          onCheckedChange={(checked) =>
                            toggleSelection(
                              "allowedBillingPeriods",
                              allowedBillingPeriods,
                              period,
                              Boolean(checked)
                            )
                          }
                        />
                        <span>{periodLabel(period)}</span>
                      </label>
                    ))}
                  </div>
                  {renderErrors("allowedBillingPeriods")}
                </fieldset>
              </div>
            ) : (
              <LegacyEligibilityFields
                packageCodes={allowedPackageCodes}
                planCodes={allowedPlanCodes}
                periods={allowedBillingPeriods}
                onUpdate={onUpdate}
                t={t}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function periodLabel(period: string): string {
  return period
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^| )\S/g, (letter) => letter.toUpperCase())
}

function LegacyEligibilityFields({
  packageCodes,
  planCodes,
  periods,
  onUpdate,
  t,
}: {
  packageCodes: string[]
  planCodes: string[]
  periods: string[]
  onUpdate: (updates: Record<string, unknown>) => void
  t: AppMessages["pBillingPromotionsIdVoucherRulesTab"]
}) {
  return (
    <div className="flex flex-col gap-6">
      <CodeListField
        label={t.allowedPackageCodesLabel}
        value={packageCodes}
        placeholder={t.allowedPackageCodesPlaceholder}
        onChange={(next) => onUpdate({ allowedPackageCodes: next })}
        addButtonLabel={t.addButtonLabel}
      />
      <CodeListField
        label={t.allowedPlanCodesLabel}
        value={planCodes}
        placeholder={t.allowedPlanCodesPlaceholder}
        onChange={(next) => onUpdate({ allowedPlanCodes: next })}
        addButtonLabel={t.addButtonLabel}
      />
      <CodeListField
        label={t.allowedBillingPeriodsFieldLabel}
        value={periods}
        placeholder={t.allowedBillingPeriodsPlaceholder}
        onChange={(next) => onUpdate({ allowedBillingPeriods: next })}
        addButtonLabel={t.addButtonLabel}
      />
    </div>
  )
}

function CodeListField({
  label,
  value,
  placeholder,
  onChange,
  addButtonLabel,
}: {
  label: string
  value: string[]
  placeholder: string
  onChange: (next: string[]) => void
  addButtonLabel: string
}) {
  const [draft, setDraft] = useState("")

  const addCode = () => {
    const trimmed = draft.trim().toUpperCase()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setDraft("")
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCode()
            }
          }}
          placeholder={placeholder}
          className="font-mono uppercase"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCode}>
          {addButtonLabel}
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
            >
              {code}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== code))}
                className="rounded p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${code}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
