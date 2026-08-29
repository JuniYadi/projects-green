"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import Link from "next/link"
import { eden } from "@/lib/eden"
import { getInvoice } from "@/lib/billing-client"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  BuildingsIcon,
  CheckCircle,
  Copy,
  CreditCardIcon,
  Lightning,
  QrCodeIcon,
  HandCoinsIcon,
  ArrowsClockwise,
  ArrowsOutSimple,
  ReceiptIcon,
} from "@/components/ui/phosphor-icons"
export type QuickTopUpDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBalance?: string | number | null
  suggestedAmount?: number
  currency?: "IDR" | "USD"
  lang?: string
  messages?: AppMessages["console"]["billing"]["expressTopUp"]
  onSuccess?: () => void
}

type PaymentMethod = "MANUAL_BANK" | "QRIS" | "VA" | "PAYPAL"
type Step = "select" | "payment" | "success"

interface BankAccount {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  supportedCurrencies?: string[]
  swiftCode?: string | null
  bankAddress?: string | null
  isActive: boolean
  isDefault: boolean
}

interface CurrencyConfig {
  symbol: string
  ratePerBase: number
  baseCode: string
  presets: number[]
  minTopup: number
  maxTopup: number
}

const ALL_METHODS: {
  value: PaymentMethod
  icon: React.ElementType
}[] = [
  { value: "MANUAL_BANK", icon: BuildingsIcon },
  { value: "QRIS", icon: QrCodeIcon },
  { value: "VA", icon: HandCoinsIcon },
  { value: "PAYPAL", icon: CreditCardIcon },
]
export function QuickTopUpDialog({
  open,
  onOpenChange,
  currentBalance,
  suggestedAmount,
  currency = "IDR",
  lang,
  messages,
  onSuccess,
}: QuickTopUpDialogProps) {
  const locale = resolveLocaleOrDefault(lang)
  const billingMessages = getMessages(locale).console.billing
  const t = messages ?? billingMessages.expressTopUp
  const topupMessages = billingMessages.topUpForm

  const methodMessages: Record<
    PaymentMethod,
    { label: string; description: string }
  > = {
    MANUAL_BANK: {
      label: topupMessages.manualBankTransfer,
      description: topupMessages.manualTransferAvailable,
    },
    QRIS: { label: t.qrisMethod, description: t.qrisMethodDescription },
    VA: {
      label: t.virtualAccountMethod,
      description: t.virtualAccountMethodDescription,
    },
    PAYPAL: {
      label: topupMessages.paypal,
      description: topupMessages.paymentMethod,
    },
  }

  const [step, setStep] = useState<Step>("select")
  const [availableMethods, setAvailableMethods] = useState<
    Record<PaymentMethod, boolean>
  >({ MANUAL_BANK: true, QRIS: false, VA: false, PAYPAL: false })
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod>("MANUAL_BANK")
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("")
  const [isLoadingMethods, setIsLoadingMethods] = useState(true)
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
      currency === "USD" ? [5, 10, 25, 50] : [50000, 100000, 250000, 500000],
    minTopup: currency === "USD" ? 5 : 25000,
    maxTopup: currency === "USD" ? 10000 : 50000000,
  })

  // Reset states when opening
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setStep("select")
      setErrorMessage(null)
      setInvoiceId(null)
      setInvoiceNumber(null)
      setPaymentUrl(null)
      setQrCodeDataUrl(null)
      setVaNumber(null)
      setCustomAmount("")
      setIsLoadingMethods(true)
      if (suggestedAmount && suggestedAmount > 0) {
        setAmount(suggestedAmount)
      } else {
        setAmount(currency === "USD" ? 10 : 50000)
      }
    }
    onOpenChange(nextOpen)
  }

  useEffect(() => {
    let active = true
    if (open) {
      void (async () => {
        try {
          const [methodsRes, accountsRes] = await Promise.all([
            eden.api.payments.topup.methods.get({
              $query: { currency },
            }),
            eden.api.payments.topup["bank-accounts"].get().catch(() => ({
              data: { ok: false, data: [] },
            })),
          ])

          if (!active) return

          if (accountsRes?.data?.ok && Array.isArray(accountsRes.data.data)) {
            const accounts = accountsRes.data.data as BankAccount[]
            setBankAccounts(accounts)
            const defaultAcc = accounts.find((b) => b.isDefault) || accounts[0]
            if (defaultAcc) {
              setSelectedBankAccount(defaultAcc.id)
            }
          }

          if (methodsRes.data?.ok) {
            if (methodsRes.data.methods) {
              const nextMethods: Record<PaymentMethod, boolean> = {
                MANUAL_BANK: Boolean(methodsRes.data.methods.MANUAL_BANK),
                QRIS: Boolean(methodsRes.data.methods.QRIS),
                VA: Boolean(methodsRes.data.methods.VA),
                PAYPAL: Boolean(methodsRes.data.methods.PAYPAL),
              }
              setAvailableMethods(nextMethods)
              setSelectedMethod((current) => {
                if (nextMethods[current]) return current
                return (
                  ALL_METHODS.find((m) => nextMethods[m.value])?.value ??
                  "MANUAL_BANK"
                )
              })
            }

            if (methodsRes.data.config) {
              const cfg = methodsRes.data.config
              setCurrencyConfig({
                symbol: cfg.symbol || (currency === "USD" ? "$" : "Rp"),
                ratePerBase: Number(cfg.ratePerBase) || 18000,
                baseCode: cfg.baseCode || "USD",
                presets:
                  Array.isArray(cfg.presets) && cfg.presets.length > 0
                    ? cfg.presets
                    : currency === "USD"
                      ? [5, 10, 25, 50]
                      : [50000, 100000, 250000, 500000],
                minTopup: Number(cfg.minTopup) || 10000,
                maxTopup: Number(cfg.maxTopup) || 50000000,
              })
            }
          }
        } catch {
          // fallback to defaults
        } finally {
          if (active) {
            setIsLoadingMethods(false)
          }
        }
      })()
    }
    return () => {
      active = false
    }
  }, [open, currency])

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
    let active = true
    if (step === "payment" && invoiceId) {
      pollingRef.current = setInterval(() => {
        if (!active) return
        void checkPaymentStatus(invoiceId)
      }, 3000)
    }

    return () => {
      active = false
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

  const handleCreateTopup = async () => {
    if (!isValidAmount) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const { data: result } = await eden.api.payments.topup.post({
        amount,
        paymentMethod: selectedMethod,
      })
      if (!result || !result.ok || !result.invoice?.id) {
        throw new Error(result?.message || t.topupCreateFailed)
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
          // If QR generation fails, paymentUrl is still available
        }
      }

      if (result.vaNumber) {
        setVaNumber(result.vaNumber)
      }

      setStep("payment")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.topupCreateFailed)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCopy(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const invoiceBillingUrl = invoiceId
    ? localizePathname({
        pathname: `/console/billing/invoices/${invoiceId}`,
        locale,
      })
    : localizePathname({
        pathname: "/console/billing/invoices",
        locale,
      })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="custom-amount-input"
                  className="text-xs font-medium text-foreground"
                >
                  {t.chooseAmount} {currency})
                </label>
                {suggestedAmount && suggestedAmount > 0 ? (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Shortage: +{formatCurrency(suggestedAmount)}
                  </span>
                ) : null}
              </div>

              {suggestedAmount &&
              suggestedAmount > 0 &&
              !currencyConfig.presets.includes(suggestedAmount) ? (
                <div className="mb-2">
                  <Button
                    type="button"
                    variant={
                      amount === suggestedAmount && !customAmount
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="w-full justify-between text-xs"
                    onClick={() => {
                      setAmount(suggestedAmount)
                      setCustomAmount("")
                    }}
                  >
                    <span>Exact Shortage</span>
                    <span className="font-semibold">
                      +{formatCurrency(suggestedAmount)}
                    </span>
                  </Button>
                </div>
              ) : null}

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
                  id="custom-amount-input"
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
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-foreground">
                {t.instantPaymentMethod}
              </span>
              {isLoadingMethods ? (
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {ALL_METHODS.filter((m) => availableMethods[m.value]).map(
                    (method) => {
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
                    }
                  )}
                </div>
              )}
            </div>

            {/* Destination Bank Account selector when MANUAL_BANK is selected */}
            {selectedMethod === "MANUAL_BANK" && bankAccounts.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-foreground">
                  {topupMessages.destinationAccount}
                </span>
                <div className="space-y-2">
                  {bankAccounts.map((acc) => {
                    const isChosen =
                      selectedBankAccount === acc.id ||
                      (bankAccounts.length === 1 && !selectedBankAccount)
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedBankAccount(acc.id)}
                        className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-all ${
                          isChosen
                            ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-foreground">
                            {acc.bankName}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {acc.accountNumber} &bull; {acc.accountName}
                          </p>
                        </div>
                        {isChosen && (
                          <CheckCircle
                            className="size-4 text-emerald-600 dark:text-emerald-400"
                            weight="fill"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
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
                    <span className="font-mono text-xl font-bold tracking-wider text-foreground">
                      {vaNumber || "—"}
                    </span>
                    {vaNumber && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleCopy(vaNumber)}
                        title="Copy VA Number"
                      >
                        {copied ? (
                          <CheckCircle className="size-4 text-emerald-600" />
                        ) : (
                          <Copy className="size-4" />
                        )}
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
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full"
                  >
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{t.proceedToGateway}</span>
                      <ArrowsOutSimple className="ml-1.5 size-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            )}
            {selectedMethod === "MANUAL_BANK" && (
              <div className="w-full space-y-3">
                {(() => {
                  const targetBank =
                    bankAccounts.find((b) => b.id === selectedBankAccount) ||
                    bankAccounts[0]
                  return targetBank ? (
                    <div className="rounded-lg border bg-card p-3.5 text-left text-xs">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-semibold text-foreground">
                          {targetBank.bankName}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Manual Transfer
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-muted-foreground">
                            No. Rekening
                          </span>
                          <p className="font-mono text-base font-bold tracking-wider text-foreground">
                            {targetBank.accountNumber}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            a.n. {targetBank.accountName}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => handleCopy(targetBank.accountNumber)}
                          title="Copy Account Number"
                        >
                          {copied ? (
                            <CheckCircle className="size-4 text-emerald-600" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                      {copied && (
                        <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          {t.copiedToClipboard}
                        </p>
                      )}
                    </div>
                  ) : null
                })()}

                <div className="rounded-md bg-amber-500/10 p-2.5 text-left text-[11px] text-amber-900 dark:text-amber-300">
                  <p className="font-medium">Instruksi Pembayaran:</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Transfer tepat sebesar{" "}
                    <strong className="text-foreground">
                      {formatCurrency(amount)}
                    </strong>{" "}
                    ke rekening di atas, lalu konfirmasi pembayaran atau tunggu
                    verifikasi admin.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full text-xs"
                >
                  <Link
                    href={localizePathname({
                      pathname: `/console/billing/payments/confirm${invoiceId ? `?invoiceId=${invoiceId}` : ""}`,
                      locale,
                    })}
                    target="_blank"
                  >
                    <span>Konfirmasi Pembayaran Transfer</span>
                    <ArrowsOutSimple className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              </div>
            )}

            {selectedMethod === "PAYPAL" && paymentUrl && (
              <div className="w-full space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full text-xs"
                >
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Lanjutkan ke PayPal</span>
                    <ArrowsOutSimple className="ml-1.5 size-3.5" />
                  </a>
                </Button>
              </div>
            )}
            <div className="w-full space-y-2 border-t pt-3">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ArrowsClockwise className="size-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span>{t.waitingForConfirmation}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => invoiceId && checkPaymentStatus(invoiceId)}
              >
                {t.checkStatus}
              </Button>
              {invoiceId && (
                <div className="pt-1 text-center">
                  <Link
                    href={invoiceBillingUrl}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    target="_blank"
                  >
                    <ReceiptIcon className="size-3" />
                    <span>View full invoice details</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS VIEW */}
        {step === "success" && (
          <div className="flex flex-col items-center space-y-4 py-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-8" weight="fill" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t.paymentReceived}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.amountAddedToWallet.replace(
                  "{amount}",
                  formatCurrency(amount)
                )}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 pt-2">
              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => onOpenChange(false)}
              >
                {t.continueWorking}
              </Button>
              {invoiceId && (
                <Link
                  href={invoiceBillingUrl}
                  className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  target="_blank"
                >
                  <ReceiptIcon className="size-3.5" />
                  <span>View invoice in Billing</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
