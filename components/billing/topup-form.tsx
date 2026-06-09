"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { topup } from "@/lib/billing-client"
import { CheckCircleIcon } from "@phosphor-icons/react"

type TopupFormProps = {
  className?: string
  currency?: "IDR" | "USD"
  onSuccess?: (result: { adjustmentId: string; newBalanceIdr: string; amountIdr: string }) => void
}

type FormState = "idle" | "submitting" | "success" | "error"

export function TopupForm({ className, currency = "IDR", onSuccess }: TopupFormProps) {
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ adjustmentId: string; newBalanceIdr: string; amountIdr: string } | null>(null)

  const [amount, setAmount] = useState<number>(50000)
  const [referenceId, setReferenceId] = useState<string>("")

  const isValid = amount >= 10000 && amount <= 1000000

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!isValid) return

    setFormState("submitting")
    setErrorMessage(null)

    try {
      const result = await topup({
        amount,
        paymentMethod: "manual_bank_transfer",
        referenceId: referenceId || undefined,
      })

      setSuccessData({
        adjustmentId: result.adjustmentId,
        newBalanceIdr: result.newBalanceIdr,
        amountIdr: result.amountIdr,
      })
      setFormState("success")
      onSuccess?.(result)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Topup failed. Please try again.")
      setFormState("error")
    }
  }

  function formatCurrency(amountValue: string): string {
    const amt = Number.parseFloat(amountValue)
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amt)
  }

  function handleReset() {
    setFormState("idle")
    setSuccessData(null)
    setAmount(50000)
    setReferenceId("")
  }

  if (formState === "success" && successData) {
    return (
      <div className={`rounded-lg border border-green-500/20 bg-green-500/10 p-6 ${className}`}>
        <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
          <CheckCircleIcon className="h-8 w-8" />
          <div>
            <h3 className="font-semibold">Topup Successful!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirmation #: {successData.adjustmentId}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount Added</span>
            <span className="font-medium">{formatCurrency(successData.amountIdr)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">New Balance</span>
            <span className="font-medium">{formatCurrency(successData.newBalanceIdr)}</span>
          </div>
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={handleReset}>
          Topup Again
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-4">
        <Field>
          <FieldLabel>Amount ({currency})</FieldLabel>
          <Input
            type="number"
            min={10000}
            max={1000000}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Number.parseInt(e.target.value, 10) || 0)}
            placeholder="Enter amount (min 10,000)"
            disabled={formState === "submitting"}
          />
          {amount > 0 && amount < 10000 && (
            <p className="mt-1 text-sm text-destructive">Minimum topup is {formatCurrency("10000")}</p>
          )}
          {amount > 1000000 && (
            <p className="mt-1 text-sm text-destructive">Maximum topup is {formatCurrency("1000000")}</p>
          )}
        </Field>

        <Field>
          <FieldLabel>Payment Method</FieldLabel>
          <Input type="text" value="Manual Bank Transfer" disabled />
          <p className="mt-1 text-xs text-muted-foreground">
            Only manual bank transfer is available for now
          </p>
        </Field>

        <Field>
          <FieldLabel>Reference ID (Optional)</FieldLabel>
          <Input
            type="text"
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder="e.g., TRF-12345"
            maxLength={100}
            disabled={formState === "submitting"}
          />
        </Field>

        {formState === "error" && errorMessage && (
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={!isValid || formState === "submitting"}
        >
          {formState === "submitting" ? "Processing..." : "Top Up"}
        </Button>
      </div>
    </form>
  )
}
