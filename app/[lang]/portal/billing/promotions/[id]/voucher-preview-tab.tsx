"use client"

import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WarningCircle } from "@/components/ui/phosphor-icons"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  voucherKindLabel,
  voucherDiscountTypeLabel,
  voucherCurrencyPolicyLabel,
  type VoucherDetailDTO,
} from "@/lib/billing-client"

type RejectionReason = {
  code: string
  label: string
  severity: "warning" | "error"
}

export function VoucherPreviewTab({ voucher }: { voucher: VoucherDetailDTO }) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const rejections = computeRejectionPreviews(voucher)

  const applies = rejections.filter((r) => r.severity === "error")
  const warnings = rejections.filter((r) => r.severity === "warning")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {messages.pBillingPromotionsIdVoucherPreviewTab.voucherSummaryTitle}
          </CardTitle>
          <CardDescription>
            {
              messages.pBillingPromotionsIdVoucherPreviewTab
                .voucherSummaryDescription
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pBillingPromotionsIdVoucherPreviewTab.typeLabel}
              </dt>
              <dd className="text-sm">{voucherKindLabel(voucher.kind)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pBillingPromotionsIdVoucherPreviewTab.statusLabel}
              </dt>
              <dd>
                <Badge variant="secondary">{voucher.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pBillingPromotionsIdVoucherPreviewTab.codeLabel}
              </dt>
              <dd className="font-mono text-sm">{voucher.code}</dd>
            </div>
            {voucher.kind === "BALANCE_CREDIT" && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  {messages.pBillingPromotionsIdVoucherPreviewTab.currencyLabel}
                </dt>
                <dd className="text-sm">{voucher.currency}</dd>
              </div>
            )}

            {voucher.kind === "BALANCE_CREDIT" && (
              <>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {
                      messages.pBillingPromotionsIdVoucherPreviewTab
                        .creditAmountLabel
                    }
                  </dt>
                  <dd className="text-sm font-medium">
                    {formatBillingMoney(voucher.amount, voucher.currency)}
                  </dd>
                </div>
              </>
            )}

            {voucher.kind === "PRODUCT_PROMOTION" && (
              <>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {
                      messages.pBillingPromotionsIdVoucherPreviewTab
                        .discountTypeLabel
                    }
                  </dt>
                  <dd className="text-sm">
                    {voucher.discountType
                      ? voucherDiscountTypeLabel(voucher.discountType)
                      : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {
                      messages.pBillingPromotionsIdVoucherPreviewTab
                        .discountValueLabel
                    }
                  </dt>
                  <dd className="text-sm">
                    {voucher.discountValue
                      ? renderDiscountValue(voucher)
                      : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {
                      messages.pBillingPromotionsIdVoucherPreviewTab
                        .discountCurrencyLabel
                    }
                  </dt>
                  <dd className="text-sm">
                    {voucher.discountCurrency ?? "Same as checkout currency"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {
                      messages.pBillingPromotionsIdVoucherPreviewTab
                        .currencyPolicyLabel
                    }
                  </dt>
                  <dd className="text-sm">
                    {voucherCurrencyPolicyLabel(voucher.currencyPolicy)}
                  </dd>
                </div>
              </>
            )}

            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pBillingPromotionsIdVoucherPreviewTab.claimsLabel}
              </dt>
              <dd className="text-sm">
                {voucher.claimedCount} / {voucher.maxClaims}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pBillingPromotionsIdVoucherPreviewTab.expiresAtLabel}
              </dt>
              <dd className="text-sm">
                {voucher.expiresAt
                  ? new Date(voucher.expiresAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {
                  messages.pBillingPromotionsIdVoucherPreviewTab
                    .firstCheckoutOnlyLabel
                }
              </dt>
              <dd className="text-sm">
                {voucher.firstCheckoutOnly ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pBillingPromotionsIdVoucherPreviewTab.stackableLabel}
              </dt>
              <dd className="text-sm">{voucher.stackable ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Rejection / eligibility previews */}
      <Card>
        <CardHeader>
          <CardTitle>
            {
              messages.pBillingPromotionsIdVoucherPreviewTab
                .eligibilityPreviewTitle
            }
          </CardTitle>
          <CardDescription>
            {
              messages.pBillingPromotionsIdVoucherPreviewTab
                .eligibilityPreviewDescription
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rejections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {
                messages.pBillingPromotionsIdVoucherPreviewTab
                  .noEligibilityIssuesDetected
              }
            </p>
          ) : (
            <div className="space-y-3">
              {applies.length > 0 && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <WarningCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">
                        {
                          messages.pBillingPromotionsIdVoucherPreviewTab
                            .redemptionRejectedTitle
                        }
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-destructive">
                        {applies.map((r) => (
                          <li key={r.code}>{r.label}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-900/10">
                  <div className="flex items-start gap-2">
                    <WarningCircle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        {
                          messages.pBillingPromotionsIdVoucherPreviewTab
                            .warningsLabel
                        }
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-amber-800 dark:text-amber-300">
                        {warnings.map((r) => (
                          <li key={r.code}>{r.label}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderDiscountValue(voucher: VoucherDetailDTO): string {
  const value = Number(voucher.discountValue)
  if (voucher.discountType === "PERCENTAGE") {
    return `${value}%`
  }
  const currency = voucher.discountCurrency ?? voucher.currency
  return formatBillingMoney(value, currency)
}

function computeRejectionPreviews(
  voucher: VoucherDetailDTO
): RejectionReason[] {
  const reasons: RejectionReason[] = []

  const now = new Date()
  if (new Date(voucher.expiresAt) <= now) {
    reasons.push({
      code: "EXPIRED",
      label: "Voucher expiration date has passed.",
      severity: "error",
    })
  }

  if (voucher.claimedCount >= voucher.maxClaims) {
    reasons.push({
      code: "DEPLETED",
      label: "All claims have been used (claimedCount ≥ maxClaims).",
      severity: "error",
    })
  }

  if (voucher.status === "DISABLED") {
    reasons.push({
      code: "DISABLED",
      label: "Voucher has been disabled and cannot be redeemed.",
      severity: "error",
    })
  }

  if (voucher.status === "EXPIRED") {
    reasons.push({
      code: "STATUS_EXPIRED",
      label: "Voucher status is EXPIRED.",
      severity: "error",
    })
  }

  if (voucher.kind === "PRODUCT_PROMOTION") {
    if (!voucher.discountType) {
      reasons.push({
        code: "NO_DISCOUNT_TYPE",
        label: "Discount type is not configured.",
        severity: "error",
      })
    }
    if (!voucher.discountValue || Number(voucher.discountValue) <= 0) {
      reasons.push({
        code: "NO_DISCOUNT_VALUE",
        label: "Discount value is missing or zero.",
        severity: "error",
      })
    }
  }

  if (
    voucher.kind === "BALANCE_CREDIT" &&
    voucher.amount &&
    Number(voucher.amount) <= 0
  ) {
    reasons.push({
      code: "INVALID_AMOUNT",
      label: "Voucher amount is zero or negative.",
      severity: "error",
    })
  }

  // Warnings (non-blocking)
  if (
    voucher.kind === "PRODUCT_PROMOTION" &&
    voucher.discountType === "PERCENTAGE" &&
    voucher.discountValue &&
    Number(voucher.discountValue) > 100
  ) {
    reasons.push({
      code: "PCT_OVER_100",
      label: "Percentage discount exceeds 100%.",
      severity: "warning",
    })
  }

  if (voucher.maxClaims > 0 && voucher.maxClaims < 10) {
    reasons.push({
      code: "LOW_MAX_CLAIMS",
      label: `Only ${voucher.maxClaims} claim(s) allowed — may deplete quickly.`,
      severity: "warning",
    })
  }

  // Expiry soon warning
  const daysToExpiry =
    (new Date(voucher.expiresAt).getTime() - now.getTime()) /
    (1000 * 60 * 60 * 24)
  if (daysToExpiry > 0 && daysToExpiry < 7) {
    reasons.push({
      code: "EXPIRING_SOON",
      label: `Voucher expires in ${Math.ceil(daysToExpiry)} day(s).`,
      severity: "warning",
    })
  }

  return reasons
}
