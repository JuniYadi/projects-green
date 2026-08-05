"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminPricing } from "@/lib/billing-client"

export type PricingVariantFormValue = {
  planId: string
  regionId: string
  billingPeriod: Exclude<AdminPricing["billingPeriod"], null>
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  periodPrice: string
  currency: string
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
}

export function PricingVariantForm({
  initial,
  onSubmit,
  submitting = false,
}: {
  initial?: Partial<PricingVariantFormValue>
  onSubmit: (value: PricingVariantFormValue) => void | Promise<void>
  submitting?: boolean
}) {
  const [value, setValue] = useState<PricingVariantFormValue>({
    planId: initial?.planId ?? "",
    regionId: initial?.regionId ?? "",
    billingPeriod: initial?.billingPeriod ?? "MONTHLY",
    chargeUnit: initial?.chargeUnit ?? "SUBSCRIPTION",
    periodPrice: initial?.periodPrice ?? "",
    currency: initial?.currency ?? "IDR",
    effectiveFrom:
      initial?.effectiveFrom?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    effectiveTo: initial?.effectiveTo?.slice(0, 10),
    isActive: initial?.isActive ?? true,
  })
  const update = <K extends keyof PricingVariantFormValue>(
    key: K,
    next: PricingVariantFormValue[K]
  ) => setValue((current) => ({ ...current, [key]: next }))
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit(value)
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="pricing-plan-id">Plan ID</Label>
          <Input
            id="pricing-plan-id"
            value={value.planId}
            onChange={(event) => update("planId", event.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pricing-region-id">Region ID</Label>
          <Input
            id="pricing-region-id"
            value={value.regionId}
            onChange={(event) => update("regionId", event.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pricing-period-price">Price for entire period</Label>
        <Input
          id="pricing-period-price"
          type="number"
          min="0"
          step="0.01"
          value={value.periodPrice}
          onChange={(event) => update("periodPrice", event.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Billing period</Label>
          <Select
            value={value.billingPeriod}
            onValueChange={(next) =>
              update(
                "billingPeriod",
                next as PricingVariantFormValue["billingPeriod"]
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="QUARTERLY">Quarterly</SelectItem>
              <SelectItem value="SEMI_ANNUAL">Semi-Annual</SelectItem>
              <SelectItem value="ANNUAL">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Charge unit</Label>
          <Select
            value={value.chargeUnit}
            onValueChange={(next) =>
              update(
                "chargeUnit",
                next as PricingVariantFormValue["chargeUnit"]
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUBSCRIPTION">Per subscription</SelectItem>
              <SelectItem value="DEVICE">Per device</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Currency</Label>
          <Select
            value={value.currency}
            onValueChange={(next) => update("currency", next)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IDR">IDR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pricing-effective-from">Effective from</Label>
          <Input
            id="pricing-effective-from"
            type="date"
            value={value.effectiveFrom}
            onChange={(event) => update("effectiveFrom", event.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pricing-effective-to">Effective to</Label>
          <Input
            id="pricing-effective-to"
            type="date"
            value={value.effectiveTo ?? ""}
            onChange={(event) =>
              update("effectiveTo", event.target.value || undefined)
            }
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(event) => update("isActive", event.target.checked)}
        />{" "}
        Active
      </label>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save pricing variant"}
      </Button>
    </form>
  )
}
