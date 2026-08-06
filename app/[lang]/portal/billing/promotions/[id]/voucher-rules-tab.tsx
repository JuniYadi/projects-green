"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { XIcon } from "@phosphor-icons/react"
import type { VoucherDetailDTO } from "@/lib/billing-client"

const jsonArrayToList = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === "string")
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed))
        return parsed.filter((v): v is string => typeof v === "string")
    } catch {
      // not JSON — fall through
    }
  }
  return []
}

export function VoucherRulesTab({
  voucher,
  onUpdate,
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
}) {
  const [packageInput, setPackageInput] = useState<string[]>(() =>
    jsonArrayToList(voucher.allowedPackageCodes)
  )
  const [planInput, setPlanInput] = useState<string[]>(() =>
    jsonArrayToList(voucher.allowedPlanCodes)
  )
  const [periodInput, setPeriodInput] = useState<string[]>(() =>
    jsonArrayToList(voucher.allowedBillingPeriods)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rules &amp; Restrictions</CardTitle>
        <CardDescription>
          Define which packages, plans, and billing periods this voucher applies
          to. Empty lists mean the voucher is eligible across all packages and
          plans.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="voucher-min-amount">Minimum Order Amount</Label>
          <Input
            id="voucher-min-amount"
            type="number"
            min="0"
            step="0.01"
            value={voucher.minimumOrderAmount ?? ""}
            onChange={(e) =>
              onUpdate({
                minimumOrderAmount: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
            placeholder="e.g. 100000"
          />
          <p className="text-xs text-muted-foreground">
            The minimum order subtotal (in the voucher currency) required to
            redeem this voucher.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voucher-max-discount">Maximum Discount Amount</Label>
          <Input
            id="voucher-max-discount"
            type="number"
            min="0"
            step="0.01"
            value={voucher.maximumDiscountAmount ?? ""}
            onChange={(e) =>
              onUpdate({
                maximumDiscountAmount: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
            placeholder="e.g. 25000"
          />
          <p className="text-xs text-muted-foreground">
            The maximum discount amount that can be applied per redemption.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Allowed Package Codes</Label>
          <CodeListInput
            value={packageInput}
            onChange={(next) => {
              setPackageInput(next)
              onUpdate({ allowedPackageCodes: next })
            }}
            placeholder="e.g. VPN"
            onClearAll={() => {
              setPackageInput([])
              onUpdate({ allowedPackageCodes: [] })
            }}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to allow all packages.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Allowed Plan Codes</Label>
          <CodeListInput
            value={planInput}
            onChange={(next) => {
              setPlanInput(next)
              onUpdate({ allowedPlanCodes: next })
            }}
            placeholder="e.g. PRO"
            onClearAll={() => {
              setPlanInput([])
              onUpdate({ allowedPlanCodes: [] })
            }}
          />
          <p className="text-xs text-muted-foreground">
            Restrict the voucher to specific plan codes.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Allowed Billing Periods</Label>
          <CodeListInput
            value={periodInput}
            onChange={(next) => {
              setPeriodInput(next)
              onUpdate({ allowedBillingPeriods: next })
            }}
            placeholder="e.g. MONTHLY"
            onClearAll={() => {
              setPeriodInput([])
              onUpdate({ allowedBillingPeriods: [] })
            }}
          />
          <p className="text-xs text-muted-foreground">
            Restrict the voucher to specific billing periods.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Inline code-list input ───────────────────────────────────────────────────

function CodeListInput({
  value,
  onChange,
  placeholder,
  onClearAll,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  onClearAll: () => void
}) {
  const [draft, setDraft] = useState("")

  const addCode = () => {
    const trimmed = draft.trim().toUpperCase()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setDraft("")
  }

  const removeCode = (code: string) => {
    onChange(value.filter((c) => c !== code))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addCode()
            }
          }}
          placeholder={placeholder}
          className="font-mono uppercase"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCode}>
          Add
        </Button>
        {value.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
            Clear all
          </Button>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
            >
              {code}
              <button
                type="button"
                onClick={() => removeCode(code)}
                className="rounded p-0.5 hover:bg-muted-foreground/20"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
