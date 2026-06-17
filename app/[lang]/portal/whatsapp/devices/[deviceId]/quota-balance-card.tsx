import { eden } from "@/lib/eden"

/**
 * Quota & Balance Card — Inline editable client component
 *
 * Loading skeleton: rendered initially while React hydrates (or on re-fetch).
 * Error: inline error message with retry button.
 * Success: editable fields with save/cancel.
 */

"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Pen, Check, X, WarningCircle } from "@phosphor-icons/react"

type QuotaBalanceCardProps = {
  deviceId: string
  initialBalance: number
  initialQuotaBase: number
  initialQuotaBaseOut: number
  initialDailyLimitMessage: number
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string | number | React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

export function QuotaBalanceCard({
  deviceId,
  initialBalance,
  initialQuotaBase,
  initialQuotaBaseOut,
  initialDailyLimitMessage,
}: QuotaBalanceCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quotaBase, setQuotaBase] = useState(initialQuotaBase)
  const [dailyLimit, setDailyLimit] = useState(initialDailyLimitMessage)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)

    try {
      const { data: res } = await eden.api.whatsapp.devices[deviceId].patch({
        quotaBase,
        dailyLimitMessage: dailyLimit,
      })

      const body = await res.json()

      if (!body.ok) {
        throw new Error(body.message || "Failed to update device limits.")
      }

      toast.success("Device limits updated successfully.")
      setEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update device limits."
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [deviceId, quotaBase, dailyLimit])

  const handleCancel = useCallback(() => {
    setQuotaBase(initialQuotaBase)
    setDailyLimit(initialDailyLimitMessage)
    setEditing(false)
    setError(null)
  }, [initialQuotaBase, initialDailyLimitMessage])

  if (saving) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quota & Balance</CardTitle>
          <CardDescription>Saving changes...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Quota & Balance</CardTitle>
            <CardDescription>Usage limits and current balance</CardDescription>
          </div>
          {!editing && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setEditing(true)}
              aria-label="Edit quota and balance"
            >
              <Pen className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <WarningCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-6 shrink-0"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <X className="size-3" />
            </Button>
          </div>
        )}

        <dl className="space-y-3">
          <InfoRow
            label="Current Balance"
            value={
              <span className="text-lg font-bold">
                {formatCurrency(initialBalance)}
              </span>
            }
          />

          {editing ? (
            <>
              <div className="space-y-2 border-b pb-3">
                <Label htmlFor="quotaBase" className="text-sm text-muted-foreground">
                  Quota Base (messages)
                </Label>
                <Input
                  id="quotaBase"
                  type="number"
                  min={0}
                  value={quotaBase}
                  onChange={(e) => setQuotaBase(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 border-b pb-3">
                <Label
                  htmlFor="dailyLimit"
                  className="text-sm text-muted-foreground"
                >
                  Daily Limit (messages)
                </Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  min={0}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="mr-1 size-3" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Check className="mr-1 size-3" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <InfoRow
                label="Monthly Allowance"
                value={`${initialQuotaBaseOut.toLocaleString()} / ${initialQuotaBase.toLocaleString()}`}
              />
              {initialQuotaBaseOut === 0 && initialQuotaBase > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <span className="font-medium">Monthly allowance exhausted — overage charges apply</span>
                </div>
              )}
              <InfoRow
                label="Daily Limit"
                value={initialDailyLimitMessage.toLocaleString()}
              />
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}

/**
 * Loading skeleton for QuotaBalanceCard
 */
export function QuotaBalanceCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quota & Balance</CardTitle>
        <CardDescription>Usage limits and current balance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}
