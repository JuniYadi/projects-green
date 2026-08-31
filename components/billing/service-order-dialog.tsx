"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowCounterClockwise,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  FileText,
  Lightning,
  Receipt,
  Sparkle,
  Wallet,
  Warning,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  getAccount,
  getCatalogProduct,
  type BillingAccount,
  type CatalogPlan,
  type CatalogProduct,
  type CatalogProductDetailResponse,
} from "@/lib/billing-client"
import {
  getCheckoutQuote,
  submitCheckout,
  type CheckoutPreview,
  type CheckoutResult,
} from "@/app/[lang]/console/billing/checkout/checkout-client"
import Link from "next/link"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppMessages } from "@/lib/i18n/messages/types"
import {
  ProvisioningFieldDef,
  ProvisioningFormField,
  matchesPattern,
} from "@/components/billing/provisioning-form-field"
import { QuickTopUpDialog } from "@/components/billing/quick-top-up-dialog"

type ServiceOrderMessages = AppMessages["console"]["billing"]["serviceOrder"]

function formatCurrency(amount: string, currency: string = "IDR"): string {
  const safeCurrency = currency?.trim() ? currency.trim().toUpperCase() : "IDR"
  const value = Number(amount)
  return new Intl.NumberFormat(safeCurrency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: safeCurrency === "USD" ? 2 : 0,
  }).format(Number.isNaN(value) ? 0 : value)
}
function formatPeriodLabel(period: string, t: ServiceOrderMessages): string {
  const upper = period?.toUpperCase() || ""
  if (upper === "MONTHLY") return t.periodMonthly || "Bulanan"
  if (upper === "ANNUAL" || upper === "YEARLY")
    return t.periodAnnual || "Tahunan"
  if (upper === "DAILY") return t.periodDaily || "Harian"
  if (upper === "QUARTERLY") return t.periodQuarterly || "Triwulanan"
  if (upper === "WEEKLY") return t.periodWeekly || "Mingguan"
  return period
}

export type ServiceOrderDialogProps = {
  productCode: string
  productTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  lang?: string
  messages?: ServiceOrderMessages
  onSuccess?: () => void
}

export function ServiceOrderDialog({
  productCode,
  productTitle,
  open,
  onOpenChange,
  lang,
  messages,
  onSuccess,
}: ServiceOrderDialogProps) {
  const locale = resolveLocaleOrDefault(lang ?? "en")
  const t =
    messages ??
    getMessages(locale)?.console?.billing?.serviceOrder ??
    getMessages("en").console.billing.serviceOrder
  const [catalogData, setCatalogData] =
    useState<CatalogProductDetailResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const [accountData, setAccountData] = useState<BillingAccount | null>(null)
  const [quickTopUpOpen, setQuickTopUpOpen] = useState(false)

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedPricingId, setSelectedPricingId] = useState<string | null>(
    null
  )
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])

  const [voucherInput, setVoucherInput] = useState("")
  const [appliedVoucher, setAppliedVoucher] = useState("")
  const [voucherError, setVoucherError] = useState<string | null>(null)

  const [quotePreview, setQuotePreview] = useState<CheckoutPreview | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<CheckoutResult | null>(
    null
  )

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [idempotencyKey] = useState(() => `order:${productCode}:${Date.now()}`)

  const loadAccount = useCallback(async () => {
    try {
      const acc = await getAccount()
      if (acc?.ok) {
        setAccountData(acc)
      }
    } catch {
      // transient balance fetch failure
    }
  }, [])
  // 1. Fetch catalog when modal opens
  useEffect(() => {
    if (!open || !productCode) return

    let isMounted = true
    const loadCatalog = async () => {
      setCatalogLoading(true)
      setCatalogError(null)
      setSubmitSuccess(null)
      setSubmitError(null)
      setConfirmed(false)
      setFormData({})

      try {
        const res = await getCatalogProduct(productCode.toUpperCase())
        if (!isMounted) return
        setCatalogData(res)
        const product =
          res.product ||
          (res as unknown as { product?: CatalogProduct }).product
        const firstPlan = product?.plans?.[0]
        if (firstPlan) {
          setSelectedPlanId(firstPlan.id)
          const firstOffer = firstPlan.offers?.[0]
          if (firstOffer) {
            const offerObj = firstOffer as unknown as {
              id?: string
              pricingId?: string
            }
            const pId = offerObj.pricingId || offerObj.id || null
            setSelectedPricingId(pId)
          }
        }
      } catch (err) {
        if (!isMounted) return
        setCatalogError(err instanceof Error ? err.message : t.activationError)
      } finally {
        if (isMounted) setCatalogLoading(false)
      }
    }
    void loadCatalog()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccount()
    return () => {
      isMounted = false
    }
  }, [open, productCode, loadAccount])
  // 2. Fetch checkout quote when pricing/addons/voucher changes
  const loadQuote = useCallback(
    async (pricingIdToQuote: string, addons: string[], voucher: string) => {
      if (!pricingIdToQuote) return

      setQuoteLoading(true)
      setQuoteError(null)
      setVoucherError(null)

      try {
        const result = await getCheckoutQuote({
          pricingId: pricingIdToQuote,
          addonIds: addons.length > 0 ? addons : undefined,
          voucherCode: voucher.trim() || undefined,
          idempotencyKey: `quote:${pricingIdToQuote}:${Date.now()}`,
        })

        if (result.ok) {
          setQuotePreview(result)
        } else {
          if (
            result.error?.startsWith("VOUCHER_") ||
            result.error === "BILLING_CURRENCY_MISMATCH"
          ) {
            setVoucherError(result.message || t.activationError)
          } else {
            setQuoteError(result.message || t.activationError)
          }
        }
      } catch {
        setQuoteError(t.systemError)
      } finally {
        setQuoteLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!open || !selectedPricingId) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQuote(selectedPricingId, selectedAddonIds, appliedVoucher)
  }, [open, selectedPricingId, selectedAddonIds, appliedVoucher, loadQuote])

  const productInfo = catalogData?.product
  const plansList = productInfo?.plans || []
  const selectedPlan = plansList.find((p) => p.id === selectedPlanId)

  const handlePlanSelect = (plan: CatalogPlan) => {
    setSelectedPlanId(plan.id)
    const offer = plan.offers?.[0]
    if (offer) {
      const offerObj = offer as unknown as { id?: string; pricingId?: string }
      setSelectedPricingId(offerObj.pricingId || offerObj.id || null)
    }
  }

  const resources = (quotePreview?.resources ?? {}) as Record<string, unknown>
  const dynamicFields: ProvisioningFieldDef[] = Array.isArray(
    resources.provisioningFields
  )
    ? (resources.provisioningFields as ProvisioningFieldDef[])
    : []
  const hasMissingRequiredFields = dynamicFields.some((f) => {
    const val = (formData[f.name] ?? "").trim()
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
  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault()
    if (!voucherInput.trim()) return
    setAppliedVoucher(voucherInput.trim().toUpperCase())
  }

  const handleRemoveVoucher = () => {
    setAppliedVoucher("")
    setVoucherInput("")
    setVoucherError(null)
  }

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    )
  }

  const handleCheckoutSubmit = async () => {
    if (!selectedPricingId || !quotePreview) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Answers are scoped to the fields currently defined by the selected
      // product (plan) so stale values from other plans never get submitted.
      const provisioningAnswers: Record<string, string> = {}
      for (const field of dynamicFields) {
        const value = (formData[field.name] ?? "").trim()
        if (value) provisioningAnswers[field.name] = value
      }
      const result = await submitCheckout({
        pricingId: selectedPricingId,
        quoteToken: quotePreview.quoteToken,
        addonIds: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
        voucherCode: appliedVoucher || undefined,
        idempotencyKey,
        device: provisioningAnswers.phoneNumber
          ? {
              phoneNumber: provisioningAnswers.phoneNumber,
              displayName: provisioningAnswers.displayName || undefined,
              profilePictureUrl:
                provisioningAnswers.profilePictureUrl ||
                provisioningAnswers.profilePicture ||
                undefined,
            }
          : undefined,
        metadata:
          Object.keys(provisioningAnswers).length > 0
            ? {
                provisioningAnswers,
                provisioningFieldsSchema: dynamicFields.map((f) => ({
                  name: f.name,
                  label: f.label,
                  type: f.type,
                })),
              }
            : undefined,
      })
      if (result.ok) {
        setSubmitSuccess(result)
        toast.success(t.successToast, {
          description: t.successToastDescription.replace(
            "{orderId}",
            result.orderId
          ),
        })
        onSuccess?.()
      } else {
        setSubmitError(result.message || t.activationError)
        toast.error(t.activationError, { description: result.message })
      }
    } catch {
      setSubmitError(t.systemError)
      toast.error(t.systemError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[92vh] min-h-[560px] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        >
          {/* Header */}
          <DialogHeader className="relative border-b px-6 py-4 text-left">
            <div className="flex items-center gap-2 pr-10">
              <Badge variant="outline" className="text-xs">
                {productCode}
              </Badge>
              {quotePreview?.billingPeriod && (
                <Badge variant="secondary" className="text-xs">
                  {formatPeriodLabel(quotePreview.billingPeriod, t)}
                </Badge>
              )}
            </div>
            <DialogTitle className="pr-10 text-lg font-semibold">
              {submitSuccess
                ? t.activationSuccessTitle
                : t.activationTitle.replace(
                    "{service}",
                    productTitle || productInfo?.name || productCode
                  )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {submitSuccess ? t.receiptNotice : t.activationDescription}
            </DialogDescription>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-4 right-4 bg-secondary"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">{t.close}</span>
              </Button>
            </DialogClose>
          </DialogHeader>

          {submitSuccess ? (
            /* ── Success state: single column (unchanged) ── */
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4 py-2 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle className="h-8 w-8" weight="fill" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">
                    {t.successHeading}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {`${t.orderId} ${submitSuccess.ok ? submitSuccess.orderId : ""}`}
                  </p>
                </div>

                <Alert className="border-emerald-200 bg-emerald-50 text-left text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <EnvelopeSimple className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertDescription className="ml-2 leading-relaxed">
                    {t.receiptNotice}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2.5 rounded-lg border bg-muted/40 p-4 text-left text-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground">
                      {t.orderStatus}
                    </span>
                    <Badge
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-600"
                    >
                      {submitSuccess.ok ? submitSuccess.status : "CHARGED"}
                    </Badge>
                  </div>
                  {submitSuccess.ok && submitSuccess.subscriptionId && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t.subscriptionId}
                      </span>
                      <span className="font-mono text-[11px]">
                        {submitSuccess.subscriptionId}
                      </span>
                    </div>
                  )}
                  {submitSuccess.ok && submitSuccess.invoiceId && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t.invoiceNumber}
                      </span>
                      <Link
                        href={localizePathname({
                          pathname: `/console/billing/invoices/${submitSuccess.invoiceId}`,
                          locale,
                        })}
                        target="_blank"
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        {submitSuccess.invoiceId}
                      </Link>
                    </div>
                  )}
                  {submitSuccess.ok && submitSuccess.periodEnd && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t.activeUntil}
                      </span>
                      <span className="font-medium">
                        {new Date(submitSuccess.periodEnd).toLocaleDateString(
                          locale === "id" ? "id-ID" : "en-US",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-muted-foreground">
                      {t.totalPayment}
                    </span>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      {submitSuccess.ok
                        ? formatCurrency(
                            submitSuccess.firstPayment,
                            submitSuccess.currency
                          )
                        : "-"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  {submitSuccess.ok && submitSuccess.invoiceId && (
                    <Button variant="outline" asChild className="flex-1">
                      <Link
                        href={localizePathname({
                          pathname: `/console/billing/invoices/${submitSuccess.invoiceId}`,
                          locale,
                        })}
                        target="_blank"
                      >
                        <FileText className="mr-1.5 h-4 w-4" />
                        {t.viewInvoice}
                      </Link>
                    </Button>
                  )}
                  <Button
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                  >
                    {t.finishAndUse}
                  </Button>
                </div>
              </div>
            </div>
          ) : catalogLoading ? (
            <div className="flex-1 space-y-4 px-6 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : catalogError ? (
            <div className="flex-1 px-6 py-4">
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {catalogError}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            /* ── 2-column layout ── */
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* ── LEFT: Plan selection + Service config ── */}
              <div className="flex flex-1 flex-col gap-4 overflow-hidden border-r px-6 py-5">
                {/* Plan Selection Cards */}
                <div className="shrink-0 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t.choosePlan}
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {plansList.map((plan) => {
                      const isSelected = plan.id === selectedPlanId
                      const offer = plan.offers?.[0]
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => handlePlanSelect(plan)}
                          className={`flex flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "bg-card hover:border-border/80"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">
                                {plan.name}
                              </span>
                              {isSelected && (
                                <Badge
                                  variant="default"
                                  className="h-4 px-1.5 text-[10px]"
                                >
                                  {t.selected}
                                </Badge>
                              )}
                            </div>
                            <p className="line-clamp-2 text-[11px] text-muted-foreground">
                              {plan.description}
                            </p>
                          </div>
                          <div className="pt-3">
                            {offer && (
                              <div className="text-xs">
                                <span className="font-bold text-foreground">
                                  {formatCurrency(
                                    offer.periodPrice,
                                    offer.currency
                                  )}
                                </span>
                                <span className="text-muted-foreground">
                                  /
                                  {formatPeriodLabel(
                                    offer.billingPeriod,
                                    t
                                  ).toLowerCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Term switcher */}
                {selectedPlan?.offers && selectedPlan.offers.length > 1 && (
                  <div className="shrink-0 space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t.billingPeriod}
                    </Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {selectedPlan.offers.map((offer) => {
                        const offerObj = offer as unknown as {
                          id?: string
                          pricingId?: string
                        }
                        const offerId = offerObj.pricingId || offerObj.id || ""
                        const isSelected = offerId === selectedPricingId
                        return (
                          <button
                            key={offerId}
                            type="button"
                            onClick={() => setSelectedPricingId(offerId)}
                            className={`rounded-lg border p-2 text-center text-xs transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 font-semibold text-primary"
                                : "text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <div>
                              {formatPeriodLabel(offer.billingPeriod, t)}
                            </div>
                            <div className="text-[11px]">
                              {formatCurrency(
                                offer.periodPrice,
                                offer.currency
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Dynamic Service Configuration (scrollable container) */}
                {dynamicFields.length > 0 && (
                  <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card p-4">
                    <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Sparkle className="h-4 w-4 text-primary" />
                      <span>{t.serviceConfiguration}</span>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      {dynamicFields.map((field) => (
                        <ProvisioningFormField
                          key={field.id || field.name}
                          field={field}
                          value={formData[field.name] || ""}
                          onChange={(nextVal) =>
                            setFormData((prev) => ({
                              ...prev,
                              [field.name]: nextVal,
                            }))
                          }
                          testIdPrefix="order"
                          idPrefix="order-field"
                          validationErrorMessage={t.invalidField}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Addons */}
                {quotePreview?.availableAddons &&
                  quotePreview.availableAddons.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {t.optionalAddons}
                      </Label>
                      <div className="space-y-2">
                        {quotePreview.availableAddons.map((addon) => {
                          const isChecked = selectedAddonIds.includes(addon.id)
                          return (
                            <div
                              key={addon.id}
                              className={`flex items-center justify-between rounded-lg border p-3 text-xs transition-colors ${
                                isChecked
                                  ? "border-primary/50 bg-primary/5"
                                  : "bg-card"
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  id={`addon-${addon.id}`}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAddon(addon.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <div>
                                  <label
                                    htmlFor={`addon-${addon.id}`}
                                    className="cursor-pointer font-medium text-foreground"
                                  >
                                    {addon.name}
                                  </label>
                                  {addon.description && (
                                    <p className="text-[11px] text-muted-foreground">
                                      {addon.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="font-semibold text-foreground">
                                +{formatCurrency(addon.price, addon.currency)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                {/* Quote Error */}
                {quoteError && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">
                      {quoteError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* ── RIGHT: Summary + Voucher + CTA (sticky, no scroll) ── */}
              <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l bg-muted px-5 py-5">
                {/* Cost Summary */}
                <div className="space-y-2 rounded-lg border bg-background p-3 text-xs">
                  <div className="font-medium text-foreground">
                    {t.costSummary}
                  </div>
                  {quoteLoading && !quotePreview ? (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : quotePreview ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          {selectedPlan?.name || t.choosePlan} (
                          {formatPeriodLabel(quotePreview.billingPeriod, t)})
                        </span>
                        <span>
                          {formatCurrency(
                            quotePreview.subtotal,
                            quotePreview.currency
                          )}
                        </span>
                      </div>

                      {Number(quotePreview.discount) > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>{t.voucherDiscount}</span>
                          <span>
                            -
                            {formatCurrency(
                              quotePreview.discount,
                              quotePreview.currency
                            )}
                          </span>
                        </div>
                      )}

                      {quotePreview.addons.map((addon) => (
                        <div
                          key={addon.id}
                          className="flex justify-between text-muted-foreground"
                        >
                          <span>+ {addon.name}</span>
                          <span>
                            {formatCurrency(addon.price, quotePreview.currency)}
                          </span>
                        </div>
                      ))}

                      <div className="flex justify-between border-t pt-2 text-sm font-semibold text-foreground">
                        <span>{t.totalPayment}</span>
                        <span className="text-base text-primary">
                          {formatCurrency(
                            quotePreview.firstPayment,
                            quotePreview.currency
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {t.renewal}{" "}
                          {quotePreview.nextRenewal
                            ? new Date(
                                quotePreview.nextRenewal
                              ).toLocaleDateString(
                                locale === "id" ? "id-ID" : "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "-"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Voucher */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t.promoCode}
                  </Label>
                  {appliedVoucher ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Sparkle className="h-4 w-4 text-emerald-600" />
                        <span>
                          {t.activeVoucher} {appliedVoucher}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveVoucher}
                        className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                      >
                        {t.remove}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyVoucher} className="flex gap-2">
                      <Input
                        placeholder={t.promoPlaceholder}
                        value={voucherInput}
                        onChange={(e) => setVoucherInput(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={!voucherInput.trim()}
                        className="h-8 text-xs"
                      >
                        {t.apply}
                      </Button>
                    </form>
                  )}
                  {voucherError && (
                    <p className="text-[11px] text-destructive">
                      {voucherError}
                    </p>
                  )}
                </div>

                {/* Wallet & Balance Status */}
                {(() => {
                  const totalCost = Number(quotePreview?.firstPayment || 0)
                  const currentBalanceNum = Number(accountData?.balanceIdr || 0)
                  const isInsufficient =
                    !quoteLoading &&
                    Boolean(quotePreview) &&
                    currentBalanceNum < totalCost
                  const shortage = Math.max(0, totalCost - currentBalanceNum)
                  const currencyCode =
                    quotePreview?.currency || accountData?.currency || "IDR"

                  return (
                    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                      <div className="flex items-center justify-between font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-primary" />
                          <span>{t.walletPaymentMethod}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded border bg-background/80 px-2.5 py-1.5 text-[11px]">
                        <span className="text-muted-foreground">
                          {t.currentBalance}
                        </span>
                        <span className="font-semibold text-foreground">
                          {accountData?.formattedBalance ||
                            formatCurrency(
                              String(currentBalanceNum),
                              currencyCode
                            )}
                        </span>
                      </div>

                      {isInsufficient && (
                        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-900 dark:text-amber-300">
                          <div className="flex items-start gap-1.5">
                            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div className="space-y-0.5">
                              <p className="leading-tight font-semibold">
                                {t.insufficientBalance}
                              </p>
                              <p className="text-muted-foreground">
                                {t.shortageAmount.replace(
                                  "{amount}",
                                  formatCurrency(String(shortage), currencyCode)
                                )}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => setQuickTopUpOpen(true)}
                            className="h-7 w-full gap-1.5 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <Lightning className="size-3.5" weight="fill" />
                            <span>
                              {t.quickTopUp} (+
                              {formatCurrency(String(shortage), currencyCode)})
                            </span>
                          </Button>
                        </div>
                      )}

                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {t.walletPaymentDescription}
                      </p>
                      <div className="flex items-center space-x-2 pt-1">
                        <input
                          id="order-confirm-balance"
                          data-testid="order-confirm-balance-checkbox"
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label
                          htmlFor="order-confirm-balance"
                          className="cursor-pointer text-[11px] text-foreground"
                        >
                          {t.walletAgreement}
                        </Label>
                      </div>
                    </div>
                  )
                })()}

                {/* Submit Error */}
                {submitError && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">
                      {submitError}
                    </AlertDescription>
                  </Alert>
                )}

                {/* CTA Buttons */}
                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <Button
                    size="sm"
                    data-testid="order-submit-button"
                    disabled={
                      !confirmed ||
                      hasMissingRequiredFields ||
                      isSubmitting ||
                      quoteLoading ||
                      !quotePreview ||
                      !selectedPricingId
                    }
                    onClick={handleCheckoutSubmit}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <ArrowCounterClockwise className="h-4 w-4 animate-spin" />
                        {t.processingActivation}
                      </span>
                    ) : (
                      t.subscribeAction || "Langganan Sekarang"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {t.cancel}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <QuickTopUpDialog
        open={quickTopUpOpen}
        onOpenChange={setQuickTopUpOpen}
        currentBalance={accountData?.formattedBalance}
        suggestedAmount={
          Math.max(
            0,
            Number(quotePreview?.firstPayment || 0) -
              Number(accountData?.balanceIdr || 0)
          ) || undefined
        }
        currency={(quotePreview?.currency as "IDR" | "USD") || "IDR"}
        lang={locale}
        onSuccess={() => {
          void loadAccount()
          toast.success("Saldo berhasil diperbarui!")
        }}
      />
    </>
  )
}
