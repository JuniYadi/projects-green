"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
} from "@phosphor-icons/react"
import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"
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
  const params = useParams()
  const searchParams = useSearchParams()
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

  function formatCurrency(amountIdr: string, currency: string): string {
    const amount = Number.parseFloat(amountIdr)
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "N/A"
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(dateStr))
  }

  /** Format period dates in UTC to avoid timezone rollover (end-of-month → next month in WIB). */
  function formatPeriodDate(dateStr: string): string {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
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
      // Refresh data
      const result = await getInvoice(invoiceId)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
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
        <header className="space-y-1">
          <Skeleton className="h-8 w-64" />
        </header>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48" />
          </CardContent>
        </Card>
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
          <h1 className="text-2xl font-semibold">Invoice Not Found</h1>
        </header>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || "Invoice not found"}
          </p>
        </div>
      </main>
    )
  }

  const invoice = data.invoice
  const isTopUp = invoice.type === "TOP_UP"
  const issueDate = invoice.issuedAt ?? invoice.createdAt ?? null
  const dueDate = invoice.dueAt ?? invoice.dueDate ?? null
  const confirmations =
    (
      data as unknown as {
        confirmations?: Array<{
          id: string
          status: string
          createdAt: string
          amount: number
        }>
      }
    ).confirmations ?? []
  const latestConfirmation =
    confirmations.length > 0 ? confirmations[confirmations.length - 1] : null
  const activeConfirmation =
    latestConfirmation &&
    (latestConfirmation.status === "PENDING" ||
      latestConfirmation.status === "APPROVED")
      ? latestConfirmation
      : null
  const confirmPaymentHref = `/console/billing/payments/confirm?invoiceId=${invoice.id}`
  const defaultPaymentMethod =
    paymentMethods.find((method) => method.isActive && method.isDefault) ??
    paymentMethods.find((method) => method.isActive) ??
    null
  const isManualPayment =
    invoice.paymentMethod === "MANUAL_BANK" ||
    invoice.paymentMethod === "manual_bank_transfer"
  const isGatewayPayment =
    invoice.paymentMethod === "PAYMENT_GATEWAY" ||
    invoice.paymentMethod === "payment_gateway"

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/console/billing/invoices">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            Invoice {invoice.invoiceNumber}
          </h1>
          <InvoiceStatusBadge
            status={invoice.status as "OPEN" | "PENDING" | "PAID" | "VOID"}
          />
        </div>
      </header>

      {/* Payment Status Banner (after Duitku redirect) */}
      {paymentStatus === "success" && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-600 dark:text-green-400">
              Payment Successful
            </p>
            <p className="text-sm text-muted-foreground">
              Your payment has been processed. The balance will be updated
              shortly.
            </p>
          </div>
        </div>
      )}
      {paymentStatus === "pending" && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">
              Payment Pending
            </p>
            <p className="text-sm text-muted-foreground">
              Your payment is being processed. This may take a few minutes.
            </p>
          </div>
        </div>
      )}
      {paymentStatus === "failed" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium text-red-600 dark:text-red-400">
              Payment Failed
            </p>
            <p className="text-sm text-muted-foreground">
              The payment could not be processed. Please try again.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href="/console/billing/topup">Retry Payment</Link>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Invoice Details</CardTitle>
            <InvoiceDownloadPdfAction
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invoice Info */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Invoice Number</p>
              <p className="font-medium">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing Period</p>
              <p className="font-medium">
                {formatPeriodDate(invoice.periodStart)} —{" "}
                {formatPeriodDate(invoice.periodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Issued Date</p>
              <p className="font-medium">{formatDate(issueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(dueDate)}</p>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h3 className="mb-4 font-medium">
              {invoice.type === "TOP_UP" ? "Top-Up Details" : "Service Charges"}
            </h3>
            {invoice.type === "TOP_UP" ? (
              <div className="rounded-lg border">
                <InvoiceFlatLine lines={invoice.lines} />
              </div>
            ) : (
              <InvoiceGroupedLines
                lines={invoice.lines}
                periodLabel={
                  formatPeriodDate(invoice.periodStart) +
                  " — " +
                  formatPeriodDate(invoice.periodEnd)
                }
              />
            )}
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>
                  {formatCurrency(invoice.totalAmountIdr, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>
                  {formatCurrency(invoice.totalAmountIdr, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Actions - top-up invoices show payment-method instructions */}
          {invoice.status === "OPEN" && isTopUp && (
            <div className="border-t pt-4">
              <h3 className="mb-4 font-medium">Complete Your Top-Up</h3>
              {isManualPayment ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Transfer the exact total amount{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(invoice.totalAmountIdr, invoice.currency)}
                    </span>{" "}
                    to the destination bank account, then confirm your payment.
                  </p>
                  {defaultPaymentMethod ? (
                    <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium">
                          {defaultPaymentMethod.bankName}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Account Number
                        </span>
                        <span className="font-medium">
                          {defaultPaymentMethod.accountNumber}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Account Name
                        </span>
                        <span className="font-medium">
                          {defaultPaymentMethod.accountName}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
                      Bank account details are not available right now. Please
                      contact support before transferring this payment.
                    </p>
                  )}
                  <Button asChild disabled={!!activeConfirmation}>
                    <Link href={confirmPaymentHref}>
                      <CheckCircleIcon className="mr-2 h-4 w-4" />
                      {activeConfirmation
                        ? "Already confirmed — pending review"
                        : "Confirm Payment"}
                    </Link>
                  </Button>
                </div>
              ) : isGatewayPayment ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Complete your payment through the payment gateway. Your
                    balance will be updated automatically once the payment is
                    confirmed.
                  </p>
                  {invoice.paymentUrl ? (
                    <Button asChild>
                      <Link
                        href={invoice.paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Continue to Payment Gateway
                      </Link>
                    </Button>
                  ) : (
                    <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
                      The payment gateway link is not available for this
                      invoice. Please create a new top-up or contact support.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This invoice does not have a payment method selected yet.
                </p>
              )}
            </div>
          )}

          {/* Payment Actions - balance options only for non-top-up OPEN invoices */}
          {invoice.status === "OPEN" && !isTopUp && account && (
            <div className="border-t pt-4">
              <h3 className="mb-4 font-medium">Payment Options</h3>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}
              {paymentSuccess ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="font-medium">Payment successful!</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handlePayWithBalance}
                    disabled={isProcessing}
                    variant="default"
                  >
                    <WalletIcon className="mr-2 h-4 w-4" />
                    {isProcessing ? "Processing..." : "Pay with Balance"}
                  </Button>
                  <Button
                    onClick={handleTopupAndPay}
                    disabled={isProcessing}
                    variant="outline"
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    {isProcessing ? "Processing..." : "Top Up + Pay"}
                  </Button>
                </div>
              )}
              {account && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your current balance: {account.formattedBalance}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                    {formatCurrency(String(topupResult.gapAmount), "IDR")}
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
