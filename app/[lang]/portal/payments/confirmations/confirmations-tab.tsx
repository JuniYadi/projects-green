"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  const [isCreating, setIsCreating] = useState(false)

  const fetchConfirmations = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/payments/confirmations")

      if (!response.ok) {
        setState({ status: "error", message: "Failed to load confirmations" })
        return
      }

      const payload = await response.json()

      if (payload.ok) {
        setState({ status: "success", data: payload.confirmations || [] })
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
          <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
            Submit Manual Payment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCreating && (
          <form className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              Use this intake form to capture a manual payment for review before
              approval or rejection.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Amount</span>
                <Input name="amount" inputMode="decimal" placeholder="1000000" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Bank account</span>
                <Input name="bankAccountId" placeholder="Destination bank account" />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Notes</span>
                <Input name="notes" placeholder="Transfer reference or notes" />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm">Save for review</Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

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
                    Submitted: {new Date(confirmation.submittedAt).toLocaleDateString("id-ID")}
                  </div>
                  {confirmation.notes && (
                    <div className="mt-1 text-xs italic text-muted-foreground">
                      {confirmation.notes}
                    </div>
                  )}
                </div>
                {confirmation.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline">
                      Reject
                    </Button>
                    <Button type="button" size="sm">
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
