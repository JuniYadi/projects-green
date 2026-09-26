"use client"

import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface PaymentConfirmation {
  id: string
  amount: number
  currency: string
  invoiceId: string
  invoiceNumber?: string | null
  invoiceTotal?: number | null
  bankAccountId: string
  bankName: string
  accountName?: string
  accountNumber: string
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  notes?: string | null
}

const STATUS_VARIANTS: Record<
  PaymentConfirmation["status"],
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
}

const STATUS_FILTER_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
]

function formatConfirmationAmount(confirmation: PaymentConfirmation): string {
  if (!confirmation.currency) {
    return new Intl.NumberFormat("id-ID").format(confirmation.amount)
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: confirmation.currency,
  }).format(confirmation.amount)
}

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function PaymentStatusBadge({
  status,
}: {
  status: PaymentConfirmation["status"]
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className="text-xs capitalize">
      {status}
    </Badge>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-muted/20 p-3">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value || "-"}</dd>
    </div>
  )
}

type ConfirmationsRequestState =
  | { status: "loading" }
  | { status: "success"; data: PaymentConfirmation[] }
  | { status: "error"; message: string }

export function ConfirmationsTab() {
  const params = useParams<{ lang?: string }>()
  const searchParams = useSearchParams()
  const confirmationId = searchParams.get("confirmation")
  const lang = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(lang).console.adminBillingPayments.confirmations
  const [state, setState] = useState<ConfirmationsRequestState>({
    status: "loading",
  })
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [selectedConfirmation, setSelectedConfirmation] =
    useState<PaymentConfirmation | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [verifiedAmount, setVerifiedAmount] = useState("")

  const fetchConfirmations = useCallback(async () => {
    try {
      const { data, error } = await eden.api.portal.payments.confirmations.get()

      if (error) {
        setState({
          status: "error",
          message:
            (error.value as { message?: string })?.message ||
            "Failed to load confirmations",
        })
        return
      }
      setState({
        status: "success",
        data: (data as PaymentConfirmation[]) ?? [],
      })
    } catch {
      setState({ status: "error", message: "Failed to load confirmations" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfirmations()
  }, [fetchConfirmations])

  useEffect(() => {
    if (!confirmationId || state.status !== "success") return
    let cancelled = false
    const openConfirmation = (confirmation: PaymentConfirmation) => {
      if (cancelled) return
      setSelectedConfirmation(confirmation)
      setVerifiedAmount(String(confirmation.amount))
    }
    const existing = state.data.find((item) => item.id === confirmationId)
    if (existing) {
      openConfirmation(existing)
    } else {
      void eden.api.portal.payments.confirmations[confirmationId]
        .get()
        .then(({ data, error }) => {
          if (!error && data && "id" in data) {
            openConfirmation(data as PaymentConfirmation)
          }
        })
        .catch((error) =>
          console.error("Failed to load confirmation from email link:", error)
        )
    }
    return () => {
      cancelled = true
    }
  }, [confirmationId, state])

  async function reviewConfirmation(
    id: string,
    action: "approve" | "reject",
    reason?: string,
    amount?: number
  ) {
    setPendingActionId(`${action}:${id}`)
    try {
      const { error } = await eden.api.portal.payments.confirmations[id][
        action
      ].post({
        action,
        amount: action === "approve" ? amount : undefined,
        reason:
          action === "reject"
            ? reason?.trim() || "Rejected from portal review"
            : undefined,
      } as never)
      if (error) {
        setState({
          status: "error",
          message:
            (error.value as { message?: string })?.message ||
            `Failed to ${action} confirmation`,
        })
        return
      }
      setSelectedConfirmation(null)
      setRejectReason("")
      setVerifiedAmount("")
      await fetchConfirmations()
    } catch {
      setState({ status: "error", message: `Failed to ${action} confirmation` })
    } finally {
      setPendingActionId(null)
    }
  }

  const confirmationColumns = useMemo<ColumnDef<PaymentConfirmation>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.colInvoice} />
        ),
        cell: ({ row }) => {
          const invoiceNumber =
            row.original.invoiceNumber || row.original.invoiceId
          const invoiceId = row.original.invoiceId

          if (!invoiceId) {
            return <span className="text-muted-foreground">-</span>
          }

          return (
            <Link
              href={`/${lang}/portal/billing/invoices/${invoiceId}`}
              className="font-mono text-xs font-semibold text-primary hover:underline"
            >
              {invoiceNumber}
            </Link>
          )
        },
      },
      {
        accessorKey: "submittedAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.colSubmitted}
          />
        ),
        cell: ({ row }) => formatSubmittedAt(row.original.submittedAt),
        sortingFn: "datetime",
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.colAmount} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {formatConfirmationAmount(row.original)}
          </span>
        ),
      },
      {
        id: "bankAccount",
        accessorFn: (row) =>
          [row.bankName, row.accountName, row.accountNumber]
            .filter(Boolean)
            .join(" "),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.colBankAccount}
          />
        ),
        cell: ({ row }) => (
          <div className="grid gap-1">
            <span className="font-medium">{row.original.bankName}</span>
            <span className="text-xs text-muted-foreground">
              {[row.original.accountNumber, row.original.accountName]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.colStatus} />
        ),
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "notes",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={messages.colNotes} />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.notes || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {messages.actions}
          </span>
        ),
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedConfirmation(row.original)
              setRejectReason("")
              setVerifiedAmount(String(row.original.amount))
            }}
          >
            {messages.review}
          </Button>
        ),
      },
    ],
    [lang, messages]
  )

  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {state.message}
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchConfirmations()}
          >
            {messages.retry}
          </Button>
        </div>
      </div>
    )
  }

  const confirmations = state.data
  const isPendingReview = selectedConfirmation?.status === "pending"
  const rejectDisabled =
    !selectedConfirmation || !rejectReason.trim() || pendingActionId !== null

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{messages.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            {messages.description}
          </div>

          <DataTable
            tableId="portal-payments-confirmations"
            columns={confirmationColumns}
            data={confirmations}
            defaultColumnVisibility={{
              notes: false,
              submittedAt: false,
            }}
            searchPlaceholder={messages.searchPlaceholder}
            searchableColumns={[
              "invoiceNumber",
              "bankAccount",
              "notes",
              "status",
            ]}
            facetFilters={[
              {
                columnId: "status",
                label: "Status",
                allLabel: "All status",
                options: STATUS_FILTER_OPTIONS,
              },
            ]}
            initialSorting={[{ id: "submittedAt", desc: false }]}
            emptyMessage={messages.emptyMessage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={selectedConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConfirmation(null)
            setRejectReason("")
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{messages.reviewModalTitle}</DialogTitle>
            <DialogDescription>{messages.reviewModalDesc}</DialogDescription>
          </DialogHeader>

          {selectedConfirmation && (
            <div className="grid gap-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label={messages.labelInvoice}
                  value={
                    selectedConfirmation.invoiceNumber
                      ? `${selectedConfirmation.invoiceNumber} (${selectedConfirmation.invoiceId})`
                      : selectedConfirmation.invoiceId || "-"
                  }
                />
                {selectedConfirmation.invoiceTotal !== null &&
                  selectedConfirmation.invoiceTotal !== undefined && (
                    <DetailRow
                      label={messages.labelInvoiceTotal}
                      value={formatConfirmationAmount({
                        ...selectedConfirmation,
                        amount: selectedConfirmation.invoiceTotal,
                      })}
                    />
                  )}
                <DetailRow
                  label={messages.labelSubmittedAmount}
                  value={formatConfirmationAmount(selectedConfirmation)}
                />
                <div className="grid gap-1 rounded-md border bg-muted/20 p-3">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {messages.labelStatus}
                  </dt>
                  <dd>
                    <PaymentStatusBadge status={selectedConfirmation.status} />
                  </dd>
                </div>
                <DetailRow
                  label={messages.labelBank}
                  value={selectedConfirmation.bankName}
                />
                <DetailRow
                  label={messages.labelAccountNumber}
                  value={selectedConfirmation.accountNumber}
                />
                <DetailRow
                  label={messages.labelAccountHolder}
                  value={selectedConfirmation.accountName || "-"}
                />
                <DetailRow
                  label={messages.labelSubmitted}
                  value={formatSubmittedAt(selectedConfirmation.submittedAt)}
                />
              </dl>

              {selectedConfirmation.invoiceTotal !== null &&
                selectedConfirmation.invoiceTotal !== undefined &&
                selectedConfirmation.amount >
                  selectedConfirmation.invoiceTotal && (
                  <div className="flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
                    <span className="font-semibold">
                      {messages.overpaymentDetected}
                    </span>
                    <span>
                      {messages.customerTransferred}
                      {formatConfirmationAmount({
                        ...selectedConfirmation,
                        amount:
                          selectedConfirmation.amount -
                          selectedConfirmation.invoiceTotal,
                      })}{" "}
                      {messages.overpaymentHelp}
                    </span>
                  </div>
                )}

              <div className="grid gap-1 rounded-md border bg-muted/20 p-3">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {messages.labelNotes}
                </dt>
                <dd className="text-sm text-foreground">
                  {selectedConfirmation.notes || "-"}
                </dd>
              </div>

              {isPendingReview && (
                <div className="grid gap-2">
                  <Label htmlFor="verifiedAmount">
                    {messages.verifiedAmountPrefix}
                    {selectedConfirmation.currency || "IDR"})
                  </Label>
                  <Input
                    id="verifiedAmount"
                    type="number"
                    step="any"
                    value={verifiedAmount}
                    onChange={(e) => setVerifiedAmount(e.target.value)}
                    placeholder={String(selectedConfirmation.amount)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {messages.verifiedAmountSuffix}
                  </p>
                </div>
              )}

              {isPendingReview && (
                <div className="grid gap-2">
                  <Label htmlFor="rejectReason">
                    {messages.rejectionReason}
                  </Label>
                  <Textarea
                    id="rejectReason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    onInput={(event) =>
                      setRejectReason(event.currentTarget.value)
                    }
                    placeholder={messages.rejectionPlaceholder}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedConfirmation(null)
                setRejectReason("")
              }}
            >
              {messages.close}
            </Button>
            {selectedConfirmation && isPendingReview && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={rejectDisabled}
                  onClick={() =>
                    void reviewConfirmation(
                      selectedConfirmation.id,
                      "reject",
                      rejectReason
                    )
                  }
                >
                  {messages.rejectPayment}
                </Button>
                <Button
                  type="button"
                  disabled={
                    pendingActionId !== null ||
                    !verifiedAmount ||
                    Number(verifiedAmount) <= 0 ||
                    isNaN(Number(verifiedAmount))
                  }
                  onClick={() =>
                    void reviewConfirmation(
                      selectedConfirmation.id,
                      "approve",
                      undefined,
                      Number(verifiedAmount) || selectedConfirmation.amount
                    )
                  }
                >
                  {messages.approvePayment}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
