"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
} from "@/modules/invoices/invoices.helpers"
import type {
  InvoiceDetail,
  InvoiceDetailSuccessResponse,
  InvoiceErrorResponse,
} from "@/modules/invoices/invoices.types"
import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"
import { InvoiceStatusPill } from "@/modules/invoices/ui/invoice-status-pill"
import { InvoiceDetailSkeleton } from "@/modules/invoices/ui/invoice-detail-skeleton"

type InvoiceDetailScreenProps = {
  invoiceId: string
  lang: string
}

type InvoiceDetailRequestState =
  | { status: "loading" }
  | {
      status: "success"
      invoice: InvoiceDetail
      canMarkCanceled: boolean
      organization: {
        name: string
        billingFullName?: string | null
        billingAddress?: string | null
        billingCity?: string | null
        billingState?: string | null
        billingCountry?: string | null
        billingPostCode?: string | null
      } | null
    }
  | {
      status: "error"
      message: string
    }

const getErrorMessage = (payload: InvoiceErrorResponse | null) => {
  if (payload?.message) {
    return payload.message
  }

  return "Unable to load invoice detail right now."
}

export function InvoiceDetailScreen({ invoiceId, lang }: InvoiceDetailScreenProps) {
  const locale = resolveLocaleOrDefault(lang)
  const router = useRouter()
  const [state, setState] = useState<InvoiceDetailRequestState>({
    status: "loading",
  })
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false)
  const [isCancelSheetOpen, setIsCancelSheetOpen] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelErrorMessage, setCancelErrorMessage] = useState<string | null>(null)

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}`, {
          signal,
        })

        const payload = (await response.json().catch(() => null)) as
          | InvoiceDetailSuccessResponse
          | InvoiceErrorResponse
          | null

        if (!response.ok || !payload || payload.ok !== true) {
          setState({
            status: "error",
            message: getErrorMessage(payload as InvoiceErrorResponse | null),
          })
          return
        }

        setState({
          status: "success",
          invoice: payload.invoice,
          canMarkCanceled: payload.canMarkCanceled,
          organization: payload.organization ?? null,
        })
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load invoice detail right now.",
        })
      }
    },
    [invoiceId]
  )

  const loadDetail = async () => {
    setState({ status: "loading" })
    await fetchDetail()
  }

  useEffect(() => {
    const controller = new AbortController()

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDetail(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchDetail])

  const handleMarkCanceled = async () => {
    setIsCanceling(true)
    setCancelErrorMessage(null)

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/cancel`, {
        method: "POST",
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; invoice: InvoiceDetail }
        | InvoiceErrorResponse
        | null

      if (!response.ok || !payload || payload.ok !== true) {
        setCancelErrorMessage(getErrorMessage(payload as InvoiceErrorResponse | null))
        setIsCanceling(false)
        return
      }

      setState((prev) => {
        if (prev.status !== "success") return prev
        return {
          ...prev,
          invoice: payload.invoice,
          canMarkCanceled: false,
        }
      })
      setIsCancelSheetOpen(false)
      router.refresh()
    } catch (error) {
      setCancelErrorMessage(
        error instanceof Error ? error.message : "Unable to cancel invoice."
      )
    } finally {
      setIsCanceling(false)
    }
  }

  if (state.status === "loading") {
    return <InvoiceDetailSkeleton />
  }

  if (state.status === "error") {
    return (
      <div className="grid gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm">
        <p className="text-destructive">{state.message}</p>
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadDetail()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const { invoice } = state
  const canPay = invoice.status === "open"

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <InvoiceDownloadPdfAction
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsPaymentDrawerOpen(true)}
            disabled={!canPay}
          >
            Pay Invoice
          </Button>
          {state.canMarkCanceled ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                setCancelErrorMessage(null)
                setIsCancelSheetOpen(true)
              }}
            >
              Mark Invoice Canceled
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Invoice Number</p>
            <p className="font-medium">{invoice.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invoice ID</p>
            <p className="font-medium">{invoice.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="pt-1">
              <InvoiceStatusPill status={invoice.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="font-medium">
              {formatInvoiceDate(invoice.periodStart, locale)} -{" "}
              {formatInvoiceDate(invoice.periodEnd, locale)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Issued Date</p>
            <p className="font-medium">{formatInvoiceDate(invoice.issuedAt, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="font-medium">{formatInvoiceDate(invoice.dueAt, locale)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "id" ? "Di Tagih Kepada" : "Billed To"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-semibold text-foreground">
              {state.organization?.billingFullName || state.organization?.name || "—"}
            </p>
            <p className="text-muted-foreground">
              {state.organization?.billingAddress || "—"}
            </p>
            <p className="text-muted-foreground">
              {[state.organization?.billingCity, state.organization?.billingState]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
            <p className="text-muted-foreground">
              {[state.organization?.billingCountry, state.organization?.billingPostCode]
                .filter(Boolean)
                .join(" ") || "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "id" ? "Di Bayar Kepada" : "Paid To"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-semibold text-foreground">PFNApp Technologies Inc.</p>
            <p className="text-muted-foreground">Sudirman Central Business District (SCBD)</p>
            <p className="text-muted-foreground">Jakarta, DKI Jakarta</p>
            <p className="text-muted-foreground">Indonesia, 12190</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lineItems.map((lineItem) => (
                <TableRow key={lineItem.id}>
                  <TableCell className="font-medium">{lineItem.description}</TableCell>
                  <TableCell className="text-right">{lineItem.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatInvoiceCurrency(
                      lineItem.unitPrice,
                      lineItem.currency,
                      locale
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatInvoiceCurrency(lineItem.amount, lineItem.currency, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground">Subtotal</p>
            <p className="font-medium">
              {formatInvoiceCurrency(invoice.subtotalAmount, invoice.currency, locale)}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground">Tax</p>
            <p className="font-medium">
              {formatInvoiceCurrency(invoice.taxAmount, invoice.currency, locale)}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground">Discount</p>
            <p className="font-medium">
              {formatInvoiceCurrency(invoice.discountAmount, invoice.currency, locale)}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <p className="font-semibold">Total</p>
            <p className="font-semibold">
              {formatInvoiceCurrency(invoice.totalAmount, invoice.currency, locale)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Sheet open={isPaymentDrawerOpen} onOpenChange={setIsPaymentDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Pay Invoice</SheetTitle>
            <SheetDescription>
              {invoice.invoiceNumber} · {formatInvoiceCurrency(invoice.totalAmount, invoice.currency, locale)}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4 pt-4 text-sm">
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">Invoice Status</p>
              <p className="font-medium">{getInvoiceStatusLabel(invoice.status)}</p>
            </div>
            {invoice.manualTransfer ? (
              <div className="grid gap-1 rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Amount to transfer</p>
                <p className="text-base font-semibold">
                  {formatInvoiceCurrency(
                    invoice.manualTransfer.finalAmount ?? invoice.totalAmount,
                    invoice.currency,
                    locale
                  )}
                </p>
                {invoice.manualTransfer.uniqueCode != null ? (
                  <p className="text-xs text-muted-foreground">
                    Includes a unique code of {invoice.manualTransfer.uniqueCode}.
                    Transfer the exact amount so we can match your payment
                    automatically.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                After transferring the amount above to the destination account,
                confirm your payment so we can verify and credit your balance.
              </p>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              onClick={() => {
                const amount = invoice.manualTransfer?.finalAmount ?? invoice.totalAmount
                router.push(
                  `/console/billing/payments/confirm?invoiceId=${encodeURIComponent(
                    invoice.id
                  )}&amount=${Math.round(amount)}`
                )
              }}
            >
              Confirm Payment
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isCancelSheetOpen} onOpenChange={setIsCancelSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Mark Invoice Canceled</SheetTitle>
            <SheetDescription>
              This action sets invoice {invoice.invoiceNumber} to canceled status.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4 pt-4 text-sm">
            <p>
              Are you sure you want to mark this invoice as canceled? This action
              is intended for billing corrections.
            </p>
            {cancelErrorMessage ? (
              <p className="text-xs text-destructive">{cancelErrorMessage}</p>
            ) : null}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelSheetOpen(false)}
            >
              Keep Invoice
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleMarkCanceled()}
              disabled={isCanceling}
            >
              {isCanceling ? "Canceling..." : "Confirm Canceled"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  )
}
