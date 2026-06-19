"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type AdjustmentFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  onSuccess?: () => void
}

type AdjustmentType = "CREDIT" | "DEBIT"

export function AdjustmentForm({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
}: AdjustmentFormProps) {
  const [type, setType] = useState<AdjustmentType>("CREDIT")
  const [amount, setAmount] = useState<number>(0)
  const [reason, setReason] = useState<string>("")
  const [amountError, setAmountError] = useState<string | null>(null)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function reset() {
    setType("CREDIT")
    setAmount(0)
    setReason("")
    setAmountError(null)
    setReasonError(null)
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      reset()
    }
    onOpenChange(newOpen)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate
    let hasError = false

    if (!amount || amount < 1) {
      setAmountError("Minimum amount is 1")
      hasError = true
    } else if (amount > 999999999) {
      setAmountError("Maximum amount is 999,999,999")
      hasError = true
    } else {
      setAmountError(null)
    }

    if (!reason.trim()) {
      setReasonError("Reason is required")
      hasError = true
    } else {
      setReasonError(null)
    }

    if (hasError) return

    setIsSubmitting(true)
    setServerError(null)

    try {
      const { data } = await eden.api.billing.admin.adjust.post({
        tenantId,
        type,
        amount,
        reason: reason.trim(),
      } as never)

      if (!data?.ok) {
        throw new Error(
          (data as { message?: string })?.message ||
            "Failed to create adjustment"
        )
      }

      toast.success("Adjustment created successfully")
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create adjustment"
      setServerError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make Balance Adjustment</DialogTitle>
          <DialogDescription>
            Add or deduct credit from the tenant account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <Select
              value={type}
              onValueChange={(value) => setType(value as AdjustmentType)}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDIT">
                  <span className="text-green-600">CREDIT (+)</span>
                </SelectItem>
                <SelectItem value="DEBIT">
                  <span className="text-red-600">DEBIT (-)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field data-invalid={!!amountError}>
            <FieldLabel htmlFor="amount">Amount (IDR)</FieldLabel>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={1}
              max={999999999}
              step={1}
              value={amount || ""}
              onChange={(e) => {
                setAmount(Number.parseInt(e.target.value, 10) || 0)
                setAmountError(null)
              }}
              placeholder="Enter amount"
            />
            {amountError && <FieldError errors={[{ message: amountError }]} />}
          </Field>

          <Field data-invalid={!!reasonError}>
            <FieldLabel htmlFor="reason">Reason</FieldLabel>
            <Textarea
              id="reason"
              name="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError(null)
              }}
              placeholder="Enter reason for this adjustment"
              rows={3}
            />
            {reasonError && <FieldError errors={[{ message: reasonError }]} />}
          </Field>

          {serverError && (
            <p className="text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
