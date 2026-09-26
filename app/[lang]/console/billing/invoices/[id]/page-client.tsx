"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import {
  getInvoice,
  getAccount,
  getPaymentMethods,
  payWithBalance,
  payPartialBalance,
  initiateInvoiceGatewayPayment,
  topupAndPay,
} from "@/lib/billing-client"
import type {
  BillingAccount,
  InvoiceDetail,
  PaymentMethod,
} from "@/lib/billing-client"
import {
  ArrowLeftIcon,
  WalletIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  BuildingsIcon,
  UserIcon,
  CreditCardIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react"
import { launchDuitkuPop } from "@/lib/payment/duitku-pop"
import { formatKey } from "@/lib/format-key"
import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"
import { formatInvoiceCurrency } from "@/modules/invoices/invoices.helpers"
import {
  InvoiceGroupedLines,
  InvoiceFlatLine,
} from "@/components/billing/invoice-grouped-lines"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function InvoiceDetailPage() {
  const params = useParams<{ lang?: string; id: string }>()
  const searchParams = useSearchParams()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const billing = messages.console.billing
  const invoiceId = params.id as string
  const paymentStatus = searchParams.get("payment")

  const [data, setData] = useState<InvoiceDetail | null>(null)
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showTopupDialog, setShowTopupDialog] = useState(false)
  const [topupResult, setTopupResult] = useState<{
    topupRequired: boolean
    gapAmount?: number
    topupInvoiceId?: string
    topupInvoiceNumber?: string
  } | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("")
  const [isLaunchingPop, setIsLaunchingPop] = useState(false)
  const [partialAmount, setPartialAmount] = useState("")
  const [isProcessingPartial, setIsProcessingPartial] = useState(false)
  const [isInitiatingGateway, setIsInitiatingGateway] = useState(false)
  const [partialSuccessMessage, setPartialSuccessMessage] = useState<
    string | null
  >(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadData() {
      try {
        const [invoiceResult, accountResult, paymentMethodsResult] =
          await Promise.all([
            getInvoice(invoiceId, { signal: controller.signal }),
            getAccount({ signal: controller.signal }),
            getPaymentMethods(),
          ])
        if (!cancelled) {
          setData(invoiceResult)
          setAccount(accountResult)
          setPaymentMethods(paymentMethodsResult.accounts)
        }
      } catch {
        if (!cancelled) {
          setError(billing.failedToLoadInvoices)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [invoiceId, billing.failedToLoadInvoices])

  useEffect(() => {
    if (!data?.invoice || !account) return

    const invoiceCurrency = data.invoice.currency || account.currency || "USD"
    const methods = paymentMethods.filter(
      (m) =>
        m.isActive &&
        ((m.supportedCurrencies ?? []).length === 0 ||
          (m.supportedCurrencies ?? []).includes(invoiceCurrency))
    )
    const defaultMethod = methods.find((m) => m.isDefault) ?? methods[0]

    if (
      defaultMethod &&
      (!selectedPaymentMethodId ||
        !methods.some((m) => m.id === selectedPaymentMethodId))
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPaymentMethodId(defaultMethod.id)
    }
  }, [data, account, paymentMethods, selectedPaymentMethodId])

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "N/A"
    return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr))
  }

  /** Format period dates in UTC to avoid timezone rollover (end-of-month → next month in WIB). */
  function formatPeriodDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "—"
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime())) return "—"
    return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed)
  }

  async function handlePayWithBalance() {
    setIsProcessing(true)
    setError(null)
    setPartialSuccessMessage(null)
    try {
      if (totalPaidNum > 0 || isPartiallyPaidStatus) {
        // Legacy pay-with-balance only accepts OPEN invoices and always debits
        // the full invoice total, so an invoice that already carries an
        // allocation has to settle exactly what is still due.
        const res = await payPartialBalance(invoiceId, remainingDueNum)
        setPartialSuccessMessage(res.message)
        if (res.invoiceStatus === "PAID") {
          setPaymentSuccess(true)
        }
      } else {
        await payWithBalance(invoiceId)
        setPaymentSuccess(true)
      }
      const [invoiceResult, accountResult] = await Promise.all([
        getInvoice(invoiceId),
        getAccount(),
      ])
      setData(invoiceResult)
      setAccount(accountResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : billing.paymentFailed)
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleTopupAndPay() {
    setIsProcessing(true)
    setError(null)
    try {
      const result = await topupAndPay(invoiceId)
      if (result.topupRequired) {
        setTopupResult({
          topupRequired: true,
          gapAmount: result.gapAmount,
          topupInvoiceId: result.topupInvoiceId,
          topupInvoiceNumber: result.topupInvoiceNumber,
        })
        setShowTopupDialog(true)
      } else {
        setPaymentSuccess(true)
        const invoiceResult = await getInvoice(invoiceId)
        setData(invoiceResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Top-up failed")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleContinuePayment() {
    if (!data?.invoice) return
    const invoice = data.invoice

    if (invoice.paymentReference && invoice.checkoutMode !== "REDIRECT") {
      setIsLaunchingPop(true)
      try {
        await launchDuitkuPop({
          reference: invoice.paymentReference,
          clientScriptUrl: invoice.clientScriptUrl ?? undefined,
          fallbackUrl: invoice.paymentUrl ?? undefined,
          defaultLanguage: locale === "id" ? "id" : "en",
          onSuccess: async () => {
            setPaymentSuccess(true)
            const result = await getInvoice(invoiceId)
            setData(result)
          },
          onPending: async () => {
            const result = await getInvoice(invoiceId)
            setData(result)
          },
          onClose: () => {
            // Popup closed by user
          },
        })
      } finally {
        setIsLaunchingPop(false)
      }
      return
    }

    if (invoice.paymentUrl) {
      window.open(invoice.paymentUrl, "_blank", "noopener,noreferrer")
    }
  }

  async function handlePayPartial() {
    const num = Number(partialAmount)
    if (isNaN(num) || num <= 0) return
    setIsProcessingPartial(true)
    setError(null)
    setPartialSuccessMessage(null)
    try {
      const res = await payPartialBalance(invoiceId, num)
      setPartialSuccessMessage(res.message)
      setPartialAmount("")
      const [invoiceResult, accountResult] = await Promise.all([
        getInvoice(invoiceId),
        getAccount(),
      ])
      setData(invoiceResult)
      setAccount(accountResult)
      if (res.invoiceStatus === "PAID") {
        setPaymentSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : billing.paymentFailed)
    } finally {
      setIsProcessingPartial(false)
    }
  }

  async function handlePayRemainingViaGateway() {
    setIsInitiatingGateway(true)
    setError(null)
    try {
      const res = await initiateInvoiceGatewayPayment(invoiceId)
      if (res.mode === "POP" && res.reference) {
        await launchDuitkuPop({
          reference: res.reference,
          clientScriptUrl: res.clientScriptUrl ?? undefined,
          fallbackUrl: res.paymentUrl ?? undefined,
          defaultLanguage: locale === "id" ? "id" : "en",
          onSuccess: async () => {
            setPaymentSuccess(true)
            const [invoiceResult, accountResult] = await Promise.all([
              getInvoice(invoiceId),
              getAccount(),
            ])
            setData(invoiceResult)
            setAccount(accountResult)
          },
          onPending: async () => {
            const invoiceResult = await getInvoice(invoiceId)
            setData(invoiceResult)
          },
          onClose: async () => {
            const invoiceResult = await getInvoice(invoiceId)
            setData(invoiceResult)
          },
        })
      } else if (res.paymentUrl) {
        window.open(res.paymentUrl, "_blank", "noopener,noreferrer")
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to initiate payment."
      )
    } finally {
      setIsInitiatingGateway(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-9 w-32" />
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-80" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6 lg:col-span-4">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-48" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  if (error || !data?.invoice) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/console/billing/invoices`}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{billing.invoiceNotFound}</h1>
        </header>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || billing.invoiceNotFound}
          </p>
        </div>
      </main>
    )
  }

  const invoice = data.invoice
  const isTopUp = invoice.type === "TOP_UP"
  const isOpen =
    invoice.status === "OPEN" ||
    invoice.status === "open" ||
    invoice.status === "PARTIALLY_PAID" ||
    invoice.status === "partially_paid"
  const issueDate = invoice.issuedAt ?? invoice.createdAt ?? null
  const dueDate = invoice.dueAt ?? invoice.dueDate ?? null
  const invoiceCurrency = invoice.currency || account?.currency || "USD"
  const formatInvoiceAmount = (amount: string | null | undefined) =>
    formatInvoiceCurrency(Number(amount ?? 0), invoiceCurrency)
  const totalAmountNum = Number(invoice.totalAmountIdr ?? 0)
  const allocations = invoice.allocations ?? []
  const totalPaidNum =
    invoice.totalPaid !== undefined
      ? invoice.totalPaid
      : allocations
          .filter((a) => a.status === "COMPLETED")
          .reduce((sum, a) => sum + Number(a.amount), 0)
  const remainingDueNum =
    invoice.remainingDue !== undefined
      ? invoice.remainingDue
      : Math.max(0, totalAmountNum - totalPaidNum)
  const isPartiallyPaidStatus =
    invoice.status === "PARTIALLY_PAID" || invoice.status === "partially_paid"
  const availableBalanceNum = Number(account?.balanceIdr ?? 0)
  const maxUsableBalance = Math.min(availableBalanceNum, remainingDueNum)
  const subtotalAmount = invoice.subtotalAmountIdr ?? invoice.totalAmountIdr
  const taxAmount = invoice.taxAmountIdr ?? "0"
  const discountAmount = invoice.discountAmountIdr ?? "0"

  const rawData: Record<string, unknown> = data
  const rawConfirmations = invoice.confirmations ?? rawData.confirmations
  const confirmations = Array.isArray(rawConfirmations)
    ? (rawConfirmations as Array<{
        id: string
        status: string
        createdAt: string
        amount: number
      }>)
    : []
  const latestConfirmation =
    confirmations.length > 0 ? confirmations[confirmations.length - 1] : null
  const isPendingConfirmation =
    latestConfirmation?.status?.toUpperCase() === "PENDING"
  const isApprovedConfirmation =
    latestConfirmation?.status?.toUpperCase() === "APPROVED"
  const isRejectedConfirmation =
    latestConfirmation?.status?.toUpperCase() === "REJECTED"
  const activeConfirmation =
    latestConfirmation && (isPendingConfirmation || isApprovedConfirmation)
      ? latestConfirmation
      : null

  const supportsInvoiceCurrency = (method: PaymentMethod) => {
    const supported = method.supportedCurrencies ?? []
    return supported.length === 0 || supported.includes(invoiceCurrency)
  }
  const currencyCompatibleMethods = paymentMethods.filter(
    (method) => method.isActive && supportsInvoiceCurrency(method)
  )
  const defaultPaymentMethod =
    currencyCompatibleMethods.find((method) => method.isDefault) ??
    currencyCompatibleMethods[0] ??
    null
  const selectedPaymentMethod =
    currencyCompatibleMethods.find(
      (method) => method.id === selectedPaymentMethodId
    ) ?? defaultPaymentMethod
  const confirmPaymentHref = `/${locale}/console/billing/payments/confirm?invoiceId=${invoice.id}`
  const finalConfirmHref = selectedPaymentMethod
    ? `${confirmPaymentHref}&paymentMethodId=${selectedPaymentMethod.id}`
    : confirmPaymentHref

  const isManualPayment =
    invoice.paymentMethod === "MANUAL_BANK" ||
    invoice.paymentMethod === "manual_bank_transfer"
  const isGatewayPayment =
    invoice.paymentMethod === "PAYMENT_GATEWAY" ||
    invoice.paymentMethod === "payment_gateway" ||
    invoice.paymentMethod === "VA" ||
    invoice.paymentMethod === "QRIS" ||
    invoice.paymentMethod === "GATEWAY" ||
    invoice.paymentMethod === "DUITKU" ||
    Boolean(invoice.paymentReference || invoice.paymentUrl)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header bar */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-9 w-9" asChild>
            <Link href={`/${locale}/console/billing/invoices`}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {billing.invoices.heading} {invoice.invoiceNumber}
              </h1>
              <InvoiceStatusBadge
                status={
                  invoice.status as
                    "OPEN" | "PENDING" | "PAID" | "VOID" | "DRAFT"
                }
              />
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {billing.invoices.issuedOn} {formatDate(issueDate)}
              {dueDate ? ` • ${billing.dueDate}: ${formatDate(dueDate)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceDownloadPdfAction
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
          />
        </div>
      </header>

      {/* Payment Status Notifications */}
      {paymentStatus === "success" && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-600 dark:text-green-400">
              {billing.paymentSuccessful}
            </p>
            <p className="text-sm text-muted-foreground">
              {billing.paymentSuccessDesc}
            </p>
          </div>
        </div>
      )}
      {paymentStatus === "pending" && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">
              {billing.paymentPending}
            </p>
            <p className="text-sm text-muted-foreground">
              {billing.paymentPendingDesc}
            </p>
          </div>
        </div>
      )}
      {paymentStatus === "failed" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium text-red-600 dark:text-red-400">
              {billing.paymentFailed}
            </p>
            <p className="text-sm text-muted-foreground">
              {billing.paymentFailedDesc}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href={`/${locale}/console/billing/topup`}>
              {billing.retryPayment}
            </Link>
          </Button>
        </div>
      )}

      {latestConfirmation && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            isApprovedConfirmation
              ? "border-green-500/20 bg-green-500/10"
              : isRejectedConfirmation
                ? "border-red-500/20 bg-red-500/10"
                : "border-yellow-500/20 bg-yellow-500/10"
          }`}
        >
          {isPendingConfirmation ? (
            <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          ) : (
            <CheckCircleIcon
              className={`h-5 w-5 ${
                isApprovedConfirmation
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            />
          )}
          <div>
            <p
              className={`font-medium ${
                isApprovedConfirmation
                  ? "text-green-600 dark:text-green-400"
                  : isRejectedConfirmation
                    ? "text-red-600 dark:text-red-400"
                    : "text-yellow-600 dark:text-yellow-400"
              }`}
            >
              {billing.invoices.paymentConfirmation.replace(/\s*—\s*$/, "")} —{" "}
              {latestConfirmation.status}
            </p>
            <p className="text-sm text-muted-foreground">
              {billing.invoices.submitted}{" "}
              {formatDate(latestConfirmation.createdAt)}
              {isPendingConfirmation && (
                <span className="mt-1 block text-xs font-normal text-yellow-700 dark:text-yellow-300">
                  {billing.paymentsConfirm.successDesc}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
      {isManualPayment &&
        invoice.status === "OPEN" &&
        !isPendingConfirmation &&
        !isApprovedConfirmation && (
          <Card className="border-2 border-primary bg-primary/5 shadow-md">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="font-semibold text-primary">
                    {billing.invoices.transferSubmittedTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {billing.invoices.transferSubmittedDescription}
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
                <Link href={confirmPaymentHref}>
                  {billing.invoices.confirmAndUploadReceipt}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

      {/* Main Responsive Workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Printable Invoice Document (Full 12 cols if paid/draft/void, 8 cols if payment needed) */}
        <div
          className={`space-y-6 ${isOpen ? "lg:col-span-8" : "lg:col-span-12"}`}
        >
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              {/* Document Header */}
              <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                      P
                    </div>
                    <span className="text-lg font-bold tracking-tight">
                      {billing.invoices.providerShortName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {billing.invoices.providerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {messages.console.invoices.pdf.companyAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {messages.console.invoices.pdf.companyContact}
                  </p>
                </div>
                <div className="space-y-1 text-left sm:text-right">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {billing.invoiceDetail}
                  </p>
                  <p className="font-mono text-base font-bold text-foreground">
                    {invoice.invoiceNumber}
                  </p>
                  <div className="space-y-0.5 pt-0.5 text-xs text-muted-foreground">
                    <p>
                      {billing.invoices.issueDate}: {formatDate(issueDate)}
                    </p>
                    <p>
                      {billing.invoices.dueDate}: {formatDate(dueDate)}
                    </p>
                  </div>
                  <div className="inline-block pt-1">
                    <InvoiceStatusBadge
                      status={
                        invoice.status as
                          "OPEN" | "PENDING" | "PAID" | "VOID" | "DRAFT"
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Billed To & Dates Grid */}
              <div className="grid gap-6 border-b border-border/60 py-6 sm:grid-cols-2">
                {/* Billed To Left */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {billing.invoices.billedTo}
                  </span>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <BuildingsIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">
                      {invoice.organization?.name ??
                        invoice.billingEntity?.name ??
                        account?.businessName ??
                        account?.name ??
                        billing.heading}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>
                      {invoice.billingEntity?.email ??
                        invoice.organization?.email ??
                        account?.email ??
                        "—"}
                    </span>
                  </div>
                </div>

                {/* Billing Period Right Aligned (or Payment Information for Top-Up) */}
                <div className="space-y-1 text-xs sm:text-right">
                  {isTopUp ? (
                    <>
                      <span className="font-semibold tracking-wider text-muted-foreground uppercase">
                        {billing.invoices.paymentReference ||
                          "Informasi Pembayaran"}
                      </span>
                      <p className="font-mono font-medium text-foreground">
                        {invoice.paymentReference || invoice.invoiceNumber}
                      </p>
                      <p className="text-muted-foreground">
                        {isManualPayment
                          ? billing.manualBankTransfer
                          : "Duitku Payment Gateway"}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold tracking-wider text-muted-foreground uppercase">
                        {billing.invoices.billingPeriod}
                      </span>
                      <p className="font-medium text-foreground">
                        {formatPeriodDate(invoice.periodStart)} —{" "}
                        {formatPeriodDate(invoice.periodEnd)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="py-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    {invoice.type === "TOP_UP"
                      ? billing.topUpDetails
                      : billing.lineItems}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {billing.invoices.currency}: {invoiceCurrency}
                  </span>
                </div>

                {invoice.type === "TOP_UP" ? (
                  <InvoiceFlatLine
                    lines={invoice.lines ?? []}
                    currency={invoiceCurrency}
                    lang={locale}
                  />
                ) : (
                  <InvoiceGroupedLines
                    lines={invoice.lines ?? []}
                    currency={invoiceCurrency}
                    lang={locale}
                  />
                )}
              </div>

              {/* Calculation Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-full max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{billing.subtotal}</span>
                    <span className="font-medium text-foreground">
                      {formatInvoiceAmount(subtotalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{billing.invoices.tax}</span>
                    <span className="font-medium text-foreground">
                      {formatInvoiceAmount(taxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{billing.invoices.discount}</span>
                    <span className="font-medium text-foreground">
                      {formatInvoiceAmount(discountAmount)}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base font-bold">
                    <span>{billing.total}</span>
                    <span className="font-mono text-primary">
                      {formatInvoiceAmount(invoice.totalAmountIdr)}
                    </span>
                  </div>
                  {totalPaidNum > 0 && (
                    <>
                      <div className="flex justify-between pt-1 text-muted-foreground">
                        <span>
                          {billing.invoices.totalPaid || "Sudah Dibayar"}
                        </span>
                        <span className="font-mono font-medium text-green-600 dark:text-green-400">
                          {formatInvoiceCurrency(totalPaidNum, invoiceCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-bold">
                        <span>
                          {billing.invoices.remainingDue || "Sisa Tagihan"}
                        </span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {formatInvoiceCurrency(
                            remainingDueNum,
                            invoiceCurrency
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Allocation History */}
          {allocations.length > 0 && (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                  {billing.invoices.paymentHistory || "Riwayat Pembayaran"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-2 font-medium">Tanggal</th>
                        <th className="pb-2 font-medium">Metode / Sumber</th>
                        <th className="pb-2 font-medium">Referensi</th>
                        <th className="pb-2 text-right font-medium">Jumlah</th>
                        <th className="pb-2 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {allocations.map((alloc) => (
                        <tr key={alloc.id}>
                          <td className="py-2.5 text-muted-foreground">
                            {formatDate(alloc.completedAt || alloc.createdAt)}
                          </td>
                          <td className="py-2.5 font-medium text-foreground">
                            {alloc.source.replace("_", " ")}
                          </td>
                          <td className="py-2.5 font-mono text-muted-foreground">
                            {alloc.referenceId || "—"}
                          </td>
                          <td className="py-2.5 text-right font-mono font-semibold text-foreground">
                            {formatInvoiceCurrency(
                              alloc.amount,
                              alloc.currency || invoiceCurrency
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                alloc.status === "COMPLETED"
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : alloc.status === "PENDING"
                                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {alloc.status === "COMPLETED"
                                ? "Berhasil"
                                : alloc.status === "PENDING"
                                  ? "Menunggu"
                                  : alloc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dynamic Order & Provisioning Specifications */}
          {(() => {
            const lineWithMetadata = invoice.lines?.find(
              (l) => l.metadata && typeof l.metadata === "object"
            )
            const metadata = (lineWithMetadata?.metadata ?? {}) as Record<
              string,
              unknown
            >
            const answers = (metadata.provisioningAnswers ??
              (typeof metadata.device === "object" ? metadata.device : null) ??
              {}) as Record<string, unknown>

            const entries = Object.entries(answers).filter(
              ([key, val]) =>
                key !== "_provisioningFields" &&
                val !== null &&
                val !== undefined &&
                typeof val !== "object"
            )

            if (entries.length === 0) return null

            return (
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                    {billing.invoices.orderSpecificationsTitle}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {billing.invoices.orderSpecificationsDescription}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {entries.map(([key, val]) => (
                      <div
                        key={key}
                        className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3"
                      >
                        <span className="text-xs text-muted-foreground">
                          {formatKey(key)}
                        </span>
                        <span className="mt-1 font-mono text-xs font-semibold text-foreground">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })()}
        </div>

        {/* Right Column: Payment Actions (4 cols, only visible when action needed) */}
        {isOpen && (
          <div className="space-y-6 lg:col-span-4">
            {/* Payment Action Box */}
            <Card className="border-2 border-primary shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold tracking-wider text-primary uppercase">
                  {billing.invoices.paymentOptions}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isTopUp ? (
                  isManualPayment ? (
                    <div className="space-y-3 text-xs">
                      <p className="leading-relaxed text-muted-foreground">
                        {billing.invoices.transferExactAmount}{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatInvoiceAmount(invoice.totalAmountIdr)}
                        </span>{" "}
                        {billing.invoices.destinationAccountHint}
                      </p>
                      {currencyCompatibleMethods.length > 0 ? (
                        <div className="space-y-3">
                          <div className="grid gap-1.5">
                            <Label
                              htmlFor="payment-method"
                              className="text-xs font-semibold text-muted-foreground"
                            >
                              {billing.invoices.paymentMethod}
                            </Label>
                            <Select
                              value={selectedPaymentMethod?.id ?? ""}
                              onValueChange={(value) =>
                                setSelectedPaymentMethodId(value)
                              }
                            >
                              <SelectTrigger
                                id="payment-method"
                                className="border-border bg-background text-xs text-foreground"
                              >
                                <SelectValue
                                  placeholder={
                                    billing.invoices.selectPaymentMethod
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent className="border-border bg-popover">
                                {currencyCompatibleMethods.map((method) => (
                                  <SelectItem
                                    key={method.id}
                                    value={method.id}
                                    className="text-xs text-foreground hover:bg-muted"
                                  >
                                    {method.bankName} — {method.accountNumber}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedPaymentMethod && (
                            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-xs">
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                  {billing.invoices.bank}
                                </span>
                                <span className="font-medium text-foreground">
                                  {selectedPaymentMethod.bankName}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                  {billing.invoices.accountNumber}
                                </span>
                                <span className="font-mono font-medium text-foreground">
                                  {selectedPaymentMethod.accountNumber}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                  {billing.invoices.accountName}
                                </span>
                                <span className="font-medium text-foreground">
                                  {selectedPaymentMethod.accountName}
                                </span>
                              </div>
                            </div>
                          )}
                          {activeConfirmation ? (
                            <div className="space-y-2">
                              <Button
                                type="button"
                                className="w-full"
                                disabled
                                variant="outline"
                              >
                                <CheckCircleIcon className="mr-2 h-4 w-4" />
                                {billing.paymentsConfirm.alreadyConfirmed}
                              </Button>
                              {isPendingConfirmation && (
                                <p className="text-center text-xs text-yellow-600 dark:text-yellow-400">
                                  {billing.paymentsConfirm.successDesc}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Button asChild className="w-full">
                              <Link href={finalConfirmHref}>
                                <CheckCircleIcon className="mr-2 h-4 w-4" />
                                {billing.confirmPayment}
                              </Link>
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                          {billing.invoices.noActivePaymentMethod}{" "}
                          {invoiceCurrency}
                          {billing.invoices.contactSupportBeforeTransfer.startsWith(
                            "."
                          )
                            ? billing.invoices.contactSupportBeforeTransfer
                            : ` ${billing.invoices.contactSupportBeforeTransfer}`}
                        </p>
                      )}
                    </div>
                  ) : isGatewayPayment ? (
                    <div className="space-y-3 text-xs">
                      <p className="leading-relaxed text-muted-foreground">
                        {billing.invoices.gatewayDescription}
                      </p>
                      {invoice.paymentReference && (
                        <div className="space-y-1 rounded-lg border bg-muted/30 p-2.5">
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            {billing.invoices.paymentReference ||
                              "Referensi Pembayaran"}
                          </span>
                          <p className="font-mono text-xs font-semibold break-all text-foreground">
                            {invoice.paymentReference}
                          </p>
                        </div>
                      )}
                      {invoice.paymentReference &&
                      invoice.checkoutMode !== "REDIRECT" ? (
                        <Button
                          onClick={handleContinuePayment}
                          disabled={isLaunchingPop}
                          className="w-full font-medium"
                        >
                          {isLaunchingPop ? (
                            <ArrowClockwiseIcon className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CreditCardIcon className="mr-2 h-4 w-4" />
                          )}
                          {isLaunchingPop
                            ? billing.processing
                            : billing.invoices.continuePayment ||
                              billing.invoices.continueToGateway}
                        </Button>
                      ) : invoice.paymentUrl ? (
                        <Button asChild className="w-full font-medium">
                          <Link
                            href={invoice.paymentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <CreditCardIcon className="mr-2 h-4 w-4" />
                            {billing.invoices.continueToGateway}
                          </Link>
                        </Button>
                      ) : (
                        <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                          {billing.invoices.gatewayUnavailable}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {billing.invoices.noPaymentMethodSelected}
                    </p>
                  )
                ) : (
                  /* Standard Service Invoice: Split-tender & Balance options */
                  <div className="space-y-4">
                    {/* Financial summary: Total, Paid, Remaining */}
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {billing.invoices.totalBilled || "Total Tagihan"}
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatInvoiceAmount(invoice.totalAmountIdr)}
                        </span>
                      </div>
                      {totalPaidNum > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {billing.invoices.totalPaid || "Sudah Dibayar"}
                          </span>
                          <span className="font-mono font-medium text-green-600 dark:text-green-400">
                            {formatInvoiceCurrency(
                              totalPaidNum,
                              invoiceCurrency
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-border/50 pt-1.5">
                        <span className="font-semibold text-foreground">
                          {billing.invoices.remainingDue || "Sisa Tagihan"}
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatInvoiceCurrency(
                            remainingDueNum,
                            invoiceCurrency
                          )}
                        </span>
                      </div>
                    </div>

                    {account && (
                      <div className="flex justify-between rounded-lg border bg-muted/40 p-3 text-xs">
                        <span className="text-muted-foreground">
                          {billing.invoices.availableBalance}
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {account.formattedBalance}
                        </span>
                      </div>
                    )}

                    {error && (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    )}

                    {partialSuccessMessage && (
                      <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-600 dark:text-green-400">
                        {partialSuccessMessage}
                      </div>
                    )}

                    {paymentSuccess || remainingDueNum <= 0 ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>{billing.paymentSuccessLabel}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* Option 1: Pay Full with Balance (if balance >= remainingDue) */}
                        {availableBalanceNum >= remainingDueNum ? (
                          <Button
                            onClick={handlePayWithBalance}
                            disabled={isProcessing}
                            className="w-full"
                          >
                            <WalletIcon className="mr-2 h-4 w-4" />
                            {isProcessing
                              ? billing.processing
                              : billing.payWithBalance}
                          </Button>
                        ) : availableBalanceNum > 0 ? (
                          /* Option 2: Split-tender - Partial Balance deduction */
                          <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
                            <span className="font-medium text-foreground">
                              {billing.invoices.payWithPartialBalance ||
                                "Bayar Sebagian dengan Saldo"}
                            </span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="0"
                                value={partialAmount}
                                onChange={(e) =>
                                  setPartialAmount(e.target.value)
                                }
                                className="h-8 font-mono text-xs"
                                min="1"
                                max={maxUsableBalance}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setPartialAmount(String(maxUsableBalance))
                                }
                                className="h-8 text-[11px] whitespace-nowrap"
                              >
                                {billing.invoices.useMaxBalance || "Maks"}
                              </Button>
                            </div>
                            <Button
                              onClick={handlePayPartial}
                              disabled={
                                isProcessingPartial ||
                                !partialAmount ||
                                Number(partialAmount) <= 0 ||
                                Number(partialAmount) > maxUsableBalance
                              }
                              className="h-8 w-full text-xs font-medium"
                            >
                              <WalletIcon className="mr-2 h-3.5 w-3.5" />
                              {isProcessingPartial
                                ? billing.processing
                                : billing.invoices.payWithPartialBalance ||
                                  "Gunakan Saldo"}
                            </Button>
                          </div>
                        ) : null}

                        {/* Option 3: Pay Remaining via Gateway (Duitku POP) */}
                        <Button
                          onClick={handlePayRemainingViaGateway}
                          disabled={isInitiatingGateway}
                          variant={
                            availableBalanceNum >= remainingDueNum
                              ? "outline"
                              : "default"
                          }
                          className="w-full"
                        >
                          {isInitiatingGateway ? (
                            <ArrowClockwiseIcon className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CreditCardIcon className="mr-2 h-4 w-4" />
                          )}
                          {isInitiatingGateway
                            ? billing.processing
                            : `${billing.invoices.payRemainingViaGateway || "Bayar Sisa Tagihan"} (${formatInvoiceCurrency(remainingDueNum, invoiceCurrency)})`}
                        </Button>

                        {/* Option 4: Top Up and Pay (Gap) */}
                        <Button
                          onClick={handleTopupAndPay}
                          disabled={isProcessing}
                          variant="ghost"
                          className="w-full text-xs text-muted-foreground"
                        >
                          <PlusIcon className="mr-2 h-3.5 w-3.5" />
                          {billing.topUpPlusPay}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Top-up Required Dialog */}
      <Dialog open={showTopupDialog} onOpenChange={setShowTopupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{billing.invoices.topUpRequired}</DialogTitle>
            <DialogDescription>
              {billing.invoices.topUpDescription}
            </DialogDescription>
          </DialogHeader>
          {topupResult && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {billing.invoices.gapAmount}
                  </span>
                  <span className="font-medium">
                    {formatInvoiceCurrency(
                      Number(topupResult.gapAmount ?? 0),
                      account?.currency || invoiceCurrency
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {billing.invoices.topUpInvoice}
                  </span>
                  <span className="font-medium">
                    {topupResult.topupInvoiceNumber}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {billing.invoices.topUpInstruction}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link href={`/${locale}/console/billing/topup`}>
                {billing.invoices.goToTopUp}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
