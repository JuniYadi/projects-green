"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowCounterClockwise, WalletIcon } from "@phosphor-icons/react"
import {
  getCheckoutQuote,
  submitCheckout,
  type CheckoutPreview,
  type CheckoutResult,
} from "./checkout-client"

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

function formatDate(iso: string | null): string {
  if (!iso) return "N/A"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function isRetryable(errorCode: string): boolean {
  return (
    errorCode === "INSUFFICIENT_BALANCE" || errorCode === "ORDER_NOT_CHARGEABLE"
  )
}

type ProvisioningFieldDef = {
  id: string
  name: string
  label: string
  type: "text" | "number" | "email" | "url" | "select" | "radio"
  placeholder?: string
  required: boolean
  options?: string[]
}

export default function CheckoutPage() {
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
  const dynamicFields: ProvisioningFieldDef[] = Array.isArray(
    resources.provisioningFields
  )
    ? (resources.provisioningFields as ProvisioningFieldDef[])
    : []

  const showDynamicForm = dynamicFields.length > 0
  const hasMissingRequiredFields = dynamicFields.some(
    (f) =>
      f.required &&
      !(f.name === "phoneNumber"
        ? phoneNumber.trim()
        : formData[f.name]?.trim())
  )
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
            ? "This balance-credit voucher must match your billing account currency. The voucher claim was not consumed."
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
      })
      setQuote(result)
      if (!result.ok) {
        setError(result.message)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Checkout submission failed"
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
    window.location.href = "/console/billing/topup"
  }

  const handleChooseAnother = (): void => {
    window.location.href = "/console/billing"
  }

  const isSuccess = quote?.ok === true
  const isFailure = quote?.ok === false
  const retryable = isFailure && quote && isRetryable(quote.error)
  const addonOptions = quotePreview?.availableAddons ?? []

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Checkout</h1>
          <p className="text-sm text-muted-foreground">
            Review and confirm your subscription order
          </p>
        </div>
      </header>

      {!hasPricing && (
        <Alert variant="destructive">
          <AlertDescription>
            No pricing plan was selected. Please choose a plan from the catalog
            before checking out.
          </AlertDescription>
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
                    {quotePreview.billingPeriod} Cycle
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
                {Object.keys(resources).filter(
                  (k) =>
                    k !== "provisioningFields" &&
                    typeof resources[k] !== "object" &&
                    resources[k] !== null &&
                    resources[k] !== undefined
                ).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Included Resources & Specifications
                    </Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(resources)
                        .filter(
                          ([name, value]) =>
                            name !== "provisioningFields" &&
                            typeof value !== "object" &&
                            value !== null &&
                            value !== undefined
                        )
                        .map(([name, value]) => {
                          const formatKey = (key: string) =>
                            key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/_/g, " ")
                              .replace(/^\w/, (c) => c.toUpperCase())

                          return (
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
                          )
                        })}
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
                      Switch Billing Cycle
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
                    Device & Service Provisioning Configuration
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Configure details required to activate and provision your
                    service upon payment.
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
                            : field.name === "profilePictureUrl"
                              ? profilePictureUrl
                              : (formData[field.name] ?? "")

                      const onChangeVal = (nextVal: string) => {
                        if (field.name === "phoneNumber")
                          setPhoneNumber(nextVal)
                        else if (field.name === "displayName")
                          setDisplayName(nextVal)
                        else if (field.name === "profilePictureUrl")
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
                          <Label
                            htmlFor={`field-${field.id}`}
                            className="text-xs font-medium"
                          >
                            {field.label}{" "}
                            {field.required && (
                              <span className="text-destructive">*</span>
                            )}
                          </Label>

                          {field.type === "select" ? (
                            <Select value={val} onValueChange={onChangeVal}>
                              <SelectTrigger
                                id={`field-${field.id}`}
                                className="w-full text-xs"
                              >
                                <SelectValue
                                  placeholder={
                                    field.placeholder || "Select an option"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {(field.options ?? []).map((opt) => (
                                  <SelectItem
                                    key={opt}
                                    value={opt}
                                    className="text-xs"
                                  >
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === "radio" ? (
                            <div className="flex flex-wrap gap-4 pt-1">
                              {(field.options ?? []).map((opt) => (
                                <label
                                  key={opt}
                                  className="flex cursor-pointer items-center gap-2 text-xs"
                                >
                                  <input
                                    type="radio"
                                    name={`field-${field.id}`}
                                    value={opt}
                                    checked={val === opt}
                                    onChange={() => onChangeVal(opt)}
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <Input
                              id={`field-${field.id}`}
                              type={field.type}
                              value={val}
                              onChange={(e) => onChangeVal(e.target.value)}
                              onInput={(e) =>
                                onChangeVal(
                                  (e.target as HTMLInputElement).value
                                )
                              }
                              placeholder={field.placeholder || undefined}
                              required={field.required}
                              className="text-xs"
                            />
                          )}
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
                  <CardTitle className="text-base">Available Add-ons</CardTitle>
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
                          {addon.required ? " · Required" : ""}
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
                <CardTitle className="text-base">
                  Promotions & Vouchers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="voucher-code" className="text-xs">
                  Voucher code
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
                    placeholder="Optional voucher"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyVoucher}
                    disabled={quoteLoading}
                  >
                    Apply voucher
                  </Button>
                </div>
                {voucherError && (
                  <p className="text-xs font-medium text-destructive">
                    {voucherError}
                  </p>
                )}
                {quotePreview.voucher && !voucherError && (
                  <p className="text-xs text-muted-foreground">
                    {quotePreview.voucher.code} expires{" "}
                    {formatDate(quotePreview.voucher.quoteExpiresAt)}
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
                  <CardTitle className="text-lg">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quotePreview.isProrated && (
                    <div className="rounded-md border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
                      <p className="font-semibold">
                        Prorated Billing (Calendar Alignment)
                      </p>
                      <p className="mt-0.5">
                        Charged for {quotePreview.proratedDays} remaining days
                        in the current month (out of{" "}
                        {quotePreview.totalDaysInPeriod} days) aligned to
                        regular calendar renewal. Your first regular full
                        renewal begins on {formatDate(quotePreview.nextRenewal)}
                        .
                      </p>
                    </div>
                  )}

                  <div className="space-y-2.5 border-t pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {quotePreview.isProrated
                          ? "Prorated Subtotal"
                          : "Subtotal"}
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
                        <span>Discount</span>
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
                      <span>First payment</span>
                      <span className="text-xl text-primary">
                        {formatCurrency(
                          quotePreview.firstPayment,
                          quotePreview.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Next renewal</span>
                      <span>{formatDate(quotePreview.nextRenewal)}</span>
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
                        I confirm this purchase and agree to the recurring
                        billing terms.
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
                      {quoteLoading
                        ? "Updating quote..."
                        : Number(quotePreview.firstPayment) === 0
                          ? "Confirm and activate"
                          : "Confirm and pay"}
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
              Order Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono text-xs">{quote.orderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{quote.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span>{formatCurrency(quote.discount, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>First Payment</span>
              <span>{formatCurrency(quote.firstPayment, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next Renewal</span>
              <span>{formatDate(quote.nextRenewal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Currency</span>
              <span>{quote.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Billing Period</span>
              <span>{quote.billingPeriod}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period</span>
              <span>
                {formatDate(quote.periodStart)} — {formatDate(quote.periodEnd)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {isFailure && quote && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Order Failed</CardTitle>
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
                    Retry
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAddBalance}
                    className="w-full"
                  >
                    <WalletIcon className="mr-2 size-4" />
                    Add Balance
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={handleChooseAnother}
                className="w-full"
              >
                Choose Another Plan
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
