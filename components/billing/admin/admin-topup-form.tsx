"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { adminTopup } from "@/lib/billing-client"
import { toast } from "sonner"

type AdminTopupFormProps = {
  orgId: string
  onSuccess?: () => void
}

export function AdminTopupForm({ orgId, onSuccess }: AdminTopupFormProps) {
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("Admin topup")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)

  const presets = [100000, 500000, 1000000, 5000000]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numAmount = parseInt(amount, 10)
    if (!numAmount || numAmount < 1) {
      setAmountError("Amount must be at least Rp 1")
      return
    }

    setIsLoading(true)
    setError(null)
    setAmountError(null)

    try {
      const result = await adminTopup({ orgId, amount: numAmount, reason })
      toast.success(
        `Rp ${numAmount.toLocaleString("id-ID")} credited. New balance: Rp ${result.newBalanceIdr}`
      )
      setAmount("")
      setReason("Admin topup")
      onSuccess?.()
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Topup failed"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Top Up</CardTitle>
        <CardDescription>
          Credit balance directly to this organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field data-invalid={!!amountError}>
            <FieldLabel htmlFor="amount">Amount (IDR)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(String(preset))}
                >
                  Rp {preset.toLocaleString("id-ID")}
                </Button>
              ))}
            </div>
            <Input
              id="amount"
              name="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setAmountError(null)
              }}
              min={1}
              required
            />
            {amountError && <FieldError errors={[{ message: amountError }]} />}
          </Field>

          <Field>
            <FieldLabel htmlFor="reason">Reason</FieldLabel>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Reason for topup"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </Field>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isLoading || !amount}>
            {isLoading ? "Processing..." : "Credit Balance"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
