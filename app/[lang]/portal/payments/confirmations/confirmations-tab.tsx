"use client"

import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState, useMemo } from "react"
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
import { Textarea } from "@/components/ui/textarea"

interface PaymentConfirmation {
  id: string
  amount: number
  currency: string
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

function PaymentStatusBadge({ status }: { status: PaymentConfirmation["status"] }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className="text-xs capitalize">
      {status}
    </Badge>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-muted/20 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
  const [state, setState] = useState<ConfirmationsRequestState>({
    status: "loading",
  })
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [selectedConfirmation, setSelectedConfirmation] =
    useState<PaymentConfirmation | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const fetchConfirmations = useCallback(async () => {
    try {
      const { data: payload } = await eden.api.portal.payments.confirmations.get()

      if (!payload) {
        setState({ status: "error", message: "Failed to load confirmations" })
        return
      }

      const payload = await response.json()

      if (payload.ok) {
        setState({ status: "success", data: payload.data || [] })
      } else {
        setState({
          status: "error",
          message: payload.message || "Failed to load confirmations",
        })
      }
    } catch {
      setState({ status: "error", message: "Failed to load confirmations" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfirmations()
  }, [fetchConfirmations])

  async function reviewConfirmation(
    id: string,
    action: "approve" | "reject",
    reason?: string
  ) {
    setPendingActionId(`${action}:${id}`)
    try {
      const { data: payload } = await eden.api.portal.payments.confirmations[id][action].post({
        action,
        reason: action === "reject" ? reason?.trim() || "Rejected from portal review" : undefined,
      })
      if (!payload?.ok) {
        setState({
          status: "error",
          message: payload.message || `Failed to ${action} confirmation`,
        })
        return
      }
      setSelectedConfirmation(null)
      setRejectReason("")
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
        accessorKey: "submittedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) => formatSubmittedAt(row.original.submittedAt),
        sortingFn: "datetime",
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
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
          <DataTableColumnHeader column={column} title="Bank Account" />
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
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "notes",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Notes" />
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
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedConfirmation(row.original)
              setRejectReason("")
            }}
          >
            Review
          </Button>
        ),
      },
    ],
    []
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
          <Button type="button" size="sm" variant="outline" onClick={() => void fetchConfirmations()}>
            Retry
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
            <CardTitle className="text-base">Payment Confirmations</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            Manual payment confirmations must be submitted from a customer
            invoice/top-up flow so the invoice and organization context are known.
            Use this tab to review pending confirmations.
          </div>

          <DataTable
            columns={confirmationColumns}
            data={confirmations}
            searchPlaceholder="Filter confirmations..."
            searchableColumns={["bankAccount", "notes", "status"]}
            facetFilters={[
              {
                columnId: "status",
                label: "Status",
                allLabel: "All status",
                options: STATUS_FILTER_OPTIONS,
              },
            ]}
            initialSorting={[{ id: "submittedAt", desc: false }]}
            emptyMessage="No payment confirmations match your filters."
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
            <DialogTitle>Review payment confirmation</DialogTitle>
            <DialogDescription>
              Confirm the bank transfer details before marking the payment as
              received.
            </DialogDescription>
          </DialogHeader>

          {selectedConfirmation && (
            <div className="grid gap-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label="Amount"
                  value={formatConfirmationAmount(selectedConfirmation)}
                />
                <div className="grid gap-1 rounded-md border bg-muted/20 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </dt>
                  <dd>
                    <PaymentStatusBadge status={selectedConfirmation.status} />
                  </dd>
                </div>
                <DetailRow
                  label="Bank"
                  value={selectedConfirmation.bankName}
                />
                <DetailRow
                  label="Account number"
                  value={selectedConfirmation.accountNumber}
                />
                <DetailRow
                  label="Account holder"
                  value={selectedConfirmation.accountName || "-"}
                />
                <DetailRow
                  label="Submitted"
                  value={formatSubmittedAt(selectedConfirmation.submittedAt)}
                />
              </dl>

              <div className="grid gap-1 rounded-md border bg-muted/20 p-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes
                </dt>
                <dd className="text-sm text-foreground">
                  {selectedConfirmation.notes || "-"}
                </dd>
              </div>

              {isPendingReview && (
                <div className="grid gap-2">
                  <Label htmlFor="rejectReason">Rejection reason</Label>
                  <Textarea
                    id="rejectReason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    onInput={(event) =>
                      setRejectReason(event.currentTarget.value)
                    }
                    placeholder="Explain why this payment confirmation is rejected."
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
              Close
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
                  Reject payment
                </Button>
                <Button
                  type="button"
                  disabled={pendingActionId !== null}
                  onClick={() =>
                    void reviewConfirmation(selectedConfirmation.id, "approve")
                  }
                >
                  Approve received payment
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
