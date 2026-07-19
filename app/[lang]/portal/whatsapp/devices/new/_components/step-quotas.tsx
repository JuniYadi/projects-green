"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WizardData } from "./device-create-wizard"

type Props = {
  data: WizardData
  updateData: (patch: Partial<WizardData>) => void
  errors: Record<string, string>
}

export function StepQuotas({ data, updateData, errors }: Props) {
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Quotas & Limits</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="quota-base">Quota Base</Label>
          <Input
            id="quota-base"
            type="number"
            min={0}
            value={data.quotaBase}
            onChange={(e) => updateData({ quotaBase: e.target.value })}
            placeholder="1000"
            aria-invalid={!!errors.quotaBase}
          />
          {errors.quotaBase && (
            <p className="text-xs text-destructive">{errors.quotaBase}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quota-out">Quota Base Out</Label>
          <Input
            id="quota-out"
            type="number"
            min={0}
            value={data.quotaBaseOut}
            onChange={(e) => updateData({ quotaBaseOut: e.target.value })}
            placeholder="0"
            aria-invalid={!!errors.quotaBaseOut}
          />
          {errors.quotaBaseOut && (
            <p className="text-xs text-destructive">{errors.quotaBaseOut}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="daily-limit">Daily Message Limit</Label>
          <Input
            id="daily-limit"
            type="number"
            min={0}
            value={data.dailyLimitMessage}
            onChange={(e) => updateData({ dailyLimitMessage: e.target.value })}
            placeholder="0"
            aria-invalid={!!errors.dailyLimitMessage}
          />
          {errors.dailyLimitMessage && (
            <p className="text-xs text-destructive">
              {errors.dailyLimitMessage}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="balance">Balance (Admin)</Label>
          <Input
            id="balance"
            type="number"
            min={0}
            value={data.balance}
            onChange={(e) => updateData({ balance: e.target.value })}
            placeholder="0"
            aria-invalid={!!errors.balance}
          />
          {errors.balance && (
            <p className="text-xs text-destructive">{errors.balance}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rates">Rates</Label>
          <Input
            id="rates"
            value={data.rates}
            onChange={(e) => updateData({ rates: e.target.value })}
            placeholder="Rate config"
            aria-invalid={!!errors.rates}
          />
          {errors.rates && (
            <p className="text-xs text-destructive">{errors.rates}</p>
          )}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="expired-at">Expires At</Label>
        <Input
          id="expired-at"
          type="date"
          value={data.expiredAt}
          onChange={(e) => updateData({ expiredAt: e.target.value })}
          aria-invalid={!!errors.expiredAt}
        />
        {errors.expiredAt && (
          <p className="text-xs text-destructive">{errors.expiredAt}</p>
        )}
      </div>
    </div>
  )
}
