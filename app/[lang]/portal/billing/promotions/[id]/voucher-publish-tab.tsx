"use client"

import { useParams } from "next/navigation"

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
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type FieldErrors = Record<string, string[]>

export function VoucherPublishTab({
  voucher,
  onUpdate,
  onSaveDraft,
  onPublish,
  onDisable,
  onExpire,
  isSaving,
  fieldErrors = {},
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
  onSaveDraft: () => void
  onPublish: () => void
  onDisable?: () => void
  onExpire?: () => void
  isSaving: boolean
  fieldErrors?: FieldErrors
}) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingPromotionsVoucherPublishTab

  const validation = validateForPublish(voucher)
  const externalErrors = Object.values(fieldErrors).flat()
  const errors = [...validation.errors, ...externalErrors]
  const hasErrors = errors.length > 0
  const hasWarnings = validation.warnings.length > 0
  const isNew = voucher.id === "new"
  const isExpired =
    voucher.status === "EXPIRED" || new Date(voucher.expiresAt) <= new Date()

  const statusLabel =
    voucher.status === "ACTIVE"
      ? t.statusPublishedActive
      : voucher.status === "DISABLED"
        ? t.statusDraftDisabled
        : voucher.status === "EXPIRED"
          ? t.statusExpired
          : voucher.status === "DEPLETED"
            ? t.statusDepleted
            : voucher.status

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {isNew ? t.initialStatusTitle : t.publishStatusTitle}
          </CardTitle>
          <CardDescription>
            {isNew ? t.initialStatusDescription : t.publishStatusDescription}
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
              aria-label={t.initialPromotionStatusAriaLabel}
              className="grid w-full gap-3 sm:grid-cols-2"
            >
              <ToggleGroupItem
                value="DISABLED"
                className="h-auto min-h-20 justify-start rounded-lg border border-border px-4 py-3 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-muted"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{t.saveAsDraftOption}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.saveAsDraftOptionHint}
                  </span>
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="ACTIVE"
                className="h-auto min-h-20 justify-start rounded-lg border border-border px-4 py-3 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-muted"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{t.publishNowOption}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.publishNowOptionHint}
                  </span>
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  <span className="font-medium">{t.currentStatusLabel}</span>{" "}
                  <Badge
                    variant={
                      voucher.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {statusLabel}
                  </Badge>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {voucher.status === "ACTIVE" && onDisable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDisable}
                      disabled={isSaving}
                      className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/20"
                    >
                      {t.deactivateButton}
                    </Button>
                  )}
                  {voucher.status !== "EXPIRED" && isExpired && onExpire && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onExpire}
                      disabled={isSaving}
                    >
                      {t.markAsExpiredButton}
                    </Button>
                  )}
                </div>
              </div>
              {isExpired && voucher.status !== "EXPIRED" && (
                <p className="text-xs text-destructive">
                  {t.expiredNotice
                    .replace(
                      "{date}",
                      new Date(voucher.expiresAt).toLocaleString()
                    )
                    .replace("{status}", voucher.status)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.validationTitle}</CardTitle>
          <CardDescription>{t.validationDescription}</CardDescription>
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
              {t.allChecksPassed}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 rounded-lg border border-border bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onSaveDraft} disabled={isSaving}>
            {isSaving ? t.savingLabel : t.saveDraftButton}
          </Button>
          <Button
            onClick={onPublish}
            disabled={isSaving || hasErrors}
            variant={hasErrors ? "destructive" : "default"}
          >
            {isSaving
              ? t.publishingLabel
              : hasErrors
                ? t.fixErrorsButton
                : t.publishPromotionButton}
          </Button>
        </div>

        {hasErrors && (
          <p className="mt-2 text-xs text-destructive">
            {t.resolveErrorsNotice}
          </p>
        )}
        {hasWarnings && !hasErrors && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {t.warningsAllowedNotice}
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
