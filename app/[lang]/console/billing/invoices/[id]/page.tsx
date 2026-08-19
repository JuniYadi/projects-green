"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  ReceiptIcon,
  CalendarBlankIcon,
  CreditCardIcon,
  BuildingsIcon,
  UserIcon,
} from "@phosphor-icons/react"
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
          setError("Failed to load invoice")
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
  }, [invoiceId])

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
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr))
  }

  /** Format period dates in UTC to avoid timezone rollover (end-of-month → next month in WIB). */
  function formatPeriodDate(dateStr: string): string {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(dateStr))
  }

  async function handlePayWithBalance() {
    setIsProcessing(true)
    setError(null)
    try {
      await payWithBalance(invoiceId)
      setPaymentSuccess(true)
      const result = await getInvoice(invoiceId)
      setData(result)
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
            <Link href="/console/billing/invoices">
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
  const isPaid = invoice.status === "PAID"
  const isOpen = invoice.status === "OPEN"
  const isDraft = invoice.status === "DRAFT"
  const isVoid = invoice.status === "VOID"
  const issueDate = invoice.issuedAt ?? invoice.createdAt ?? null
  const dueDate = invoice.dueAt ?? invoice.dueDate ?? null
  const invoiceCurrency = invoice.currency || account?.currency || "USD"
  const formatInvoiceAmount = (amount: string | null | undefined) =>
    formatInvoiceCurrency(Number(amount ?? 0), invoiceCurrency)
  const subtotalAmount = invoice.subtotalAmountIdr ?? invoice.totalAmountIdr
  const taxAmount = invoice.taxAmountIdr ?? "0"
  const discountAmount = invoice.discountAmountIdr ?? "0"

  const rawData: Record<string, unknown> = data
  const rawConfirmations = rawData.confirmations
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
  const activeConfirmation =
    latestConfirmation &&
    (latestConfirmation.status === "PENDING" ||
      latestConfirmation.status === "APPROVED")
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
  const confirmPaymentHref = `/console/billing/payments/confirm?invoiceId=${invoice.id}`
  const finalConfirmHref = selectedPaymentMethod
    ? `${confirmPaymentHref}&paymentMethodId=${selectedPaymentMethod.id}`
    : confirmPaymentHref

  const isManualPayment =
    invoice.paymentMethod === "MANUAL_BANK" ||
    invoice.paymentMethod === "manual_bank_transfer"
  const isGatewayPayment =
    invoice.paymentMethod === "PAYMENT_GATEWAY" ||
    invoice.paymentMethod === "payment_gateway"

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header bar */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-9 w-9" asChild>
            <Link href="/console/billing/invoices">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Invoice {invoice.invoiceNumber}
              </h1>
              <InvoiceStatusBadge
                status={
                  invoice.status as
                    | "OPEN"
                    | "PENDING"
                    | "PAID"
                    | "VOID"
                    | "DRAFT"
                }
              />
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Issued on {formatDate(issueDate)}
              {dueDate ? ` • Due on ${formatDate(dueDate)}` : ""}
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
            <Link href="/console/billing/topup">{billing.retryPayment}</Link>
          </Button>
        </div>
      )}

      {latestConfirmation && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            latestConfirmation.status === "APPROVED"
              ? "border-green-500/20 bg-green-500/10"
              : latestConfirmation.status === "REJECTED"
                ? "border-red-500/20 bg-red-500/10"
                : "border-yellow-500/20 bg-yellow-500/10"
          }`}
        >
          <CheckCircleIcon
            className={`h-5 w-5 ${
              latestConfirmation.status === "APPROVED"
                ? "text-green-600 dark:text-green-400"
                : latestConfirmation.status === "REJECTED"
                  ? "text-red-600 dark:text-red-400"
                  : "text-yellow-600 dark:text-yellow-400"
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                latestConfirmation.status === "APPROVED"
                  ? "text-green-600 dark:text-green-400"
                  : latestConfirmation.status === "REJECTED"
                    ? "text-red-600 dark:text-red-400"
                    : "text-yellow-600 dark:text-yellow-400"
              }`}
            >
              Payment Confirmation — {latestConfirmation.status}
            </p>
            <p className="text-sm text-muted-foreground">
              Submitted {formatDate(latestConfirmation.createdAt)}
            </p>
          </div>
        </div>
      )}

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Printable Invoice Document (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
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
                      {account?.businessName ?? account?.name ?? "PFNApp"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PT PFN Digital Solusindo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    billing@pfnapp.my.id
                  </p>
                </div>

                <div className="space-y-1 text-left sm:text-right">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {billing.invoiceDetail}
                  </p>
                  <p className="font-mono text-base font-bold text-foreground">
                    {invoice.invoiceNumber}
                  </p>
                  <div className="inline-block pt-1">
                    <InvoiceStatusBadge
                      status={
                        invoice.status as
                          | "OPEN"
                          | "PENDING"
                          | "PAID"
                          | "VOID"
                          | "DRAFT"
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Billed To & Metadata Grid */}
              <div className="grid gap-6 border-b border-border/60 py-6 text-sm sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Billed To
                  </span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <BuildingsIcon className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {invoice.billingEntity?.name ??
                        invoice.organization?.name ??
                        account?.businessName ??
                        account?.name ??
                        "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>
                      {invoice.billingEntity?.email ??
                        invoice.organization?.email ??
                        account?.email ??
                        "—"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold tracking-wider text-muted-foreground uppercase">
                      Issue Date
                    </span>
                    <p className="font-medium text-foreground">
                      {formatDate(issueDate)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold tracking-wider text-muted-foreground uppercase">
                      {billing.dueDate}
                    </span>
                    <p className="font-medium text-foreground">
                      {dueDate ? formatDate(dueDate) : "—"}
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <span className="font-semibold tracking-wider text-muted-foreground uppercase">
                      Billing Period
                    </span>
                    <p className="font-medium text-foreground">
                      {formatPeriodDate(invoice.periodStart)} —{" "}
                      {formatPeriodDate(invoice.periodEnd)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="py-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    {invoice.type === "TOP_UP"
                      ? "Top-Up Details"
                      : "Service Charges & Usage"}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Currency: {invoiceCurrency}
                  </span>
                </div>

                {invoice.type === "TOP_UP" ? (
                  <InvoiceFlatLine
                    lines={invoice.lines ?? []}
                    currency={invoiceCurrency}
                  />
                ) : (
                  <InvoiceGroupedLines
                    lines={invoice.lines ?? []}
                    currency={invoiceCurrency}
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
                    <span>Tax</span>
                    <span className="font-medium text-foreground">
                      {formatInvoiceAmount(taxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status Summary & Payment Action Cards (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Status & Summary Card */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Invoice State
                  </span>
                  <InvoiceStatusBadge
                    status={
                      invoice.status as
                        | "OPEN"
                        | "PENDING"
                        | "PAID"
                        | "VOID"
                        | "DRAFT"
                    }
                  />
                </div>
                <div className="mt-3">
                  <span className="text-xs text-muted-foreground">
                    {billing.total}
                  </span>
                  <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
                    {formatInvoiceAmount(invoice.totalAmountIdr)}
                  </p>
                </div>
              </div>

              {isPaid && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">Invoice is Paid</p>
                    <p className="text-muted-foreground">
                      This transaction has been settled. No further action is
                      required.
                    </p>
                  </div>
                </div>
              )}

              {isDraft && (
                <div className="flex items-start gap-3 rounded-lg border border-muted bg-muted/40 p-3.5 text-xs text-muted-foreground">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">Draft State</p>
                    <p>
                      This invoice is being prepared and will be finalized at
                      the end of the billing cycle.
                    </p>
                  </div>
                </div>
              )}

              {isVoid && (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-800 dark:text-red-300">
                  <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">Invoice Voided</p>
                    <p className="text-muted-foreground">
                      This invoice has been cancelled and is no longer valid.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ReceiptIcon className="h-3.5 w-3.5" />
                    Invoice No
                  </span>
                  <span className="font-mono text-foreground">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarBlankIcon className="h-3.5 w-3.5" />
                    {billing.issuedDate}
                  </span>
                  <span className="text-foreground">
                    {formatDate(issueDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CreditCardIcon className="h-3.5 w-3.5" />
                    Payment Type
                  </span>
                  <span className="text-foreground capitalize">
                    {invoice.type?.toLowerCase().replace("_", " ") ??
                      "Standard"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Action Box (When status is OPEN) */}
          {isOpen && (
            <Card className="border-primary/40 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold tracking-wider text-primary uppercase">
                  Payment Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isTopUp ? (
                  isManualPayment ? (
                    <div className="space-y-3 text-xs">
                      <p className="leading-relaxed text-muted-foreground">
                        Transfer the exact amount{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatInvoiceAmount(invoice.totalAmountIdr)}
                        </span>{" "}
                        to the destination bank account:
                      </p>
                      {currencyCompatibleMethods.length > 0 ? (
                        <div className="space-y-3">
                          <div className="grid gap-1.5">
                            <Label
                              htmlFor="payment-method"
                              className="text-xs font-semibold text-muted-foreground"
                            >
                              Payment method
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
                                <SelectValue placeholder="Select payment method" />
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
                                  Bank
                                </span>
                                <span className="font-medium text-foreground">
                                  {selectedPaymentMethod.bankName}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                  Account No.
                                </span>
                                <span className="font-mono font-medium text-foreground">
                                  {selectedPaymentMethod.accountNumber}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                  Account Name
                                </span>
                                <span className="font-medium text-foreground">
                                  {selectedPaymentMethod.accountName}
                                </span>
                              </div>
                            </div>
                          )}
                          <Button
                            asChild
                            className="w-full"
                            disabled={!!activeConfirmation}
                          >
                            <Link href={finalConfirmHref}>
                              <CheckCircleIcon className="mr-2 h-4 w-4" />
                              {activeConfirmation
                                ? "Already confirmed — pending review"
                                : "Confirm Payment"}
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                          No active payment method supports {invoiceCurrency}.
                          Contact support before transferring this payment.
                        </p>
                      )}
                    </div>
                  ) : isGatewayPayment ? (
                    <div className="space-y-3 text-xs">
                      <p className="leading-relaxed text-muted-foreground">
                        Complete your payment through the payment gateway. Your
                        balance will be updated automatically once the payment
                        is confirmed.
                      </p>
                      {invoice.paymentUrl ? (
                        <Button asChild className="w-full">
                          <Link
                            href={invoice.paymentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Continue to Payment Gateway
                          </Link>
                        </Button>
                      ) : (
                        <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                          The payment gateway link is not available for this
                          invoice. Please create a new top-up or contact
                          support.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No payment method selected yet.
                    </p>
                  )
                ) : (
                  /* Standard Service Invoice: Balance options */
                  <div className="space-y-3">
                    {account && (
                      <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Available Balance
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {account.formattedBalance}
                          </span>
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    )}
                    {paymentSuccess ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>{billing.paymentSuccessLabel}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={handlePayWithBalance}
                          disabled={isProcessing}
                          className="w-full"
                        >
                          <WalletIcon className="mr-2 h-4 w-4" />
                          {isProcessing ? "Processing..." : "Pay with Balance"}
                        </Button>
                        <Button
                          onClick={handleTopupAndPay}
                          disabled={isProcessing}
                          variant="outline"
                          className="w-full"
                        >
                          <PlusIcon className="mr-2 h-4 w-4" />
                          {isProcessing ? "Processing..." : "Top Up + Pay"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Top-up Required Dialog */}
      <Dialog open={showTopupDialog} onOpenChange={setShowTopupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top-Up Required</DialogTitle>
            <DialogDescription>
              You need additional balance to pay this invoice. A top-up invoice
              has been created for the gap amount.
            </DialogDescription>
          </DialogHeader>
          {topupResult && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gap Amount</span>
                  <span className="font-medium">
                    {formatInvoiceCurrency(
                      Number(topupResult.gapAmount ?? 0),
                      account?.currency || invoiceCurrency
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Top-up Invoice</span>
                  <span className="font-medium">
                    {topupResult.topupInvoiceNumber}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Please complete the top-up payment first. After the payment is
                confirmed, the invoice will be automatically paid using your
                balance.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link href="/console/billing/topup">Go to Top-Up</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
