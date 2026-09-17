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
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  getInvoiceStatusLabel,
  getNextRenewalDate,
} from "@/modules/invoices/invoices.helpers"
import type {
  InvoiceDetail,
  InvoiceDetailSuccessResponse,
  InvoiceErrorResponse,
  PaymentInfoDTO,
} from "@/modules/invoices/invoices.types"
import { InvoiceDownloadPdfAction } from "@/modules/invoices/ui/invoice-download-pdf-action"
import { InvoiceStatusPill } from "@/modules/invoices/ui/invoice-status-pill"
import { InvoiceDetailSkeleton } from "@/modules/invoices/ui/invoice-detail-skeleton"
import {
  PaymentConfirmationList,
  PaymentMethodGatewayCard,
  PaymentTimeline,
} from "@/modules/invoices/ui/invoice-payment-section"
import { MarkPaidDialog } from "@/modules/invoices/ui/mark-paid-dialog"

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
      canMarkPaid: boolean
      canManageConfirmations: boolean
      payment: PaymentInfoDTO | null
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

export function InvoiceDetailScreen({
  invoiceId,
  lang,
}: InvoiceDetailScreenProps) {
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessagesForMaybeLocale(lang).console.invoices.detail
  const router = useRouter()
  const [state, setState] = useState<InvoiceDetailRequestState>({
    status: "loading",
  })
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false)
  const [isCancelSheetOpen, setIsCancelSheetOpen] = useState(false)
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelErrorMessage, setCancelErrorMessage] = useState<string | null>(
    null
  )

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}`, {
          signal,
        })

        const payload = (await response.json().catch(() => null)) as
          InvoiceDetailSuccessResponse | InvoiceErrorResponse | null

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
          canMarkPaid: payload.canMarkPaid ?? false,
          canManageConfirmations: payload.canManageConfirmations ?? false,
          payment: payload.payment ?? null,
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
        { ok: true; invoice: InvoiceDetail } | InvoiceErrorResponse | null

      if (!response.ok || !payload || payload.ok !== true) {
        setCancelErrorMessage(
          getErrorMessage(payload as InvoiceErrorResponse | null)
        )
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadDetail()}
          >
            {messages.retry}
          </Button>
        </div>
      </div>
    )
  }

  const { invoice } = state
  const canPay = invoice.status === "open"

  return (
    <section className="flex w-full max-w-7xl flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {invoice.invoiceNumber}
              </h1>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{invoice.id}</span>
              <span className="mx-2">•</span>
              <span>
                {messages.issuedDateLabel}:{" "}
                {formatInvoiceDate(invoice.issuedAt, locale)}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {messages.actionsHeading}
            </span>
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
              {messages.payInvoice}
            </Button>
            {state.canMarkPaid ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsMarkPaidOpen(true)}
              >
                {messages.markAsPaid}
              </Button>
            ) : null}
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
                {messages.markInvoiceCanceled}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Card>
            <CardContent className="grid gap-6 divide-y divide-border p-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="space-y-1 text-sm">
                <p className="pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {messages.billedToHeading}
                </p>
                <p className="font-semibold text-foreground">
                  {state.organization?.billingFullName ||
                    state.organization?.name ||
                    "—"}
                </p>
                <p className="text-muted-foreground">
                  {state.organization?.billingAddress || "—"}
                </p>
                <p className="text-muted-foreground">
                  {[
                    state.organization?.billingCity,
                    state.organization?.billingState,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
                <p className="text-muted-foreground">
                  {[
                    state.organization?.billingCountry,
                    state.organization?.billingPostCode,
                  ]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </p>
              </div>

              <div className="space-y-1 pt-4 text-sm sm:pt-0 sm:pl-6">
                <p className="pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {messages.paidToHeading}
                </p>
                <p className="font-semibold text-foreground">
                  {messages.companyName}
                </p>
                <p className="text-muted-foreground">
                  {messages.companyAddressLine1}
                </p>
                <p className="text-muted-foreground">
                  {messages.companyAddressLine2}
                </p>
                <p className="text-muted-foreground">
                  {messages.companyEmailLine}
                </p>
                <p className="text-muted-foreground">
                  {messages.companyWhatsappLine}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {messages.lineItemsHeading}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">
                        {messages.descriptionColumn}
                      </TableHead>
                      <TableHead className="text-right">
                        {messages.qtyColumn}
                      </TableHead>
                      <TableHead className="text-right">
                        {messages.unitPriceColumn}
                      </TableHead>
                      <TableHead className="pr-6 text-right">
                        {messages.amountColumn}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lineItems.map((lineItem) => (
                      <TableRow key={lineItem.id}>
                        <TableCell className="pl-6 font-medium">
                          {lineItem.description}
                        </TableCell>
                        <TableCell className="text-right">
                          {lineItem.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatInvoiceCurrency(
                            lineItem.unitPrice,
                            lineItem.currency,
                            locale
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          {formatInvoiceCurrency(
                            lineItem.amount,
                            lineItem.currency,
                            locale
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col items-end border-t bg-muted/15 px-6 py-4">
                <div className="w-full max-w-xs space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {messages.subtotalLabel}
                    </span>
                    <span className="font-medium">
                      {formatInvoiceCurrency(
                        invoice.subtotalAmount,
                        invoice.currency,
                        locale
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {messages.taxLabel}
                    </span>
                    <span className="font-medium">
                      {formatInvoiceCurrency(
                        invoice.taxAmount,
                        invoice.currency,
                        locale
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {messages.discountLabel}
                    </span>
                    <span className="font-medium">
                      {formatInvoiceCurrency(
                        invoice.discountAmount,
                        invoice.currency,
                        locale
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2 font-semibold">
                    <span className="text-base">{messages.totalLabel}</span>
                    <span className="text-base font-bold text-foreground">
                      {formatInvoiceCurrency(
                        invoice.totalAmount,
                        invoice.currency,
                        locale
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {state.payment?.confirmations &&
          state.payment.confirmations.length > 0 ? (
            <PaymentConfirmationList
              confirmations={state.payment.confirmations}
              canManage={state.canManageConfirmations}
              onActionComplete={() => void loadDetail()}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {messages.overviewHeading}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              <div className="flex items-center justify-between py-2.5 first:pt-0">
                <span className="text-xs text-muted-foreground">
                  {messages.statusLabel}
                </span>
                <InvoiceStatusPill status={invoice.status} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">
                  {messages.invoiceNumberLabel}
                </span>
                <span className="font-mono text-xs font-medium">
                  {invoice.invoiceNumber}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">
                  {messages.invoiceIdLabel}
                </span>
                <span
                  className="max-w-[140px] truncate font-mono text-xs"
                  title={invoice.id}
                >
                  {invoice.id}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">
                  {messages.issuedDateLabel}
                </span>
                <span className="font-medium">
                  {formatInvoiceDate(invoice.issuedAt, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">
                  {messages.dueDateLabel}
                </span>
                <span className="font-medium">
                  {formatInvoiceDate(invoice.dueAt, locale)}
                </span>
              </div>
              <div className="flex flex-col gap-1 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {messages.servicePeriodLabel}
                </span>
                <span className="text-xs font-medium">
                  {formatInvoiceDate(invoice.periodStart, locale)} -{" "}
                  {formatInvoiceDate(invoice.periodEnd, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">
                  {messages.serviceEndsLabel}
                </span>
                <span className="font-medium">
                  {formatInvoiceDate(invoice.periodEnd, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <span className="text-xs text-muted-foreground">
                  {messages.nextRenewalDateLabel}
                </span>
                <span className="font-medium">
                  {formatInvoiceDate(
                    getNextRenewalDate(invoice.periodEnd),
                    locale
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          {state.payment ? (
            <PaymentMethodGatewayCard payment={state.payment} />
          ) : null}

          {state.payment?.timeline && state.payment.timeline.length > 0 ? (
            <PaymentTimeline timeline={state.payment.timeline} />
          ) : null}
        </div>
      </div>

      <Sheet open={isPaymentDrawerOpen} onOpenChange={setIsPaymentDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{messages.payInvoice}</SheetTitle>
            <SheetDescription>
              {invoice.invoiceNumber} ·{" "}
              {formatInvoiceCurrency(
                invoice.totalAmount,
                invoice.currency,
                locale
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4 pt-4 text-sm">
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">
                {messages.invoiceStatusLabel}
              </p>
              <p className="font-medium">
                {getInvoiceStatusLabel(invoice.status)}
              </p>
            </div>
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              {messages.confirmPaymentNote}
            </p>
          </div>

          <SheetFooter>
            <Button
              type="button"
              onClick={() => {
                router.push(
                  `/${lang}/console/billing/payments/confirm?invoiceId=${encodeURIComponent(
                    invoice.id
                  )}&amount=${Math.round(invoice.totalAmount)}`
                )
              }}
            >
              {messages.confirmPaymentButton}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <MarkPaidDialog
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        open={isMarkPaidOpen}
        onOpenChange={setIsMarkPaidOpen}
        onSuccess={() => void loadDetail()}
      />

      <Sheet open={isCancelSheetOpen} onOpenChange={setIsCancelSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{messages.markInvoiceCanceled}</SheetTitle>
            <SheetDescription>
              {messages.cancelNotePrefix} {invoice.invoiceNumber}{" "}
              {messages.cancelNoteSuffix}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4 pt-4 text-sm">
            <p>{messages.cancelConfirmText}</p>
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
              {messages.keepInvoice}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleMarkCanceled()}
              disabled={isCanceling}
            >
              {isCanceling ? messages.canceling : messages.confirmCanceled}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  )
}
