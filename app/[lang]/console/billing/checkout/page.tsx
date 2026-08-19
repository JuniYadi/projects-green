"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const pricingId = searchParams.get("pricingId") || ""
  const [idempotencyKey] = useState(
    () =>
      `checkout:${pricingId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
  )
  const [quote, setQuote] = useState<CheckoutResult | null>(null)
  const [quotePreview, setQuotePreview] = useState<CheckoutPreview | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [addonIds, setAddonIds] = useState<string[]>([])
  const [voucherCode, setVoucherCode] = useState("")
  const [voucherInput, setVoucherInput] = useState("")
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
  const hasPricing = Boolean(pricingId)

  const requestQuote = useCallback(
    async (nextAddonIds: string[], nextVoucherCode: string) => {
      if (!pricingId) return
      setQuoteLoading(true)
      setQuoteError(null)
      const result = await getCheckoutQuote({
        pricingId,
        addonIds: nextAddonIds,
        voucherCode: nextVoucherCode || undefined,
        idempotencyKey,
      })
      if (result.ok) {
        setQuotePreview(result)
      } else {
        setQuotePreview(null)
        setQuoteError(
          result.error === "BILLING_CURRENCY_MISMATCH"
            ? "This balance-credit voucher must match your billing account currency. The voucher claim was not consumed."
            : result.message
        )
      }
      setQuoteLoading(false)
    },
    [idempotencyKey, pricingId, setQuoteError, setQuoteLoading, setQuotePreview]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void requestQuote([], "")
    }, 0)
    return () => window.clearTimeout(timer)
  }, [requestQuote])

  const handleAddonChange = (addonId: string, checked: boolean) => {
    const nextAddonIds = checked
      ? [...addonIds, addonId]
      : addonIds.filter((id) => id !== addonId)
    setAddonIds(nextAddonIds)
    void requestQuote(nextAddonIds, voucherCode)
  }

  const handleApplyVoucher = () => {
    const nextVoucherCode = voucherInput.trim().toUpperCase()
    setVoucherCode(nextVoucherCode)
    void requestQuote(addonIds, nextVoucherCode)
  }

  const handleCheckout = async (): Promise<void> => {
    if (!pricingId) return
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
        pricingId,
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
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium">{quotePreview.packageCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{quotePreview.planCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Billing Period</span>
              <span className="font-medium">{quotePreview.billingPeriod}</span>
            </div>
            {showDynamicForm && (
              <div className="space-y-4 rounded-md border bg-card p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">
                    Device & Service Provisioning Configuration
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure details required to activate and provision your
                    service upon payment.
                  </p>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
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
                      if (field.name === "phoneNumber") setPhoneNumber(nextVal)
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
                              onChangeVal((e.target as HTMLInputElement).value)
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
              </div>
            )}
            {addonOptions.length > 0 && (
              <fieldset className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">Add-ons</legend>
                {addonOptions.map((addon) => (
                  <div key={addon.id} className="flex items-start gap-2">
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
                    <Label htmlFor={`addon-${addon.id}`}>
                      <span className="font-medium">{addon.name}</span>
                      <span className="ml-2 text-muted-foreground">
                        {formatCurrency(addon.price, addon.currency)}
                        {addon.required ? " · Required" : ""}
                      </span>
                    </Label>
                  </div>
                ))}
              </fieldset>
            )}

            <div className="space-y-2">
              <Label htmlFor="voucher-code">Voucher code</Label>
              <div className="flex gap-2">
                <input
                  id="voucher-code"
                  value={voucherInput}
                  onChange={(event) => setVoucherInput(event.target.value)}
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
              {quotePreview.voucher && (
                <p className="text-xs text-muted-foreground">
                  {quotePreview.voucher.code} expires{" "}
                  {formatDate(quotePreview.voucher.quoteExpiresAt)}
                </p>
              )}
            </div>

            {quotePreview.isProrated && (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
                <p className="font-semibold">
                  Prorated Billing (Calendar Month)
                </p>
                <p className="mt-0.5">
                  Charged for {quotePreview.proratedDays} remaining days in this
                  month (out of {quotePreview.totalDaysInPeriod} days). Your
                  first regular full renewal begins on{" "}
                  {formatDate(quotePreview.nextRenewal)}.
                </p>
              </div>
            )}

            <div className="space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {quotePreview.isProrated ? "Prorated Subtotal" : "Subtotal"}
                </span>
                <span>
                  {formatCurrency(quotePreview.subtotal, quotePreview.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>
                  {formatCurrency(quotePreview.discount, quotePreview.currency)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>First payment</span>
                <span>
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
            <div className="mt-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-terms"
                  checked={confirmed}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                />
                <Label htmlFor="confirm-terms" className="text-xs">
                  I confirm this purchase and agree to the recurring billing
                  terms.
                </Label>
              </div>

              <Button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={
                  !confirmed || quoteLoading || hasMissingRequiredFields
                }
                className="w-full"
              >
                Confirm and pay
              </Button>
            </div>
          </CardContent>
        </Card>
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
