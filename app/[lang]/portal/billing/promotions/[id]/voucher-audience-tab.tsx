"use client"

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
  const targetWorkosUserId = voucher.targetWorkosUserId ?? ""
  const targetOrganizationId = voucher.targetOrganizationId ?? ""

  const hasUserTarget = Boolean(targetWorkosUserId)
  const hasOrgTarget = Boolean(targetOrganizationId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audience Targeting</CardTitle>
        <CardDescription>
          Restrict who can redeem this voucher. Leave both fields blank to make
          it available to everyone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="voucher-target-user">Target WorkOS User ID</Label>
            <Input
              id="voucher-target-user"
              value={targetWorkosUserId}
              onChange={(e) =>
                onUpdate({ targetWorkosUserId: e.target.value || null })
              }
              placeholder="e.g. user_abc123"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Only this specific user can redeem the voucher. Find the user ID
              in your WorkOS dashboard.
            </p>
          </div>

          <div>
            <Label htmlFor="voucher-target-org">
              Target WorkOS Organization ID
            </Label>
            <Input
              id="voucher-target-org"
              value={targetOrganizationId}
              onChange={(e) =>
                onUpdate({ targetOrganizationId: e.target.value || null })
              }
              placeholder="e.g. org_xyz789"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Only users in this organization can redeem the voucher.
            </p>
          </div>
        </div>

        {(hasUserTarget || hasOrgTarget) && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">Targeting active</p>
            <p className="text-muted-foreground">
              {hasUserTarget && hasOrgTarget
                ? `This voucher is restricted to user ${targetWorkosUserId} in organization ${targetOrganizationId}.`
                : hasUserTarget
                  ? `This voucher is restricted to user ${targetWorkosUserId}.`
                  : `This voucher is restricted to organization ${targetOrganizationId}.`}
            </p>
          </div>
        )}

        {!hasUserTarget && !hasOrgTarget && (
          <div className="rounded-md border border-green-200 bg-green-50/50 p-3 text-sm dark:border-green-900 dark:bg-green-900/10">
            <p className="font-medium text-green-800 dark:text-green-200">
              Public voucher
            </p>
            <p className="text-muted-foreground dark:text-green-300/80">
              Anyone with the voucher code can redeem it.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
