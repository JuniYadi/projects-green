"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QrCodeIcon, BuildingsIcon, HandCoinsIcon } from "@phosphor-icons/react"

type PaymentMethod = "VA" | "QRIS" | "MANUAL_BANK"

type FormState = "idle" | "submitting" | "success" | "error"

interface BankAccount {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isActive: boolean
  isDefault: boolean
}

interface TopupFormEnhancedProps {
  className?: string
  onSuccess?: (result: { invoiceId: string; amount: number; paymentMethod: PaymentMethod }) => void
}

export function TopupFormEnhanced({ className, onSuccess }: TopupFormEnhancedProps) {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

  const [amount, setAmount] = useState<number>(50000)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("MANUAL_BANK")
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("")
  const [availableMethods, setAvailableMethods] = useState<
    Record<PaymentMethod, boolean>
  >({ MANUAL_BANK: true, VA: false, QRIS: false })

  useEffect(() => {
    let cancelled = false

    async function fetchMethods() {
      try {
        const response = await fetch("/api/payments/topup/methods")
        const data = await response.json()
        if (data.ok && data.methods && !cancelled) {
          setAvailableMethods({
            MANUAL_BANK: Boolean(data.methods.MANUAL_BANK),
            VA: Boolean(data.methods.VA),
            QRIS: Boolean(data.methods.QRIS),
          })
        }
      } catch {
        // Keep conservative defaults (manual only) on failure.
      }
    }

    void fetchMethods()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchBankAccounts() {
      try {
        const response = await fetch("/api/payments/topup/bank-accounts")
        const data = await response.json()
        if (data.ok && !cancelled) {
          setBankAccounts(data.data || [])
          const defaultAccount = data.data?.find((b: BankAccount) => b.isDefault)
          if (defaultAccount) {
            setSelectedBankAccount(defaultAccount.id)
          } else if (data.data?.length > 0) {
            setSelectedBankAccount(data.data[0].id)
          }
        }
      } catch {
        // Silently fail, will show manual account info
      } finally {
        if (!cancelled) {
          setIsLoadingAccounts(false)
        }
      }
    }

    void fetchBankAccounts()

    return () => {
      cancelled = true
    }
  }, [])

  const isValid = amount >= 10000 && amount <= 100000000

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value)
  }

  function formatAmount(value: number): string {
    return new Intl.NumberFormat("id-ID").format(value)
  }

  function parseFormattedAmount(value: string): number {
    return Number.parseInt(value.replace(/[^\d]/g, ""), 10) || 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!isValid) return

    setFormState("submitting")
    setErrorMessage(null)

    try {
      const response = await fetch("/api/payments/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paymentMethod }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Topup failed. Please try again.")
      }

      onSuccess?.({
        invoiceId: result.invoice.id,
        amount,
        paymentMethod,
      })

      if (paymentMethod === "MANUAL_BANK") {
        setFormState("success")
        // Manual transfer lands on the invoice detail page so the customer can
        // review the destination account and exact amount before confirming.
        router.push(`/console/billing/invoices/${result.invoice.id}`)
      } else if (paymentMethod === "VA" || paymentMethod === "QRIS") {
        if (result.paymentUrl) {
          setFormState("submitting")
          setTimeout(() => {
            window.location.href = result.paymentUrl
          }, 150)
        } else {
          setFormState("success")
          router.push(`/console/billing/invoices/${result.invoice.id}?payment=pending`)
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Topup failed. Please try again.")
      setFormState("error")
    }
  }

  const selectedBank = bankAccounts.find((b) => b.id === selectedBankAccount)

  const ALL_PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType; description: string }[] = [
    {
      value: "MANUAL_BANK",
      label: "Manual Bank Transfer",
      icon: BuildingsIcon,
      description: "Transfer to our bank account manually",
    },
    {
      value: "VA",
      label: "Virtual Account",
      icon: HandCoinsIcon,
      description: "Pay via bank virtual account",
    },
    {
      value: "QRIS",
      label: "QRIS",
      icon: QrCodeIcon,
      description: "Pay with any QRIS-enabled app",
    },
  ]

  // Only show payment methods that are actually enabled/configured.
  const PAYMENT_METHODS = ALL_PAYMENT_METHODS.filter(
    (method) => availableMethods[method.value]
  )

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-6">
        {/* Amount Input */}
        <Field>
          <FieldLabel>Amount (IDR)</FieldLabel>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[50000, 100000, 250000, 500000, 1000000].map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={amount === preset ? "default" : "outline"}
                size="sm"
                disabled={formState === "submitting"}
                onClick={() => setAmount(preset)}
              >
                {formatCurrency(preset)}
              </Button>
            ))}
            <Button
              type="button"
              variant={
                ![50000, 100000, 250000, 500000, 1000000].includes(amount)
                  ? "default"
                  : "outline"
              }
              size="sm"
              disabled={formState === "submitting"}
              onClick={() => setAmount(0)}
            >
              Custom
            </Button>
          </div>
          <div className="relative mt-2">
            <Input
              type="text"
              inputMode="numeric"
              value={formatAmount(amount)}
              onChange={(e) => setAmount(parseFormattedAmount(e.target.value))}
              placeholder="Enter amount"
              disabled={formState === "submitting"}
              className="pr-16"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              IDR
            </span>
          </div>
          {amount > 0 && amount < 10000 && (
            <p className="mt-1 text-sm text-destructive">Minimum topup is IDR 10,000</p>
          )}
          {amount > 100000000 && (
            <p className="mt-1 text-sm text-destructive">Maximum topup is IDR 100,000,000</p>
          )}
        </Field>

        {/* Payment Method Selection */}
        <Field>
          <FieldLabel>Payment Method</FieldLabel>
          <div className="grid gap-3">
            {PAYMENT_METHODS.map((method) => (
              <label
                key={method.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  paymentMethod === method.value
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.value}
                  checked={paymentMethod === method.value}
                  onChange={() => setPaymentMethod(method.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <method.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{method.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{method.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Field>

        {/* Bank Account Selection (for Manual Bank Transfer) */}
        {paymentMethod === "MANUAL_BANK" && (
          <Field>
            <FieldLabel>Destination Account</FieldLabel>
            {isLoadingAccounts ? (
              <Input type="text" value="Loading..." disabled />
            ) : bankAccounts.length > 0 ? (
              <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bankName} - {account.accountNumber} ({account.accountName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No bank accounts available. Please contact support.
              </div>
            )}
            {selectedBank && (
              <div className="mt-2 rounded-md border bg-muted/50 p-3 text-sm">
                <p className="font-medium">Transfer to:</p>
                <p className="mt-1">
                  <span className="text-muted-foreground">Bank:</span> {selectedBank.bankName}
                </p>
                <p>
                  <span className="text-muted-foreground">Account:</span> {selectedBank.accountNumber}
                </p>
                <p>
                  <span className="text-muted-foreground">Name:</span> {selectedBank.accountName}
                </p>
              </div>
            )}
          </Field>
        )}

        {/* Summary */}
        {isValid && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Top Up Amount</span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </div>
          </div>
        )}

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
          {formState === "submitting" ? "Processing..." : "Create Invoice"}
        </Button>
      </div>
    </form>
  )
}
