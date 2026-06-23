"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Copy,
  DeviceMobileIcon,
  Eye,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import {
  getVpnAdminSubscription,
  retryVpnServerAccount,
  revokeVpnServerAccount,
  retryAllVpnServerAccounts,
  validateVpnServerAccount,
  recreateVpnServerAccount,
  vpnAdminConfigDownloadUrl,
  type VpnSubscriptionItem,
  type VpnServerAccountEntry,
} from "../../_components/vpn-admin-client"
import { ProvisioningAuditModal } from "../../_components/provisioning-audit-modal"

const STATUS_VARIANT: Record<
  VpnSubscriptionItem["status"],
  "default" | "secondary" | "destructive"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "destructive",
}

const PROVISION_VARIANT: Record<
  VpnServerAccountEntry["provisioningStatus"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  PENDING: "outline",
  PROVISIONING: "secondary",
  FAILED: "destructive",
  REVOKED: "secondary",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(amount: string, currency: string) {
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
      <Copy className="h-3.5 w-3.5" />
      {copied && <span className="sr-only">Copied!</span>}
    </Button>
  )
}

function InfoRow({
  label,
  value,
  copyable = false,
}: {
  label: string
  value: React.ReactNode
  copyable?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        {copyable && typeof value === "string" && (
          <CopyButton text={value} />
        )}
      </div>
    </div>
  )
}

function ServerAccountCard({
  account,
  subscriptionId,
  busy,
  onAction,
  onAudit,
}: {
  account: VpnServerAccountEntry
  subscriptionId: string
  busy: string | null
  onAction: (account: VpnServerAccountEntry, action: "retry" | "revoke" | "validate" | "recreate") => void
  onAudit: (account: VpnServerAccountEntry) => void
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3">
        {/* Top: info */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{account.serverName}</span>
            <span className="text-sm text-muted-foreground">
              {account.protocol} · {account.username}
            </span>
            <Badge
              variant={PROVISION_VARIANT[account.provisioningStatus]}
              className="w-fit"
            >
              {account.provisioningStatus}
            </Badge>
            {account.failureReason && (
              <span className="text-sm text-red-500">
                {account.failureReason}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Created {formatDate(account.createdAt)}
          </span>
        </div>

        {/* Bottom: actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            title="View Audit Log"
            onClick={() => onAudit(account)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {account.hasConfig && account.provisioningStatus === "ACTIVE" && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={vpnAdminConfigDownloadUrl(subscriptionId, account.id)}
                download
              >
                Download Config
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy?.endsWith(account.id)}
            onClick={() => onAction(account, "validate")}
          >
            {busy === `validate:${account.id}`
              ? "Validating..."
              : "Validate"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy?.endsWith(account.id)}
            onClick={() => onAction(account, "recreate")}
          >
            {busy === `recreate:${account.id}`
              ? "Recreating..."
              : "Recreate"}
          </Button>
          {(account.provisioningStatus === "FAILED" ||
            account.provisioningStatus === "PENDING") && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy?.endsWith(account.id)}
              onClick={() => onAction(account, "retry")}
            >
              Retry
            </Button>
          )}
          {(account.provisioningStatus === "ACTIVE" ||
            account.provisioningStatus === "FAILED" ||
            account.provisioningStatus === "PENDING") && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy?.endsWith(account.id)}
              onClick={() => onAction(account, "revoke")}
            >
              Revoke
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionDetailPage() {
  const params = useParams()
  const subscriptionId = params.id as string

  const [subscription, setSubscription] = useState<VpnSubscriptionItem | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [auditAccount, setAuditAccount] = useState<VpnServerAccountEntry | null>(
    null
  )

  const fetchSubscription = useCallback(async () => {
    setLoading(true)
    try {
      setError(null)
      const res = await getVpnAdminSubscription(subscriptionId)
      setSubscription(res.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [subscriptionId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubscription()
  }, [fetchSubscription])

  const act = async (
    account: VpnServerAccountEntry,
    action: "retry" | "revoke" | "validate" | "recreate"
  ) => {
    if (
      action === "revoke" &&
      !window.confirm(`Revoke ${account.protocol} on ${account.serverName}?`)
    )
      return
    if (
      action === "recreate" &&
      !window.confirm(
        `Recreate ${account.protocol} account on ${account.serverName}? This clears stored config/credentials and queues provisioning again.`
      )
    )
      return

    setBusy(`${action}:${account.id}`)
    try {
      if (action === "retry") {
        await retryVpnServerAccount(subscriptionId, account.id)
        await fetchSubscription()
      } else if (action === "revoke") {
        await revokeVpnServerAccount(subscriptionId, account.id)
        await fetchSubscription()
      } else if (action === "recreate") {
        await recreateVpnServerAccount(subscriptionId, account.id)
        await fetchSubscription()
      } else {
        const result = await validateVpnServerAccount(subscriptionId, account.id)
        window.alert(
          result.data.exists
            ? `Account exists on server.\n\n${result.data.message}`
            : `Account is missing on server.\n\n${result.data.message}`
        )
      }
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const retryAllFailed = async () => {
    if (!window.confirm("Retry provisioning for all failed accounts?")) return
    setBusy(subscriptionId)
    try {
      await retryAllVpnServerAccounts(subscriptionId)
      await fetchSubscription()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // Group server accounts by protocol
  const groupedAccounts = useMemo(() => {
    if (!subscription) return {}
    const groups: Record<string, VpnServerAccountEntry[]> = {}
    for (const account of subscription.serverAccounts) {
      const p = account.protocol
      if (!groups[p]) groups[p] = []
      groups[p].push(account)
    }
    return groups
  }, [subscription])

  // Compute per-group provisioning summaries
  const groupSummaries = useMemo(() => {
    const summaries: Record<string, { active: number; pending: number; failed: number; revoked: number; total: number }> = {}
    for (const [protocol, accounts] of Object.entries(groupedAccounts)) {
      const s = { active: 0, pending: 0, failed: 0, revoked: 0, total: accounts.length }
      for (const a of accounts) {
        switch (a.provisioningStatus) {
          case "ACTIVE": s.active++; break
          case "PENDING":
          case "PROVISIONING": s.pending++; break
          case "FAILED": s.failed++; break
          case "REVOKED": s.revoked++; break
        }
      }
      summaries[protocol] = s
    }
    return summaries
  }, [groupedAccounts])

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </main>
    )
  }

  if (error || !subscription) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/portal/vpn/subscriptions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Subscription Not Found</h1>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error ?? "Subscription not found."}
        </div>
      </main>
    )
  }

  const { provisioningSummary } = subscription

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/portal/vpn/subscriptions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Subscription Details</h1>
          <p className="text-sm text-muted-foreground">
            {subscription.packageName} · {subscription.organizationName ?? subscription.organizationId}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[subscription.status]} className="text-sm">
            {subscription.status}
          </Badge>
          {provisioningSummary.failed > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy === subscriptionId}
              onClick={retryAllFailed}
            >
              {busy === subscriptionId ? "Retrying..." : "Retry All Failed"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Info */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Information</CardTitle>
            <CardDescription>Basic subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="ID" value={subscription.id} copyable />
            <Separator />
            <InfoRow label="Organization" value={subscription.organizationName ?? subscription.organizationId} />
            <Separator />
            <InfoRow label="Package" value={subscription.packageName} />
            <Separator />
            <InfoRow
              label="Status"
              value={
                <Badge variant={STATUS_VARIANT[subscription.status]}>
                  {subscription.status}
                </Badge>
              }
            />
            <Separator />
            <InfoRow
              label="Devices"
              value={
                <Link
                  href={`/portal/vpn/devices?subscriptionId=${subscription.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
                  {subscription.deviceCount}
                </Link>
              }
            />
          </CardContent>
        </Card>

        {/* Billing Info */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Information</CardTitle>
            <CardDescription>Price and period details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              label="Price"
              value={formatCurrency(subscription.priceLocked, subscription.currency)}
            />
            <Separator />
            <InfoRow label="Currency" value={subscription.currency} />
            {subscription.originalPrice && subscription.originalCurrency && (
              <>
                <Separator />
                <InfoRow
                  label="Original Price"
                  value={`${formatCurrency(subscription.originalPrice, subscription.originalCurrency)} (${subscription.originalCurrency})`}
                />
              </>
            )}
            {subscription.exchangeRate && subscription.exchangeRate !== 1 && (
              <>
                <Separator />
                <InfoRow
                  label="Exchange Rate"
                  value={subscription.exchangeRate.toFixed(4)}
                />
              </>
            )}
            <Separator />
            <InfoRow
              label="Period Start"
              value={formatDate(subscription.currentPeriodStart)}
            />
            <Separator />
            <InfoRow
              label="Period End"
              value={formatDate(subscription.currentPeriodEnd)}
            />
            <Separator />
            <InfoRow label="Created" value={formatDate(subscription.createdAt)} />
            <Separator />
            <InfoRow label="Updated" value={formatDate(subscription.updatedAt)} />
          </CardContent>
        </Card>
      </div>

      {/* Provisioning Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Provisioning Summary</CardTitle>
              <CardDescription>Status of server account provisioning</CardDescription>
            </div>
            {provisioningSummary.failed > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy === subscriptionId}
                onClick={retryAllFailed}
              >
                {busy === subscriptionId ? "Retrying..." : "Retry All Failed"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-green-600">
                {provisioningSummary.active}
              </div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {provisioningSummary.pending}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-red-600">
                {provisioningSummary.failed}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {provisioningSummary.revoked}
              </div>
              <div className="text-xs text-muted-foreground">Revoked</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Accounts — grouped by protocol */}
      {Object.entries(groupedAccounts).map(([protocol, accounts]) => {
        const summary = groupSummaries[protocol]
        return (
          <Collapsible key={protocol} defaultOpen>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-2 hover:underline">
                    <span className="text-lg font-semibold">{protocol}</span>
                    <Badge variant="secondary">{accounts.length}</Badge>
                    {summary && (
                      <div className="flex items-center gap-1.5">
                        {summary.active > 0 && (
                          <Badge variant="default" className="text-xs">{summary.active}</Badge>
                        )}
                        {summary.pending > 0 && (
                          <Badge variant="outline" className="text-xs">{summary.pending}</Badge>
                        )}
                        {summary.failed > 0 && (
                          <Badge variant="destructive" className="text-xs">{summary.failed}</Badge>
                        )}
                        {summary.revoked > 0 && (
                          <Badge variant="secondary" className="text-xs">{summary.revoked}</Badge>
                        )}
                      </div>
                    )}
                  </CollapsibleTrigger>
                  {summary?.failed > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === subscriptionId}
                      onClick={retryAllFailed}
                    >
                      {busy === subscriptionId ? "Retrying..." : "Retry All Failed"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-3">
                    {accounts.map((account) => (
                      <ServerAccountCard
                        key={account.id}
                        account={account}
                        subscriptionId={subscriptionId}
                        busy={busy}
                        onAction={act}
                        onAudit={setAuditAccount}
                      />
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}

      {auditAccount && (
        <ProvisioningAuditModal
          account={auditAccount}
          open={!!auditAccount}
          onClose={() => setAuditAccount(null)}
        />
      )}
    </main>
  )
}
