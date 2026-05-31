"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"
import { getInvoice, getAccount, payWithBalance, topupAndPay } from "@/lib/billing-client"
import type { InvoiceDetail, BillingAccount } from "@/lib/billing-client"
import { ArrowLeftIcon, DownloadIcon, WalletIcon, PlusIcon, CheckCircleIcon } from "@phosphor-icons/react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  const invoiceId = params.id as string

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

  useEffect(() => {
    async function loadData() {
      try {
        const [invoiceResult, accountResult] = await Promise.all([
          getInvoice(invoiceId),
          getAccount(),
        ])
        setData(invoiceResult)
        setAccount(accountResult)
      } catch {
        setError("Failed to load invoice")
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [invoiceId])

  function formatCurrency(amountIdr: string, currency: string): string {
    const amount = Number.parseFloat(amountIdr)
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "N/A"
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
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

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/console/billing/invoices">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Invoice {invoice.invoiceNumber}</h1>
          <InvoiceStatusBadge status={invoice.status as "PENDING" | "PAID" | "VOID"} />
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Invoice Details</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled>
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invoice Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Invoice Number</p>
              <p className="font-medium">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Issued Date</p>
              <p className="font-medium">{formatDate(invoice.issuedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(invoice.dueAt)}</p>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h3 className="mb-4 font-medium">Line Items</h3>
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="px-4 py-3 text-sm">{line.description}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {Number.parseFloat(line.quantity).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {formatCurrency(line.unitPriceIdr, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {formatCurrency(line.amountIdr, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.totalAmountIdr, invoice.currency)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(invoice.totalAmountIdr, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment Actions - only for OPEN invoices */}
          {invoice.status === "OPEN" && account && (
            <div className="border-t pt-4">
              <h3 className="mb-4 font-medium">Payment Options</h3>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
