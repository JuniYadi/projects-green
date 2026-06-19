"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { PaymentConfirmationDTO } from "@/modules/invoices/invoices.types"

type ConfirmPaymentDialogProps = {
  confirmation: PaymentConfirmationDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
  onActionComplete: () => void
}

export function ConfirmPaymentDialog({
  confirmation,
  open,
  onOpenChange,
  canManage,
  onActionComplete,
}: ConfirmPaymentDialogProps) {
  const [rejectReason, setRejectReason] = useState("")
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAction = async () => {
    if (!action) return

    setLoading(true)
    setError(null)

    try {
      const body =
        action === "reject"
          ? JSON.stringify({ action: "reject", reason: rejectReason })
          : undefined

      const response = await fetch(
        `/portal/payments/confirmations/${confirmation.id}/${action}`,
        {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body,
        }
      )

      const payload = (await response.json().catch(() => null)) as {
        ok: boolean
        message?: string
      } | null

      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? `Failed to ${action} confirmation.`)
        setLoading(false)
        return
      }

      onOpenChange(false)
      onActionComplete()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Unable to ${action} confirmation.`
      )
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setAction(null)
    setRejectReason("")
    setError(null)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState()
    }
    onOpenChange(open)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {action === "reject" ? "Reject Payment" : "Approve Payment"}
          </SheetTitle>
          <SheetDescription>
            {confirmation.senderName
              ? `From: ${confirmation.senderName}`
              : `Amount: ${confirmation.amount} ${confirmation.currency}`}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pt-4 text-sm">
          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">Bank</p>
            <p className="font-medium">{confirmation.bankName}</p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="font-medium">
              {confirmation.amount.toLocaleString()} {confirmation.currency}
            </p>
          </div>

          {confirmation.senderName ? (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">Sender</p>
              <p className="font-medium">{confirmation.senderName}</p>
            </div>
          ) : null}

          {confirmation.senderBankName ? (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">Sender Bank</p>
              <p className="font-medium">{confirmation.senderBankName}</p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">Payment Date</p>
            <p className="font-medium">
              {new Date(confirmation.paymentDateTime).toLocaleDateString()}
            </p>
          </div>

          {confirmation.screenshotUrl ? (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">Screenshot</p>
              <a
                href={confirmation.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
              >
                View Screenshot
              </a>
            </div>
          ) : null}

          {confirmation.notes ? (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm text-muted-foreground">
                {confirmation.notes}
              </p>
            </div>
          ) : null}

          {!action && canManage ? (
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="default"
                onClick={() => setAction("approve")}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setAction("reject")}
              >
                Reject
              </Button>
            </div>
          ) : null}

          {action === "reject" ? (
            <div className="grid gap-2">
              <label
                htmlFor="reject-reason"
                className="text-xs font-medium text-muted-foreground"
              >
                Rejection Reason
              </label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this payment is being rejected..."
                className="min-h-[80px]"
              />
            </div>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        {action ? (
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => resetState()}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              type="button"
              variant={action === "reject" ? "destructive" : "default"}
              onClick={() => void handleAction()}
              disabled={
                loading || (action === "reject" && !rejectReason.trim())
              }
            >
              {loading
                ? "Processing..."
                : action === "reject"
                  ? "Confirm Reject"
                  : "Confirm Approve"}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
