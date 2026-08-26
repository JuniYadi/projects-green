"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { eden } from "@/lib/eden"
import { getInvoice } from "@/lib/billing-client"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppMessages } from "@/lib/i18n/messages/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckCircle,
  Copy,
  Lightning,
  QrCodeIcon,
  HandCoinsIcon,
  ArrowsClockwise,
  ArrowsOutSimple,
} from "@/components/ui/phosphor-icons"

type ExpressTopupMessages = AppMessages["console"]["billing"]["expressTopUp"]

export type ExpressTopupModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBalance?: string | number | null
  suggestedAmount?: number
  currency?: "IDR" | "USD"
  lang?: string
  messages?: ExpressTopupMessages
  onSuccess?: () => void
}

type InstantMethod = "QRIS" | "VA"

type Step = "select" | "payment" | "success"

interface CurrencyConfig {
  symbol: string
  ratePerBase: number
  baseCode: string
  presets: number[]
  minTopup: number
  maxTopup: number
}

const INSTANT_METHODS: {
  value: InstantMethod
  icon: React.ElementType
}[] = [
  { value: "QRIS", icon: QrCodeIcon },
  { value: "VA", icon: HandCoinsIcon },
]

export function ExpressTopupModal({
  open,
  onOpenChange,
  currentBalance,
  suggestedAmount,
  currency = "IDR",
  lang,
  messages,
  onSuccess,
}: ExpressTopupModalProps) {
  const t =
    messages ??
    getMessages(resolveLocaleOrDefault(lang)).console.billing.expressTopUp
  const methodMessages: Record<
    InstantMethod,
    { label: string; description: string }
  > = {
    QRIS: { label: t.qrisMethod, description: t.qrisMethodDescription },
    VA: {
      label: t.virtualAccountMethod,
      description: t.virtualAccountMethodDescription,
    },
  }
  const [step, setStep] = useState<Step>("select")
  const [selectedMethod, setSelectedMethod] = useState<InstantMethod>("QRIS")
  const [amount, setAmount] = useState<number>(suggestedAmount || 50000)
  const [customAmount, setCustomAmount] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Payment details after creation
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [vaNumber, setVaNumber] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig>({
    symbol: currency === "USD" ? "$" : "Rp",
    ratePerBase: currency === "USD" ? 1 : 18000,
    baseCode: "USD",
    presets:
      currency === "USD" ? [10, 25, 50, 100] : [50000, 100000, 250000, 500000],
    minTopup: currency === "USD" ? 10 : 25000,
    maxTopup: currency === "USD" ? 10000 : 50000000,
  })

  // Sync initial presets when modal opens or currency/suggestedAmount changes
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("select")
      setErrorMessage(null)
      setInvoiceId(null)
      setInvoiceNumber(null)
      setPaymentUrl(null)
      setQrCodeDataUrl(null)
      setVaNumber(null)

      if (suggestedAmount && suggestedAmount > 0) {
        setAmount(suggestedAmount)
      } else {
        setAmount(currency === "USD" ? 25 : 100000)
      }

      // Fetch dynamic methods/config
      void (async () => {
        try {
          const { data } = await eden.api.payments.topup.methods.get({
            $query: { currency },
          })
          if (data?.ok && data.config) {
            setCurrencyConfig(data.config)
            if (!suggestedAmount && data.config.presets?.length > 0) {
              setAmount(data.config.presets[0])
            }
          }
        } catch {
          // Keep defaults
        }
      })()
    }
  }, [open, currency, suggestedAmount])

  // Polling for invoice status when in payment step
  const checkPaymentStatus = useCallback(
    async (id: string) => {
      try {
        const res = await getInvoice(id)
        if (res?.ok && res.invoice?.status?.toLowerCase() === "paid") {
          setStep("success")
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          onSuccess?.()
        }
      } catch {
        // Ignore transient polling errors
      }
    },
    [onSuccess]
  )

  useEffect(() => {
    if (step === "payment" && invoiceId) {
      pollingRef.current = setInterval(() => {
        void checkPaymentStatus(invoiceId)
      }, 3000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [step, invoiceId, checkPaymentStatus])

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(val)
  }

  const isValidAmount =
    amount >= currencyConfig.minTopup && amount <= currencyConfig.maxTopup

  async function handleCreateTopup() {
    if (!isValidAmount) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const { data: result } = await eden.api.payments.topup.post({
        amount,
        paymentMethod: selectedMethod,
      })

      if (!result || !result.ok || !result.invoice?.id) {
        throw new Error(result?.message || t.paymentDescription)
      }

      const invId = result.invoice.id
      setInvoiceId(invId)
      setInvoiceNumber(result.invoice.invoiceNumber || null)
      setPaymentUrl(result.paymentUrl || null)

      if (selectedMethod === "QRIS" && result.paymentUrl) {
        try {
          const qrUrl = await QRCode.toDataURL(result.paymentUrl, {
            width: 260,
            margin: 2,
            errorCorrectionLevel: "M",
          })
          setQrCodeDataUrl(qrUrl)
        } catch {
          // If QR code generation fails, paymentUrl is still available as link
        }
      }

      if (result.vaNumber) {
        setVaNumber(result.vaNumber)
      }

      setStep("payment")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.paymentDescription)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCopy(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lightning className="size-4" weight="fill" />
            </span>
            <DialogTitle className="text-lg font-semibold">
              {t.heading}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === "select" && t.selectDescription}
            {step === "payment" && t.paymentDescription}
            {step === "success" && t.successDescription}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: SELECT AMOUNT & METHOD */}
        {step === "select" && (
          <div className="space-y-4 pt-2">
            {currentBalance !== undefined && currentBalance !== null && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {t.currentBalance}
                </span>
                <span className="font-semibold text-foreground">
                  {typeof currentBalance === "number"
                    ? formatCurrency(currentBalance)
                    : currentBalance}
                </span>
              </div>
            )}

            {/* Quick Presets */}
            <Field>
              <FieldLabel className="text-xs font-medium">
                {t.chooseAmount} {currency})
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {currencyConfig.presets.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={
                      amount === preset && !customAmount ? "default" : "outline"
                    }
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => {
                      setAmount(preset)
                      setCustomAmount("")
                    }}
                  >
                    {formatCurrency(preset)}
                  </Button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  placeholder={t.customAmountPlaceholder}
                  value={customAmount}
                  onChange={(e) => {
                    const val = e.target.value
                    setCustomAmount(val)
                    const parsed = Number(val)
                    if (!isNaN(parsed) && parsed > 0) {
                      setAmount(parsed)
                    }
                  }}
                  className="h-9 text-xs"
                />
              </div>

              {!isValidAmount && amount > 0 && (
                <p className="mt-1 text-xs text-destructive">
                  {t.amountMustBeBetween}{" "}
                  {formatCurrency(currencyConfig.minTopup)} {t.amountRangeAnd}{" "}
                  {formatCurrency(currencyConfig.maxTopup)}
                </p>
              )}
            </Field>

            {/* Instant Payment Channel Selection */}
            <Field>
              <FieldLabel className="text-xs font-medium">
                {t.instantPaymentMethod}
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {INSTANT_METHODS.map((method) => {
                  const Icon = method.icon
                  const isSelected = selectedMethod === method.value
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setSelectedMethod(method.value)}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{methodMessages[method.value].label}</span>
                      </div>
                      <span className="text-[10px] leading-tight text-muted-foreground">
                        {methodMessages[method.value].description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Field>

            {errorMessage && (
              <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {errorMessage}
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 font-medium text-white hover:bg-emerald-700"
              disabled={!isValidAmount || isSubmitting}
              onClick={handleCreateTopup}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <ArrowsClockwise className="size-4 animate-spin" />
                  <span>{t.creatingPayment}</span>
                </div>
              ) : (
                t.paymentAction.replace("{amount}", formatCurrency(amount))
              )}
            </Button>
          </div>
        )}

        {/* STEP 2: PAYMENT VIEW (QRIS OR VA) */}
        {step === "payment" && (
          <div className="flex flex-col items-center space-y-4 pt-2 text-center">
            <div className="w-full rounded-lg border bg-muted/30 p-3 text-left text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">{t.totalPayment}</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(amount)}
                </span>
              </div>
              {invoiceNumber && (
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{t.invoice}</span>
                  <span className="font-mono">{invoiceNumber}</span>
                </div>
              )}
            </div>

            {selectedMethod === "QRIS" && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative rounded-xl border bg-white p-3 shadow-sm dark:bg-white">
                  {qrCodeDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCodeDataUrl}
                      className="size-48 rounded"
                      alt={t.qrCodeAlt}
                    />
                  ) : (
                    <Skeleton className="size-48" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.scanQrDescription}
                </p>
                {paymentUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="mt-1 h-8 gap-1.5 text-xs"
                  >
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{t.openPaymentPage}</span>
                      <ArrowsOutSimple className="size-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            )}

            {selectedMethod === "VA" && (
              <div className="w-full space-y-3">
                <div className="rounded-lg border bg-card p-4 text-center">
                  <span className="text-xs text-muted-foreground">
                    {t.virtualAccountNumber}
                  </span>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-wider text-foreground">
                      {vaNumber || t.paymentGatewayUnavailable}
                    </span>
                    {vaNumber && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleCopy(vaNumber)}
                      >
                        <Copy className="size-4" />
                      </Button>
                    )}
                  </div>
                  {copied && (
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      {t.copiedToClipboard}
                    </p>
                  )}
                </div>
                {paymentUrl && (
                  <Button
                    variant="default"
                    size="sm"
                    asChild
                    className="w-full gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                  >
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{t.proceedToGateway}</span>
                      <ArrowsOutSimple className="size-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            )}

            {/* Waiting for payment indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowsClockwise className="size-3.5 animate-spin text-emerald-600" />
              <span>{t.waitingForConfirmation}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (invoiceId) {
                  void checkPaymentStatus(invoiceId)
                }
              }}
            >
              {t.checkStatus}
            </Button>
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === "success" && (
          <div className="flex flex-col items-center space-y-4 py-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-8" weight="fill" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {t.paymentReceived}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t.amountAddedToWallet.replace(
                  "{amount}",
                  formatCurrency(amount)
                )}
              </p>
            </div>
            <Button
              className="w-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              onClick={() => onOpenChange(false)}
            >
              {t.continueWorking}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
