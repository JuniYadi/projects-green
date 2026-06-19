"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

type MarkPaidDialogProps = {
  invoiceId: string
  invoiceNumber: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type PaymentMethodOption = {
  value: string
  label: string
}

const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: "MANUAL_BANK", label: "Manual Bank Transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
]

export function MarkPaidDialog({
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
  onSuccess,
}: MarkPaidDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("MANUAL_BANK")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setPaymentMethod("MANUAL_BANK")
    setReferenceNumber("")
    setNotes("")
    setError(null)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: paymentMethod || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      const payload = (await response.json().catch(() => null)) as {
        ok: boolean
        message?: string
        invoice?: unknown
      } | null

      if (!response.ok || !payload?.ok) {
        if (response.status === 409) {
          setError("Invoice has already been marked as paid.")
        } else {
          setError(payload?.message ?? "Failed to mark invoice as paid.")
        }
        setLoading(false)
        return
      }

      onOpenChange(false)
      resetState()
      onSuccess()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to mark invoice as paid."
      )
    } finally {
      setLoading(false)
    }
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
          <SheetTitle>Mark as Paid</SheetTitle>
          <SheetDescription>
            Manually mark invoice {invoiceNumber} as paid and credit the
            customer&apos;s balance.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pt-4 text-sm">
          <div className="grid gap-2">
            <label
              htmlFor="payment-method"
              className="text-xs font-medium text-muted-foreground"
            >
              Payment Method
            </label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="reference-number"
              className="text-xs font-medium text-muted-foreground"
            >
              Reference Number (optional)
            </label>
            <Input
              id="reference-number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. cheque number, transaction ID"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="notes"
              className="text-xs font-medium text-muted-foreground"
            >
              Notes (optional)
            </label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this payment"
              className="min-h-[80px]"
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? "Processing..." : "Confirm Mark as Paid"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
