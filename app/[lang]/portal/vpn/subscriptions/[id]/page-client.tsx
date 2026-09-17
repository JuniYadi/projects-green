"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Copy,
  DeviceMobileIcon,
  Eye,
  HardDrivesIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CountryFlag } from "@/components/ui/country-flag"
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
import { toast } from "sonner"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"

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
import { VpnPairingQrModal } from "@/modules/vpn/_components/vpn-pairing-qr-modal"

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

type ProvisioningStatusSummary = {
  active: number
  pending: number
  failed: number
  revoked: number
  total: number
}

type ServerAccountGroup = {
  serverId: string
  serverName: string
  hostname: string
  ipAddress: string | null
  region: { name: string; slug: string; countryCode: string } | null
  accounts: VpnServerAccountEntry[]
  summary: ProvisioningStatusSummary
}

function createEmptySummary(): ProvisioningStatusSummary {
  return { active: 0, pending: 0, failed: 0, revoked: 0, total: 0 }
}

function addAccountToSummary(
  summary: ProvisioningStatusSummary,
  account: VpnServerAccountEntry
) {
  summary.total += 1

  switch (account.provisioningStatus) {
    case "ACTIVE":
      summary.active += 1
      break
    case "PENDING":
    case "PROVISIONING":
      summary.pending += 1
      break
    case "FAILED":
      summary.failed += 1
      break
    case "REVOKED":
      summary.revoked += 1
      break
  }
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

function CopyButton({
  text,
  messages,
}: {
  text: string
  messages: ReturnType<typeof getMessages>
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy — please copy manually")
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={handleCopy}
    >
      <Copy className="h-3.5 w-3.5" />
      {copied && (
        <span className="sr-only">
          {messages.pPortalVpnSubscriptionsPageClient.copied}
        </span>
      )}
    </Button>
  )
}

function InfoRow({
  label,
  value,
  messages,
  copyable = false,
}: {
  label: string
  value: React.ReactNode
  messages: ReturnType<typeof getMessages>
  copyable?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        {copyable && typeof value === "string" && (
          <CopyButton text={value} messages={messages} />
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
  messages,
}: {
  account: VpnServerAccountEntry
  subscriptionId: string
  busy: string | null
  onAction: (
    account: VpnServerAccountEntry,
    action: "retry" | "revoke" | "validate" | "recreate"
  ) => void
  onAudit: (account: VpnServerAccountEntry) => void
  messages: ReturnType<typeof getMessages>
}) {
  const t = messages.pPortalVpnSubscriptionsPageClient
  const configExtension = account.protocol === "WIREGUARD" ? ".conf" : ".ovpn"

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3">
        {/* Top: info */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{account.protocol}</span>
              <Badge
                variant={PROVISION_VARIANT[account.provisioningStatus]}
                className="w-fit"
              >
                {account.provisioningStatus}
              </Badge>
              {account.hasConfig && (
                <Badge variant="outline" className="w-fit">
                  {t.badgeConfig}
                </Badge>
              )}
              {account.hasCredentials && (
                <Badge variant="outline" className="w-fit">
                  {t.badgeCredentials}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{account.username}</span>
              {account.port != null && (
                <span className="font-mono">:{account.port}</span>
              )}
              <span>
                {t.createdAt.replace("{date}", formatDate(account.createdAt))}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {t.accountIdLabel} {account.id}
            </div>
            <div className="text-xs text-muted-foreground">
              {t.updatedAt.replace("{date}", formatDate(account.updatedAt))}
            </div>
            {account.failureReason && (
              <span className="text-sm text-red-500">
                {account.failureReason}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              variant="ghost"
              size="icon"
              title={t.viewAuditLog}
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
                  {t.download.replace("{ext}", configExtension)}
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={busy?.endsWith(account.id)}
              onClick={() => onAction(account, "validate")}
            >
              {busy === `validate:${account.id}` ? t.validating : t.validate}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy?.endsWith(account.id)}
              onClick={() => onAction(account, "recreate")}
            >
              {busy === `recreate:${account.id}` ? t.recreating : t.recreate}
            </Button>
            {(account.provisioningStatus === "FAILED" ||
              account.provisioningStatus === "PENDING") && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy?.endsWith(account.id)}
                onClick={() => onAction(account, "retry")}
              >
                {t.retry}
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
                {t.revoke}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryBadges({
  summary,
  messages,
}: {
  summary: ProvisioningStatusSummary
  messages: ReturnType<typeof getMessages>
}) {
  const t = messages.pPortalVpnSubscriptionsPageClient

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="text-xs">
        {t.countAccounts.replace("{count}", String(summary.total))}
      </Badge>
      {summary.active > 0 && (
        <Badge variant="default" className="text-xs">
          {t.countActive.replace("{count}", String(summary.active))}
        </Badge>
      )}
      {summary.pending > 0 && (
        <Badge variant="outline" className="text-xs">
          {t.countPending.replace("{count}", String(summary.pending))}
        </Badge>
      )}
      {summary.failed > 0 && (
        <Badge variant="destructive" className="text-xs">
          {t.countFailed.replace("{count}", String(summary.failed))}
        </Badge>
      )}
      {summary.revoked > 0 && (
        <Badge variant="secondary" className="text-xs">
          {t.countRevoked.replace("{count}", String(summary.revoked))}
        </Badge>
      )}
    </div>
  )
}

export default function SubscriptionDetailPage() {
  const params = useParams<{ lang?: string; id?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const detail = messages.console.vpn.subscriptionDetail
  const subscriptionId = params.id as string

  const [subscription, setSubscription] = useState<VpnSubscriptionItem | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [auditAccount, setAuditAccount] =
    useState<VpnServerAccountEntry | null>(null)
  const [pairingOpen, setPairingOpen] = useState(false)

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
        const result = await validateVpnServerAccount(
          subscriptionId,
          account.id
        )
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

  const serverGroups = useMemo(() => {
    if (!subscription) return []

    const groups = new Map<string, ServerAccountGroup>()

    for (const account of subscription.serverAccounts) {
      const group = groups.get(account.serverId) ?? {
        serverId: account.serverId,
        serverName: account.serverName,
        hostname: account.hostname,
        ipAddress: account.ipAddress,
        region: account.region,
        accounts: [],
        summary: createEmptySummary(),
      }

      group.accounts.push(account)
      addAccountToSummary(group.summary, account)
      groups.set(account.serverId, group)
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      accounts: group.accounts.sort((a, b) =>
        a.protocol.localeCompare(b.protocol)
      ),
    }))
  }, [subscription])

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
          <h1 className="text-2xl font-semibold">{detail.notFoundTitle}</h1>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error ?? detail.notFoundDefault}
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
          <h1 className="text-2xl font-semibold">
            {detail.operationDetailsTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {subscription.packageName} ·{" "}
            {subscription.organizationName ?? subscription.organizationId}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant={STATUS_VARIANT[subscription.status]}
            className="text-sm"
          >
            {subscription.status}
          </Badge>
          {provisioningSummary.failed > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy === subscriptionId}
              onClick={retryAllFailed}
            >
              {busy === subscriptionId
                ? detail.retrying
                : detail.retryAllFailed}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Info */}
        <Card>
          <CardHeader>
            <CardTitle>{detail.subscriptionInfoTitle}</CardTitle>
            <CardDescription>{detail.subscriptionInfoDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              label={detail.labelId}
              value={subscription.id}
              messages={messages}
              copyable
            />
            <Separator />
            <InfoRow
              label={detail.labelOrganization}
              value={
                subscription.organizationName ?? subscription.organizationId
              }
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelPackage}
              value={subscription.packageName}
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelStatus}
              value={
                <Badge variant={STATUS_VARIANT[subscription.status]}>
                  {subscription.status}
                </Badge>
              }
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelDevices}
              value={
                <Link
                  href={`/portal/vpn/devices?subscriptionId=${subscription.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
                  {subscription.deviceCount}
                </Link>
              }
              messages={messages}
            />
          </CardContent>
        </Card>

        {/* Billing Info */}
        <Card>
          <CardHeader>
            <CardTitle>{detail.commercialContextTitle}</CardTitle>
            <CardDescription>{detail.commercialContextDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              label={detail.labelBillingRecord}
              value={
                subscription.serviceSubscriptionId ? (
                  <Link
                    href={`/portal/billing/subscriptions?subscriptionId=${encodeURIComponent(subscription.serviceSubscriptionId)}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {detail.viewInBilling}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {detail.billingUnavailable}
                  </span>
                )
              }
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelPrice}
              value={formatCurrency(
                subscription.priceLocked,
                subscription.currency
              )}
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelCurrency}
              value={subscription.currency}
              messages={messages}
            />
            {subscription.originalPrice && subscription.originalCurrency && (
              <>
                <Separator />
                <InfoRow
                  label={detail.labelOriginalPrice}
                  value={`${formatCurrency(subscription.originalPrice, subscription.originalCurrency)} (${subscription.originalCurrency})`}
                  messages={messages}
                />
              </>
            )}
            {subscription.exchangeRate && subscription.exchangeRate !== 1 && (
              <>
                <Separator />
                <InfoRow
                  label={detail.labelExchangeRate}
                  value={subscription.exchangeRate.toFixed(4)}
                  messages={messages}
                />
              </>
            )}
            <Separator />
            <InfoRow
              label={detail.labelPeriodStart}
              value={formatDate(subscription.currentPeriodStart)}
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelPeriodEnd}
              value={formatDate(subscription.currentPeriodEnd)}
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelCreated}
              value={formatDate(subscription.createdAt)}
              messages={messages}
            />
            <Separator />
            <InfoRow
              label={detail.labelUpdated}
              value={formatDate(subscription.updatedAt)}
              messages={messages}
            />
          </CardContent>
        </Card>
      </div>

      {/* Mobile Pairing */}
      <Card>
        <CardHeader>
          <CardTitle>{detail.mobilePairingTitle}</CardTitle>
          <CardDescription>{detail.mobilePairingDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">ID</Badge>
            <span
              className="font-mono text-sm text-muted-foreground"
              title={subscription.id}
            >
              {subscription.id.length > 28
                ? `${subscription.id.slice(0, 28)}…`
                : subscription.id}
            </span>
            <CopyButton text={subscription.id} messages={messages} />
          </div>
          <p className="text-sm text-muted-foreground">{detail.scanQrPrompt}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={subscription.status !== "ACTIVE"}
            onClick={() => setPairingOpen(true)}
          >
            <DeviceMobileIcon className="mr-1.5 h-4 w-4" />
            {detail.pairNewDevice}
          </Button>
        </CardContent>
      </Card>

      <VpnPairingQrModal
        open={pairingOpen}
        onOpenChange={setPairingOpen}
        subscriptionId={subscription.id}
        subscriptionName={subscription.packageName}
      />

      {/* Provisioning Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{detail.provisioningSummaryTitle}</CardTitle>
              <CardDescription>
                {detail.provisioningSummaryDesc}
              </CardDescription>
            </div>
            {provisioningSummary.failed > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy === subscriptionId}
                onClick={retryAllFailed}
              >
                {busy === subscriptionId
                  ? detail.retrying
                  : detail.retryAllFailed}
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
              <div className="text-xs text-muted-foreground">
                {detail.statusActive}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {provisioningSummary.pending}
              </div>
              <div className="text-xs text-muted-foreground">
                {detail.statusPending}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-red-600">
                {provisioningSummary.failed}
              </div>
              <div className="text-xs text-muted-foreground">
                {detail.statusFailed}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {provisioningSummary.revoked}
              </div>
              <div className="text-xs text-muted-foreground">
                {detail.statusRevoked}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Accounts — grouped by server */}
      {serverGroups.map((group) => {
        const protocols = group.accounts.map((account) => account.protocol)

        return (
          <Collapsible key={group.serverId} defaultOpen>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <CollapsibleTrigger className="flex items-start gap-3 text-left hover:underline">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <HardDrivesIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">
                        {group.serverName}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {group.region ? (
                          <>
                            <CountryFlag
                              country={group.region.countryCode}
                              className="rounded-2xs inline-block h-3.5 w-5 shrink-0 object-cover shadow-2xs"
                            />
                            <span>{group.region.name}</span>
                          </>
                        ) : (
                          <span>{detail.noRegion}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {detail.labelHost} {group.hostname || "—"}
                        </span>
                        <span>
                          {detail.labelIp} {group.ipAddress || "—"}
                        </span>
                        <span>
                          {detail.labelProtocols} {protocols.join(" + ")}
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <SummaryBadges summary={group.summary} messages={messages} />
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-3">
                    {group.accounts.map((account) => (
                      <ServerAccountCard
                        key={account.id}
                        account={account}
                        subscriptionId={subscriptionId}
                        busy={busy}
                        onAction={act}
                        onAudit={setAuditAccount}
                        messages={messages}
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
