"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowCounterClockwise, WalletIcon } from "@phosphor-icons/react"
import {
  getCheckoutQuote,
  submitCheckout,
  type CheckoutPreview,
  type CheckoutResult,
} from "./checkout-client"
import {
  ProvisioningFieldDef,
  ProvisioningFormField,
  matchesPattern,
} from "@/components/billing/provisioning-form-field"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

function formatCurrency(amount: string, currency: string = "IDR"): string {
  const safeCurrency =
    currency && currency.trim() ? currency.trim().toUpperCase() : "IDR"
  const value = Number(amount)
  return new Intl.NumberFormat(safeCurrency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: safeCurrency === "USD" ? 2 : 0,
  }).format(Number.isNaN(value) ? 0 : value)
}

function formatDate(iso: string | null, fallback: string): string {
  if (!iso) return fallback
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function isRetryable(errorCode: string): boolean {
  return (
    errorCode === "INSUFFICIENT_BALANCE" || errorCode === "ORDER_NOT_CHARGEABLE"
  )
}

function replaceTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template
  )
}

export default function CheckoutPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.billing.checkout
  const orderMessages = messages.console.billing.serviceOrder
  const searchParams = useSearchParams()
  const pricingIdParam = searchParams.get("pricingId") || ""
  const [selectedPricingId, setSelectedPricingId] = useState<string | null>(
    null
  )
  const activePricingId = selectedPricingId ?? pricingIdParam

  const [idempotencyKey] = useState(
    () =>
      `checkout:${pricingIdParam}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
  )
  const [quote, setQuote] = useState<CheckoutResult | null>(null)
  const [voucherCode, setVoucherCode] = useState("")
  const [voucherInput, setVoucherInput] = useState("")
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [quotePreview, setQuotePreview] = useState<CheckoutPreview | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [addonIds, setAddonIds] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Dynamic custom form field values map
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [phoneNumber, setPhoneNumber] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [profilePictureUrl, setProfilePictureUrl] = useState("")

  const resources = (quotePreview?.resources ?? {}) as Record<string, unknown>
  const packageCode = quotePreview?.packageCode?.toUpperCase()

  // Filter internal provisioning configuration keys from commercial benefits view
  const INTERNAL_RESOURCE_KEYS = new Set([
    "provisioningFields",
    "provisioningType",
    "serverIds",
    "allowedProtocols",
    "customUsername",
    "customUsernameAllowed",
    "clusterId",
    "compute",
    "networking",
    "requiredDependencies",
  ])
  const flatFilteredResources = Object.fromEntries(
    Object.entries(resources).filter(
      ([key]) => !INTERNAL_RESOURCE_KEYS.has(key)
    )
  )
  const features =
    resources.features &&
    typeof resources.features === "object" &&
    !Array.isArray(resources.features)
      ? (resources.features as Record<string, unknown>)
      : flatFilteredResources
  const provisioning =
    resources.provisioning &&
    typeof resources.provisioning === "object" &&
    !Array.isArray(resources.provisioning)
      ? (resources.provisioning as Record<string, unknown>)
      : resources

  const rawDynamicFields: ProvisioningFieldDef[] = Array.isArray(
    provisioning.provisioningFields
  )
    ? (provisioning.provisioningFields as ProvisioningFieldDef[])
    : Array.isArray(resources.provisioningFields)
      ? (resources.provisioningFields as ProvisioningFieldDef[])
      : []

  // Auto-inject VPN Custom Username input when plan has customUsername: true
  const dynamicFields = useMemo(() => {
    const list = [...rawDynamicFields]
    if (
      (provisioning.customUsername === true ||
        provisioning.customUsernameAllowed === true) &&
      !list.some((f) => f.name === "username")
    ) {
      list.unshift({
        id: "vpn-custom-username",
        name: "username",
        label: "VPN Username",
        type: "text",
        required: false,
        placeholder: "e.g. my-vpn-user (optional)",
        helperText: "Leave blank to auto-generate a secure username.",
      })
    }
    return list
  }, [
    rawDynamicFields,
    provisioning.customUsername,
    provisioning.customUsernameAllowed,
  ])

  const showDynamicForm = dynamicFields.length > 0
  const hasMissingRequiredFields = dynamicFields.some((f) => {
    const val = (
      f.name === "phoneNumber"
        ? phoneNumber
        : f.name === "displayName"
          ? displayName
          : f.name === "profilePicture" || f.name === "profilePictureUrl"
            ? profilePictureUrl
            : (formData[f.name] ?? "")
    ).trim()
    if (f.required && !val) return true
    if (
      val &&
      f.validationPattern &&
      !matchesPattern(val, f.validationPattern)
    ) {
      return true
    }
    return false
  })
  const hasPricing = Boolean(activePricingId)

  const isVoucherError = (code?: string) =>
    Boolean(
      code &&
      (code.startsWith("VOUCHER_") || code === "BILLING_CURRENCY_MISMATCH")
    )

  const requestQuote = useCallback(
    async (
      nextAddonIds: string[],
      nextVoucherCode: string,
      pricingToQuote?: string
    ) => {
      const targetPricingId = pricingToQuote || activePricingId
      if (!targetPricingId) return
      setQuoteLoading(true)
      setQuoteError(null)
      const result = await getCheckoutQuote({
        pricingId: targetPricingId,
        addonIds: nextAddonIds,
        voucherCode: nextVoucherCode || undefined,
        idempotencyKey,
      })
      if (result.ok) {
        setQuotePreview(result)
        setVoucherCode(nextVoucherCode)
        setVoucherError(null)
      } else if (isVoucherError(result.error)) {
        // Display error inside the voucher section and keep/preserve base quote.
        setVoucherError(
          result.error === "BILLING_CURRENCY_MISMATCH"
            ? t.voucherCurrencyMismatch
            : result.message
        )
        setQuotePreview((prev) => {
          if (prev) {
            return {
              ...prev,
              voucher: null,
            }
          }
          return null
        })
      } else {
        setQuotePreview(null)
        setQuoteError(result.message)
      }
      setQuoteLoading(false)
    },
    [activePricingId, idempotencyKey]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void requestQuote(addonIds, voucherCode)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [requestQuote, addonIds, voucherCode])

  const handleAddonChange = (addonId: string, checked: boolean) => {
    const nextAddonIds = checked
      ? [...new Set([...addonIds, addonId])]
      : addonIds.filter((id) => id !== addonId)
    setAddonIds(nextAddonIds)
    void requestQuote(nextAddonIds, voucherCode)
  }

  const handleApplyVoucher = () => {
    const nextVoucherCode = voucherInput.trim().toUpperCase()
    setVoucherError(null)
    void requestQuote(addonIds, nextVoucherCode)
  }

  const handleCheckout = async (): Promise<void> => {
    if (!activePricingId) return
    setIsLoading(true)
    setError(null)
    try {
      const effectivePhone =
        phoneNumber.trim() || formData.phoneNumber?.trim() || ""
      const effectiveDisplayName =
        displayName.trim() || formData.displayName?.trim() || undefined
      const effectiveProfileUrl =
        profilePictureUrl.trim() ||
        formData.profilePictureUrl?.trim() ||
        undefined

      const provisioningAnswers: Record<string, string> = {
        ...formData,
        ...(phoneNumber ? { phoneNumber } : {}),
        ...(displayName ? { displayName } : {}),
        ...(profilePictureUrl ? { profilePictureUrl } : {}),
      }

      const result = await submitCheckout({
        pricingId: activePricingId,
        addonIds,
        voucherCode: voucherCode || undefined,
        quoteToken: quotePreview?.quoteToken,
        idempotencyKey,
        device: effectivePhone
          ? {
              phoneNumber: effectivePhone,
              displayName: effectiveDisplayName,
              profilePictureUrl: effectiveProfileUrl,
            }
          : undefined,
        metadata: {
          provisioningAnswers,
          ...(dynamicFields.length > 0
            ? {
                provisioningFieldsSchema: dynamicFields.map((f) => ({
                  name: f.name,
                  label: f.label,
                  type: f.type,
                })),
              }
            : {}),
        },
      })
      setQuote(result)
      if (!result.ok) {
        setError(result.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.submissionFailed
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = (): void => {
    setError(null)
    setQuote(null)
    void handleCheckout()
  }

  const handleAddBalance = (): void => {
    window.location.href = `/${locale}/console/billing/topup`
  }

  const handleChooseAnother = (): void => {
    window.location.href = `/${locale}/console/billing`
  }

  const isSuccess = quote?.ok === true
  const isFailure = quote?.ok === false
  const retryable = isFailure && quote && isRetryable(quote.error)
  const addonOptions = quotePreview?.availableAddons ?? []

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
      </header>

      {!hasPricing && (
        <Alert variant="destructive">
          <AlertDescription>{t.noPricingSelected}</AlertDescription>
        </Alert>
      )}

      {quoteError && (
        <Alert variant="destructive">
          <AlertDescription>{quoteError}</AlertDescription>
        </Alert>
      )}

      {hasPricing && quotePreview && !quote && !isLoading && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Plan Details, Dynamic Provisioning Form, Addons, Vouchers */}
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            {/* Plan Info Card - Natural Product & Specification Card with Benefits */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {quotePreview.packageName || quotePreview.packageCode}
                    </span>
                    <CardTitle className="text-xl">
                      {quotePreview.planName || quotePreview.planCode}
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="px-2.5 py-1 text-xs font-medium"
                  >
                    {quotePreview.billingPeriod} {t.cycle}
                  </Badge>
                </div>
                {quotePreview.packageDescription && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {quotePreview.packageDescription}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Plan Resources & Included Benefits */}
                {Object.keys(features).filter(
                  (k) =>
                    typeof features[k] !== "object" &&
                    features[k] !== null &&
                    features[k] !== undefined
                ).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t.includedResources}
                    </Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(features)
                        .filter(
                          ([, value]) =>
                            typeof value !== "object" &&
                            value !== null &&
                            value !== undefined
                        )
                        .map(([name, value]) => (
                          <div
                            key={name}
                            className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {formatKey(name)}
                            </span>
                            <span className="font-medium text-foreground">
                              {String(value)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {/* Term Switcher if plan has multiple pricing terms */}
                {/* Term Switcher if plan has multiple distinct pricing terms */}
                {new Set(
                  (quotePreview.availableTerms ?? []).map(
                    (t) => t.billingPeriod
                  )
                ).size > 1 && (
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs font-medium">
                      {t.switchBillingCycle}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {(quotePreview.availableTerms ?? []).map((term) => (
                        <Button
                          key={term.pricingId}
                          type="button"
                          size="sm"
                          variant={
                            activePricingId === term.pricingId
                              ? "default"
                              : "outline"
                          }
                          onClick={() => {
                            setSelectedPricingId(term.pricingId)
                            void requestQuote(
                              addonIds,
                              voucherCode,
                              term.pricingId
                            )
                          }}
                          disabled={quoteLoading}
                          className="text-xs"
                        >
                          {term.billingPeriod} (
                          {formatCurrency(term.periodPrice, term.currency)})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dynamic Custom Provisioning Form Fields */}
            {showDynamicForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t.provisioningTitle}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t.provisioningDesc}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dynamicFields.map((field) => {
                      const val =
                        field.name === "phoneNumber"
                          ? phoneNumber
                          : field.name === "displayName"
                            ? displayName
                            : field.name === "profilePicture" ||
                                field.name === "profilePictureUrl"
                              ? profilePictureUrl
                              : (formData[field.name] ?? "")

                      const onChangeVal = (nextVal: string) => {
                        if (field.name === "phoneNumber")
                          setPhoneNumber(nextVal)
                        else if (field.name === "displayName")
                          setDisplayName(nextVal)
                        else if (
                          field.name === "profilePicture" ||
                          field.name === "profilePictureUrl"
                        )
                          setProfilePictureUrl(nextVal)
                        else
                          setFormData((prev) => ({
                            ...prev,
                            [field.name]: nextVal,
                          }))
                      }

                      return (
                        <div
                          key={field.id}
                          className={
                            field.type === "radio" || dynamicFields.length === 1
                              ? "space-y-1.5 sm:col-span-2"
                              : "space-y-1.5"
                          }
                        >
                          <ProvisioningFormField
                            field={field}
                            value={val}
                            onChange={onChangeVal}
                            testIdPrefix="checkout"
                            idPrefix="field"
                            validationErrorMessage={t.invalidFieldFormat}
                          />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add-ons Section */}
            {addonOptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t.availableAddons}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {addonOptions.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-start gap-2.5 rounded-md border bg-card p-3"
                    >
                      <Checkbox
                        id={`addon-${addon.id}`}
                        checked={
                          addon.selected === true || addonIds.includes(addon.id)
                        }
                        disabled={addon.required === true || quoteLoading}
                        onCheckedChange={(checked) =>
                          handleAddonChange(addon.id, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`addon-${addon.id}`}
                        className="cursor-pointer"
                      >
                        <span className="text-sm font-medium">
                          {addon.name}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatCurrency(addon.price, addon.currency)}
                          {addon.required ? ` · ${t.requiredAddon}` : ""}
                        </span>
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Voucher Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.promotionsTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="voucher-code" className="text-xs">
                  {t.voucherCodeLabel}
                </Label>
                <div className="flex gap-2">
                  <input
                    id="voucher-code"
                    value={voucherInput}
                    onChange={(event) => {
                      setVoucherInput(event.target.value)
                      if (voucherError) setVoucherError(null)
                    }}
                    className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder={t.voucherPlaceholder}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyVoucher}
                    disabled={quoteLoading}
                  >
                    {t.applyVoucher}
                  </Button>
                </div>
                {voucherError && (
                  <p className="text-xs font-medium text-destructive">
                    {voucherError}
                  </p>
                )}
                {quotePreview.voucher && !voucherError && (
                  <p className="text-xs text-muted-foreground">
                    {quotePreview.voucher.code} {t.expires}{" "}
                    {formatDate(
                      quotePreview.voucher.quoteExpiresAt,
                      t.notAvailable
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          {/* Right Column: Sticky Summary & Total Billing Breakdown */}
          <div className="space-y-6 lg:col-span-5 xl:col-span-4">
            <div className="sticky top-6 space-y-4">
              <Card className="border-primary/20 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{t.orderSummary}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quotePreview.isProrated && (
                    <div className="rounded-md border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
                      <p className="font-semibold">{t.proratedTitle}</p>
                      <p className="mt-0.5">
                        {replaceTemplate(t.proratedDesc, {
                          days: String(quotePreview.proratedDays),
                          total: String(quotePreview.totalDaysInPeriod),
                        })}{" "}
                        {formatDate(quotePreview.nextRenewal, t.notAvailable)}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2.5 border-t pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {quotePreview.isProrated
                          ? t.proratedSubtotal
                          : t.subtotal}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(
                          quotePreview.subtotal,
                          quotePreview.currency
                        )}
                      </span>
                    </div>
                    {Number(quotePreview.discount) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>{t.discount}</span>
                        <span>
                          -{" "}
                          {formatCurrency(
                            quotePreview.discount,
                            quotePreview.currency
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between border-t pt-2.5 text-base font-bold">
                      <span>{t.firstPayment}</span>
                      <span className="text-xl text-primary">
                        {formatCurrency(
                          quotePreview.firstPayment,
                          quotePreview.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t.nextRenewal}</span>
                      <span>
                        {formatDate(quotePreview.nextRenewal, t.notAvailable)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="confirm-terms"
                        checked={confirmed}
                        onCheckedChange={(checked) =>
                          setConfirmed(checked === true)
                        }
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="confirm-terms"
                        className="text-xs leading-snug"
                      >
                        {t.confirmationText}
                      </Label>
                    </div>

                    <Button
                      type="button"
                      onClick={() => void handleCheckout()}
                      disabled={
                        !confirmed || quoteLoading || hasMissingRequiredFields
                      }
                      className="w-full text-sm font-semibold"
                      size="lg"
                    >
                      {isLoading
                        ? orderMessages.processingActivation
                        : quoteLoading
                          ? t.updatingQuote
                          : Number(quotePreview.firstPayment) === 0
                            ? t.confirmAndActivate
                            : t.confirmAndPay}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
      {(isLoading || quoteLoading) && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {isSuccess && quote && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-300">
              {t.orderConfirmed}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.orderId}</span>
              <span className="font-mono text-xs">{quote.orderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.status}</span>
              <span className="font-medium">{quote.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.subtotal}</span>
              <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.discount}</span>
              <span>{formatCurrency(quote.discount, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>{t.firstPaymentSummary}</span>
              <span>{formatCurrency(quote.firstPayment, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t.nextRenewalSummary}
              </span>
              <span>{formatDate(quote.nextRenewal, t.notAvailable)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.currency}</span>
              <span>{quote.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.billingPeriod}</span>
              <span>{quote.billingPeriod}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.period}</span>
              <span>
                {formatDate(quote.periodStart, t.notAvailable)} —{" "}
                {formatDate(quote.periodEnd, t.notAvailable)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {isFailure && quote && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">{t.orderFailed}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{quote.message}</AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              {retryable && (
                <>
                  <Button onClick={handleRetry} className="w-full">
                    <ArrowCounterClockwise className="mr-2 size-4" />
                    {t.retry}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAddBalance}
                    className="w-full"
                  >
                    <WalletIcon className="mr-2 size-4" />
                    {t.addBalance}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={handleChooseAnother}
                className="w-full"
              >
                {t.chooseAnotherPlan}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && !quote && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </main>
  )
}
