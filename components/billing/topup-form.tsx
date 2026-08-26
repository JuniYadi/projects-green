"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { topup } from "@/lib/billing-client"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppMessages } from "@/lib/i18n/messages/types"
import { CheckCircleIcon } from "@phosphor-icons/react"

type TopupMessages = AppMessages["console"]["billing"]["topUpForm"]

type TopupFormProps = {
  className?: string
  currency?: "IDR" | "USD"
  lang?: string
  messages?: TopupMessages
  onSuccess?: (result: {
    adjustmentId: string
    newBalanceIdr: string
    amountIdr: string
  }) => void
}

type FormState = "idle" | "submitting" | "success" | "error"

export function TopupForm({
  className,
  currency = "IDR",
  lang,
  messages,
  onSuccess,
}: TopupFormProps) {
  const t =
    messages ??
    getMessages(resolveLocaleOrDefault(lang)).console.billing.topUpForm
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{
    adjustmentId: string
    newBalanceIdr: string
    amountIdr: string
  } | null>(null)

  const [amount, setAmount] = useState<number>(50000)
  const [referenceId, setReferenceId] = useState<string>("")

  // Limits align with the Currency seed (IDR min=50000, max=200M).
  // For USD the currency prop switches min/max in the input and messages below.
  const minLimit = currency === "USD" ? 10 : 50000
  const maxLimit = currency === "USD" ? 10000 : 200000000
  const isValid = amount >= minLimit && amount <= maxLimit

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
      setErrorMessage(
        err instanceof Error ? err.message : t.manualTransferAvailable
      )
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
      <div
        className={`rounded-lg border border-green-500/20 bg-green-500/10 p-6 ${className}`}
      >
        <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
          <CheckCircleIcon className="h-8 w-8" />
          <div>
            <h3 className="font-semibold">{t.successHeading}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.confirmationNumber} {successData.adjustmentId}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.amountAdded}</span>
            <span className="font-medium">
              {formatCurrency(successData.amountIdr)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.newBalance}</span>
            <span className="font-medium">
              {formatCurrency(successData.newBalanceIdr)}
            </span>
          </div>
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={handleReset}>
          {t.topUpAgain}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-4">
        <Field>
          <FieldLabel>
            {t.amountLabel} {currency})
          </FieldLabel>
          <Input
            type="number"
            min={minLimit}
            max={maxLimit}
            step={currency === "USD" ? 1 : 1000}
            value={amount}
            onChange={(e) =>
              setAmount(Number.parseInt(e.target.value, 10) || 0)
            }
            placeholder={`${t.amountPlaceholder} (${t.minimumAmount} ${formatCurrency(String(minLimit))})`}
            disabled={formState === "submitting"}
          />
          {amount > 0 && amount < minLimit && (
            <p className="mt-1 text-sm text-destructive">
              {t.minimumAmount} {formatCurrency(String(minLimit))}
            </p>
          )}
          {amount > maxLimit && (
            <p className="mt-1 text-sm text-destructive">
              {t.maximumAmount} {formatCurrency(String(maxLimit))}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel>{t.paymentMethod}</FieldLabel>
          <Input type="text" value={t.manualTransferAvailable} disabled />
        </Field>

        <Field>
          <FieldLabel>{t.referenceId}</FieldLabel>
          <Input
            type="text"
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder={t.referencePlaceholder}
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
          {formState === "submitting" ? t.processing : t.submit}
        </Button>
      </div>
    </form>
  )
}
