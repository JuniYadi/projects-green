"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowCounterClockwise,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  FileText,
  Receipt,
  Sparkle,
  Wallet,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  getCatalogProduct,
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

function formatCurrency(amount: string, currency: string = "IDR"): string {
  const safeCurrency = currency?.trim() ? currency.trim().toUpperCase() : "IDR"
  const value = Number(amount)
  return new Intl.NumberFormat(safeCurrency === "USD" ? "en-US" : "id-ID", {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: safeCurrency === "USD" ? 2 : 0,
  }).format(Number.isNaN(value) ? 0 : value)
}

type ProvisioningFieldDef = {
  id: string
  name: string
  label: string
  type: string
  placeholder?: string
  required?: boolean
}

export type ServiceOrderDialogProps = {
  productCode: string
  productTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ServiceOrderDialog({
  productCode,
  productTitle,
  open,
  onOpenChange,
  onSuccess,
}: ServiceOrderDialogProps) {
  const [catalogData, setCatalogData] =
    useState<CatalogProductDetailResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)

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
        setCatalogError(
          err instanceof Error ? err.message : "Gagal memuat katalog paket."
        )
      } finally {
        if (isMounted) setCatalogLoading(false)
      }
    }

    void loadCatalog()

    return () => {
      isMounted = false
    }
  }, [open, productCode])

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
            setVoucherError(result.message || "Voucher tidak valid")
          } else {
            setQuoteError(result.message || "Gagal memuat rincian harga paket")
          }
        }
      } catch {
        setQuoteError("Terjadi kendala saat menghitung biaya.")
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
  const dynamicFields: ProvisioningFieldDef[] =
    Array.isArray(resources.provisioningFields) &&
    (resources.provisioningFields as ProvisioningFieldDef[]).length > 0
      ? (resources.provisioningFields as ProvisioningFieldDef[])
      : productCode.toUpperCase() === "WHATSAPP"
        ? [
            {
              id: "field-phone",
              name: "phoneNumber",
              label: "Nomor WhatsApp Device",
              type: "text",
              placeholder: "Contoh: +6281234567890",
              required: true,
            },
            {
              id: "field-name",
              name: "displayName",
              label: "Nama Tampilan Device (Opsional)",
              type: "text",
              placeholder: "Contoh: Customer Support Line",
              required: false,
            },
          ]
        : []
  const hasMissingRequiredFields = dynamicFields.some((f) => {
    if (!f.required) return false
    const val = (formData[f.name] ?? "").trim()
    return !val
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
      const result = await submitCheckout({
        pricingId: selectedPricingId,
        quoteToken: quotePreview.quoteToken,
        addonIds: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
        voucherCode: appliedVoucher || undefined,
        idempotencyKey,
        device:
          formData.phoneNumber || formData.displayName
            ? {
                phoneNumber: formData.phoneNumber || "",
                displayName: formData.displayName || undefined,
              }
            : undefined,
        metadata: Object.keys(formData).length > 0 ? formData : undefined,
      })
      if (result.ok) {
        setSubmitSuccess(result)
        toast.success("Aktivasi layanan berhasil!", {
          description: `Order ${result.orderId} telah terbayar dan kuitansi invoice telah dikirimkan ke email billing Anda.`,
        })
        onSuccess?.()
      } else {
        setSubmitError(
          result.message || "Gagal mengaktifkan layanan. Silakan coba kembali."
        )
        toast.error("Gagal mengaktifkan layanan", {
          description: result.message,
        })
      }
    } catch {
      setSubmitError("Terjadi kesalahan sistem saat memproses transaksi.")
      toast.error("Terjadi kesalahan sistem saat memproses aktivasi.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4 text-left">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {productCode}
            </Badge>
            {quotePreview?.billingPeriod && (
              <Badge variant="secondary" className="text-xs">
                {quotePreview.billingPeriod}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg font-semibold">
            {submitSuccess
              ? "Layanan Berhasil Diaktifkan!"
              : `Aktivasi & Sambungkan ${productTitle || productInfo?.name || productCode}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {submitSuccess
              ? "Langganan Anda aktif dan siap langsung digunakan pada dashboard ini."
              : "Pilih paket langganan dan selesaikan aktivasi langsung tanpa berpindah halaman."}
          </DialogDescription>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {submitSuccess ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle className="h-8 w-8" weight="fill" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold">
                  Aktivasi Instan Sukses!
                </h3>
                <p className="text-xs text-muted-foreground">
                  Order ID: {submitSuccess.ok ? submitSuccess.orderId : ""}
                </p>
              </div>

              {/* Email & Invoice Notice Alert */}
              <Alert className="border-emerald-200 bg-emerald-50 text-left text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                <EnvelopeSimple className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription className="ml-2 leading-relaxed">
                  Bukti pembayaran dan kuitansi resmi telah dikirim ke email
                  penanggung jawab billing organisasi Anda.
                </AlertDescription>
              </Alert>

              {/* Order & Payment Summary Card */}
              <div className="space-y-2.5 rounded-lg border bg-muted/40 p-4 text-left text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Status Pesanan</span>
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-600"
                  >
                    {submitSuccess.ok ? submitSuccess.status : "CHARGED"}
                  </Badge>
                </div>
                {submitSuccess.ok && submitSuccess.subscriptionId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ID Langganan</span>
                    <span className="font-mono text-[11px]">
                      {submitSuccess.subscriptionId}
                    </span>
                  </div>
                )}
                {submitSuccess.ok && submitSuccess.invoiceId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nomor Invoice</span>
                    <Link
                      href={`/console/billing/invoices/${submitSuccess.invoiceId}`}
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
                      Masa Aktif s/d
                    </span>
                    <span className="font-medium">
                      {new Date(submitSuccess.periodEnd).toLocaleDateString(
                        "id-ID",
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
                    Total Pembayaran
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

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                {submitSuccess.ok && submitSuccess.invoiceId && (
                  <Button variant="outline" asChild className="flex-1">
                    <Link
                      href={`/console/billing/invoices/${submitSuccess.invoiceId}`}
                      target="_blank"
                    >
                      <FileText className="mr-1.5 h-4 w-4" />
                      Lihat Invoice
                    </Link>
                  </Button>
                )}
                <Button onClick={() => onOpenChange(false)} className="flex-1">
                  Selesai & Gunakan Layanan
                </Button>
              </div>
            </div>
          ) : catalogLoading ? (
            <div className="space-y-4 px-6 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : catalogError ? (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">
                {catalogError}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Plan Selection Cards */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  PILIH PAKET LAYANAN
                </Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                                Terpilih
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
                                /{offer.billingPeriod.toLowerCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Term switcher if the selected plan has multiple terms */}
              {selectedPlan?.offers && selectedPlan.offers.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    PERIODE PEMBAYARAN
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
                          <div>{offer.billingPeriod}</div>
                          <div className="text-[11px]">
                            {formatCurrency(offer.periodPrice, offer.currency)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Service Configuration / Provisioning Fields */}
              {dynamicFields.length > 0 && (
                <div className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkle className="h-4 w-4 text-primary" />
                    <span>Konfigurasi Layanan</span>
                  </div>
                  <div className="space-y-3">
                    {dynamicFields.map((field) => (
                      <div key={field.name} className="space-y-1.5">
                        <Label
                          htmlFor={`order-field-${field.name}`}
                          className="text-xs"
                        >
                          {field.label}
                          {field.required && (
                            <span className="text-destructive"> *</span>
                          )}
                        </Label>
                        <Input
                          id={`order-field-${field.name}`}
                          name={field.name}
                          data-testid={`order-input-${field.name}`}
                          type={field.type === "number" ? "number" : "text"}
                          placeholder={
                            field.placeholder ||
                            (field.name === "phoneNumber"
                              ? "Contoh: +6281234567890"
                              : undefined)
                          }
                          value={formData[field.name] || ""}
                          onChange={(e) => {
                            const nextVal = e.target.value
                            setFormData((prev) => ({
                              ...prev,
                              [field.name]: nextVal,
                            }))
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
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

              {/* Available Addons */}
              {quotePreview?.availableAddons &&
                quotePreview.availableAddons.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      ADD-ONS OPSIONAL
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

              {/* Voucher Code Form */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  KODE PROMO / VOUCHER
                </Label>
                {appliedVoucher ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Sparkle className="h-4 w-4 text-emerald-600" />
                      <span>Voucher aktif: {appliedVoucher}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveVoucher}
                      className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Hapus
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyVoucher} className="flex gap-2">
                    <Input
                      placeholder="Masukkan kode promo"
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
                      Terapkan
                    </Button>
                  </form>
                )}
                {voucherError && (
                  <p className="text-[11px] text-destructive">{voucherError}</p>
                )}
              </div>

              {/* Summary Breakdown */}
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-xs">
                <div className="font-medium text-foreground">
                  Ringkasan Biaya
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
                        {selectedPlan?.name || "Paket"} (
                        {quotePreview.billingPeriod})
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
                        <span>Diskon Voucher</span>
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
                      <span>Total Pembayaran</span>
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
                        Perpanjangan:{" "}
                        {quotePreview.nextRenewal
                          ? new Date(
                              quotePreview.nextRenewal
                            ).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Wallet Balance Gate Notice */}
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span>Metode Pembayaran: Saldo Wallet</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Total tagihan akan langsung dipotong dari saldo akun Anda
                  secara instan.
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
                    Saya menyetujui pemotongan saldo untuk aktivasi layanan ini.
                  </Label>
                </div>
              </div>

              {/* Submit Error */}
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    {submitError}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!submitSuccess && (
          <div className="flex items-center justify-end gap-2 border-t bg-background px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
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
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <ArrowCounterClockwise className="h-4 w-4 animate-spin" />
                  Memproses Aktivasi...
                </span>
              ) : (
                "Aktifkan Layanan Sekarang"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
