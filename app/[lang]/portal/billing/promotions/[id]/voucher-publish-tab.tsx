"use client"

import {
  CheckCircleIcon,
  WarningCircleIcon,
} from "@/components/ui/phosphor-icons"
import type { VoucherDetailDTO } from "@/lib/billing-client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export function VoucherPublishTab({
  voucher,
  onUpdate,
  onSaveDraft,
  onPublish,
  isSaving,
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
  onSaveDraft: () => void
  onPublish: () => void
  isSaving: boolean
}) {
  const validation = validateForPublish(voucher)
  const hasErrors = validation.errors.length > 0
  const hasWarnings = validation.warnings.length > 0
  const isBlocked = hasErrors

  const statusLabel =
    voucher.status === "ACTIVE"
      ? "Published (Active)"
      : voucher.status === "DISABLED"
        ? "Draft (Disabled)"
        : voucher.status === "EXPIRED"
          ? "Expired"
          : voucher.status === "DEPLETED"
            ? "Depleted"
            : voucher.status

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publish Status</CardTitle>
          <CardDescription>
            Control whether this voucher is available for redemption.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="voucher-status-active" className="font-medium">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, the voucher can be redeemed by customers.
              </p>
            </div>
            <Checkbox
              id="voucher-status-active"
              checked={voucher.status === "ACTIVE"}
              onCheckedChange={(checked) =>
                onUpdate({
                  status: checked ? "ACTIVE" : "DISABLED",
                })
              }
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm">
              <span className="font-medium">Current status:</span>{" "}
              <Badge
                variant={voucher.status === "ACTIVE" ? "default" : "secondary"}
              >
                {statusLabel}
              </Badge>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Validation summary */}
      <Card>
        <CardHeader>
          <CardTitle>Validation</CardTitle>
          <CardDescription>
            Review any issues before publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {validation.errors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <WarningCircleIcon className="mt-0.5 h-4 w-4 text-destructive" />
                <ul className="list-disc text-sm text-destructive">
                  {validation.errors.map((e, i) => (
                    <li key={`err-${i}`}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-900/10">
              <div className="flex items-start gap-2">
                <WarningCircleIcon className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                <ul className="list-disc text-sm text-amber-800 dark:text-amber-200">
                  {validation.warnings.map((w, i) => (
                    <li key={`warn-${i}`}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {validation.errors.length === 0 &&
            validation.warnings.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircleIcon className="h-4 w-4" />
                All validation checks passed.
              </div>
            )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="sticky bottom-0 rounded-lg border border-border bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              // Save as draft keeps status DISABLED
              onUpdate({ status: "DISABLED" })
              onSaveDraft()
            }}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={onPublish}
            disabled={isSaving || isBlocked}
            variant={hasErrors ? "destructive" : "default"}
          >
            {isSaving
              ? "Publishing..."
              : isBlocked
                ? "Fix errors to publish"
                : "Publish Voucher"}
          </Button>
        </div>

        {hasErrors && (
          <p className="mt-2 text-xs text-destructive">
            This voucher cannot be published until all errors are resolved.
          </p>
        )}
        {hasWarnings && !hasErrors && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Publishing with warnings is allowed.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateForPublish(voucher: VoucherDetailDTO): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (voucher.kind === "PRODUCT_PROMOTION") {
    if (!voucher.discountType) {
      errors.push("Discount type is required for product promotions.")
    }
    if (!voucher.discountValue || Number(voucher.discountValue) <= 0) {
      errors.push("Discount value must be greater than 0.")
    }
    if (
      voucher.discountType === "PERCENTAGE" &&
      voucher.discountValue &&
      Number(voucher.discountValue) > 100
    ) {
      warnings.push("Percentage discount exceeds 100%.")
    }
  }

  if (voucher.amount && Number(voucher.amount) <= 0) {
    errors.push("Amount must be greater than 0.")
  }

  if (voucher.maxClaims < 1) {
    errors.push("Max claims must be at least 1.")
  }

  if (new Date(voucher.expiresAt) <= new Date()) {
    errors.push("Expiration date must be in the future.")
  }

  return { errors, warnings }
}
