"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState } from "react"

interface PaymentConfirmation {
  id: string
  amount: number
  currency: string
  bankAccountId: string
  bankName: string
  accountNumber: string
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  notes?: string
}

type ConfirmationsRequestState =
  | { status: "loading" }
  | { status: "success"; data: PaymentConfirmation[] }
  | { status: "error"; message: string }

const STATUS_VARIANTS: Record<PaymentConfirmation["status"], "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
}

export function ConfirmationsTab() {
  const [state, setState] = useState<ConfirmationsRequestState>({ status: "loading" })
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const fetchConfirmations = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/payments/confirmations")

      if (!response.ok) {
        setState({ status: "error", message: "Failed to load confirmations" })
        return
      }

      const payload = await response.json()

      if (payload.ok) {
        setState({ status: "success", data: payload.data || [] })
      } else {
        setState({ status: "error", message: payload.message || "Failed to load confirmations" })
      }
    } catch {
      setState({ status: "error", message: "Failed to load confirmations" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfirmations()
  }, [fetchConfirmations])

  async function reviewConfirmation(id: string, action: "approve" | "reject") {
    setPendingActionId(`${action}:${id}`)
    try {
      const response = await fetch(
        `/api/portal/payments/confirmations/${id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            action === "reject"
              ? JSON.stringify({
                  action: "reject",
                  reason: "Rejected from portal review",
                })
              : undefined,
        }
      )
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || `Failed to ${action} confirmation`,
        })
        return
      }
      await fetchConfirmations()
    } catch {
      setState({ status: "error", message: `Failed to ${action} confirmation` })
    } finally {
      setPendingActionId(null)
    }
  }

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Payment Confirmations</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          Manual payment confirmations must be submitted from a customer invoice/top-up flow so the
          invoice and organization context are known. Use this tab to review pending confirmations.
        </div>

        {confirmations.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No payment confirmations to review.
          </div>
        ) : (
          <div className="space-y-3">
            {confirmations.map((confirmation) => (
              <div
                key={confirmation.id}
                className="flex items-start justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: confirmation.currency,
                      }).format(confirmation.amount)}
                    </span>
                    <Badge variant={STATUS_VARIANTS[confirmation.status]} className="text-xs">
                      {confirmation.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {confirmation.bankName} - {confirmation.accountNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Submitted:{" "}
                    {new Date(confirmation.submittedAt).toLocaleDateString("id-ID")}
                  </div>
                  {confirmation.notes && (
                    <div className="mt-1 text-xs italic text-muted-foreground">
                      {confirmation.notes}
                    </div>
                  )}
                </div>
                {confirmation.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingActionId !== null}
                      onClick={() =>
                        void reviewConfirmation(confirmation.id, "reject")
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pendingActionId !== null}
                      onClick={() =>
                        void reviewConfirmation(confirmation.id, "approve")
                      }
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
