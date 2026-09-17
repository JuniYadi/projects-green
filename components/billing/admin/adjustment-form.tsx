"use client"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
  organizationId?: string
  tenantId?: string
  onSuccess?: () => void
}

type AdjustmentType = "CREDIT" | "DEBIT"

export function AdjustmentForm({
  open,
  onOpenChange,
  organizationId,
  tenantId,
  onSuccess,
}: AdjustmentFormProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pBillingAdminAdjustmentForm

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
      setAmountError(t.amountMinError)
      hasError = true
    } else if (amount > 999999999) {
      setAmountError(t.amountMaxError)
      hasError = true
    } else {
      setAmountError(null)
    }

    if (!reason.trim()) {
      setReasonError(t.reasonRequiredError)
      hasError = true
    } else {
      setReasonError(null)
    }

    if (hasError) return

    setIsSubmitting(true)
    setServerError(null)

    try {
      const targetOrgId = organizationId || tenantId || ""
      const { data } = await eden.api.billing.admin.adjust.post({
        organizationId: targetOrgId,
        type,
        amount,
        reason: reason.trim(),
      } as never)

      if (!data?.ok) {
        throw new Error(
          (data as { message?: string })?.message || t.failedToCreate
        )
      }

      toast.success(t.successToast)
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : t.failedToCreate
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
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="type">{t.typeLabel}</FieldLabel>
            <Select
              value={type}
              onValueChange={(value) => setType(value as AdjustmentType)}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder={t.typePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDIT">
                  <span className="text-green-600">{t.creditOption}</span>
                </SelectItem>
                <SelectItem value="DEBIT">
                  <span className="text-red-600">{t.debitOption}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field data-invalid={!!amountError}>
            <FieldLabel htmlFor="amount">{t.amountLabel}</FieldLabel>
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
              placeholder={t.amountPlaceholder}
            />
            {amountError && <FieldError errors={[{ message: amountError }]} />}
          </Field>

          <Field data-invalid={!!reasonError}>
            <FieldLabel htmlFor="reason">{t.reasonLabel}</FieldLabel>
            <Textarea
              id="reason"
              name="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError(null)
              }}
              placeholder={t.reasonPlaceholder}
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
              {t.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t.creating : t.createAdjustment}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
