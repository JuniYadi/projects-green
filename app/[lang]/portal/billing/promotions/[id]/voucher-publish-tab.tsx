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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type FieldErrors = Record<string, string[]>

export function VoucherPublishTab({
  voucher,
  onUpdate,
  onSaveDraft,
  onPublish,
  isSaving,
  fieldErrors = {},
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
  onSaveDraft: () => void
  onPublish: () => void
  isSaving: boolean
  fieldErrors?: FieldErrors
}) {
  const validation = validateForPublish(voucher)
  const externalErrors = Object.values(fieldErrors).flat()
  const errors = [...validation.errors, ...externalErrors]
  const hasErrors = errors.length > 0
  const hasWarnings = validation.warnings.length > 0
  const isNew = voucher.id === "new"

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? "Initial Status" : "Publish Status"}</CardTitle>
          <CardDescription>
            {isNew
              ? "Choose whether to keep this promotion disabled as a draft or make it active after creation."
              : "The current status is shown below. Use Save Draft or Publish to change it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isNew ? (
            <ToggleGroup
              type="single"
              value={voucher.status === "ACTIVE" ? "ACTIVE" : "DISABLED"}
              onValueChange={(value) => {
                if (value === "ACTIVE" || value === "DISABLED") {
                  onUpdate({ status: value })
                }
              }}
              aria-label="Initial promotion status"
              className="grid w-full gap-3 sm:grid-cols-2"
            >
              <ToggleGroupItem
                value="DISABLED"
                className="h-auto min-h-20 justify-start rounded-lg border border-border px-4 py-3 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-muted"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">Save as draft</span>
                  <span className="text-xs text-muted-foreground">
                    Persist as DISABLED until an administrator publishes it.
                  </span>
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="ACTIVE"
                className="h-auto min-h-20 justify-start rounded-lg border border-border px-4 py-3 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-muted"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">Publish now</span>
                  <span className="text-xs text-muted-foreground">
                    Persist as ACTIVE after every validation passes.
                  </span>
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm">
                <span className="font-medium">Current status:</span>{" "}
                <Badge
                  variant={
                    voucher.status === "ACTIVE" ? "default" : "secondary"
                  }
                >
                  {statusLabel}
                </Badge>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation</CardTitle>
          <CardDescription>
            Review any issues before saving or publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <WarningCircleIcon className="mt-0.5 h-4 w-4 text-destructive" />
                <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-destructive">
                  {errors.map((error, index) => (
                    <li key={`err-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-900/10">
              <div className="flex items-start gap-2">
                <WarningCircleIcon className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-amber-800 dark:text-amber-200">
                  {validation.warnings.map((warning, index) => (
                    <li key={`warn-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {errors.length === 0 && validation.warnings.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircleIcon className="h-4 w-4" />
              All validation checks passed.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 rounded-lg border border-border bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onSaveDraft} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={onPublish}
            disabled={isSaving || hasErrors}
            variant={hasErrors ? "destructive" : "default"}
          >
            {isSaving
              ? "Publishing..."
              : hasErrors
                ? "Fix errors to publish"
                : "Publish Promotion"}
          </Button>
        </div>

        {hasErrors && (
          <p className="mt-2 text-xs text-destructive">
            Resolve the highlighted fields before publishing this promotion.
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

export function validateForPublish(voucher: VoucherDetailDTO): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const isNew = voucher.id === "new"

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
      errors.push("Percentage discount cannot exceed 100%.")
    }
    if (
      isNew &&
      ((!listValue(voucher.allowedPackageCodes).length &&
        !listValue(voucher.allowedPlanCodes).length) ||
        !listValue(voucher.allowedBillingPeriods).length)
    ) {
      errors.push(
        "Select at least one eligible product or plan and one billing period."
      )
    }
    if (voucher.discountType === "FIXED" && !voucher.discountCurrency) {
      errors.push("Discount currency is required for fixed discounts.")
    }
  } else if (!voucher.amount || Number(voucher.amount) <= 0) {
    errors.push("Credit amount must be greater than 0.")
  }

  if (voucher.maxClaims < 1) {
    errors.push("Max claims must be at least 1.")
  }

  const expiresAt = new Date(voucher.expiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    errors.push("Expiration date must be in the future.")
  }

  return { errors, warnings }
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }
  return []
}
