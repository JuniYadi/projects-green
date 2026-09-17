"use client"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { VoucherDetailDTO } from "@/lib/billing-client"

export function VoucherAudienceTab({
  voucher,
  onUpdate,
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
}) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingPromotionsVoucherAudienceTab

  const targetWorkosUserId = voucher.targetWorkosUserId ?? ""
  const targetOrganizationId = voucher.targetOrganizationId ?? ""

  const hasUserTarget = Boolean(targetWorkosUserId)
  const hasOrgTarget = Boolean(targetOrganizationId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.audienceTargetingTitle}</CardTitle>
        <CardDescription>{t.audienceTargetingDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="voucher-target-user">{t.targetUserLabel}</Label>
            <Input
              id="voucher-target-user"
              value={targetWorkosUserId}
              onChange={(e) =>
                onUpdate({ targetWorkosUserId: e.target.value || null })
              }
              placeholder={t.targetUserPlaceholder}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{t.targetUserHelp}</p>
          </div>

          <div>
            <Label htmlFor="voucher-target-org">{t.targetOrgLabel}</Label>
            <Input
              id="voucher-target-org"
              value={targetOrganizationId}
              onChange={(e) =>
                onUpdate({ targetOrganizationId: e.target.value || null })
              }
              placeholder={t.targetOrgPlaceholder}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{t.targetOrgHelp}</p>
          </div>
        </div>

        {(hasUserTarget || hasOrgTarget) && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">{t.targetingActiveTitle}</p>
            <p className="text-muted-foreground">
              {hasUserTarget && hasOrgTarget
                ? t.targetingUserAndOrg
                    .replace("{userId}", targetWorkosUserId)
                    .replace("{orgId}", targetOrganizationId)
                : hasUserTarget
                  ? t.targetingUserOnly.replace("{userId}", targetWorkosUserId)
                  : t.targetingOrgOnly.replace("{orgId}", targetOrganizationId)}
            </p>
          </div>
        )}

        {!hasUserTarget && !hasOrgTarget && (
          <div className="rounded-md border border-green-200 bg-green-50/50 p-3 text-sm dark:border-green-900 dark:bg-green-900/10">
            <p className="font-medium text-green-800 dark:text-green-200">
              {t.publicVoucherTitle}
            </p>
            <p className="text-muted-foreground dark:text-green-300/80">
              {t.publicVoucherDescription}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
