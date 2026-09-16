"use client"

import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CountryFlag } from "@/components/ui/country-flag"
import { toast } from "sonner"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  cancelVpnSubscription,
  reinstateVpnSubscription,
  getVpnProxyCredentials,
  vpnConfigDownloadUrl,
  type VpnServerAccount,
  type VpnSubscription,
} from "@/lib/vpn-client"
import {
  DownloadIcon,
  EyeIcon,
  EyeSlashIcon,
  MapPinIcon,
  CopySimpleIcon,
  DotsThreeVertical,
} from "@phosphor-icons/react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { VpnPairingQrModal } from "@/modules/vpn/_components/vpn-pairing-qr-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Props = {
  subscriptions: VpnSubscription[]
  onChanged: () => void
  locale?: string
}

export function formatDate(value: string, locale: string = "id"): string {
  return new Date(value).toLocaleDateString(
    locale === "id" ? "id-ID" : "en-US",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  )
}

const STATUS_VARIANT: Record<
  VpnSubscription["status"],
  "default" | "secondary" | "destructive"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "destructive",
}

function normalizeCountryCode(countryCode: string | undefined): string {
  return countryCode?.trim().toUpperCase() ?? ""
}

function RegionBadge({
  region,
  fallbackLabel,
}: {
  region: { name: string; slug: string; countryCode: string } | null
  fallbackLabel?: string
}) {
  if (!region) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <MapPinIcon className="h-3.5 w-3.5" />
        {fallbackLabel ?? "Region"}
      </Badge>
    )
  }

  const countryCode = normalizeCountryCode(region.countryCode)

  return (
    <Badge variant="outline" className="gap-1.5">
      <CountryFlag
        country={countryCode}
        className="rounded-2xs inline-block h-3.5 w-5 shrink-0 object-cover shadow-2xs"
        fallback={<span aria-hidden>🌐</span>}
      />
      <span>{countryCode || region.slug.toUpperCase()}</span>
      <span className="text-muted-foreground">{region.name}</span>
    </Badge>
  )
}

function ProxyCredentialCell({
  subscriptionId,
  account,
  locale = "en",
}: {
  subscriptionId: string
  account: VpnServerAccount
  locale?: string
}) {
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices
  const [password, setPassword] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (password !== null) return password
    const creds = await getVpnProxyCredentials(subscriptionId, account.id)
    setPassword(creds.password ?? "—")
    return creds.password ?? "—"
  }

  const toggle = async () => {
    if (revealed) {
      setRevealed(false)
      return
    }
    setLoading(true)
    try {
      await load()
      setRevealed(true)
    } catch {
      setPassword("—")
      setRevealed(true)
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    setLoading(true)
    try {
      const value = await load()
      await navigator.clipboard.writeText(
        `username=${account.username}\npassword=${value}`
      )
      toast.success(t.proxyCredentialsCopied)
    } catch {
      toast.error(t.failedToCopyProxyCredentials)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span>
        {t.user} <span className="font-mono">{account.username}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="font-mono">
          {t.pass} {revealed ? (password ?? "…") : "••••••••"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1"
          onClick={() => void toggle()}
          disabled={loading}
          aria-label={revealed ? t.hidePassword : t.showPassword}
        >
          {revealed ? (
            <EyeSlashIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1"
          onClick={() => void copy()}
          disabled={loading}
          aria-label={t.copyProxyCredentials}
        >
          <CopySimpleIcon className="h-4 w-4" />
        </Button>
      </span>
    </div>
  )
}

function WireGuardQrAction({
  subscriptionId,
  accountId,
  locale = "en",
}: {
  subscriptionId: string
  accountId: string
  locale?: string
}) {
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices
  const [open, setOpen] = useState(false)
  const [qrData, setQrData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const showQr = async () => {
    setOpen(true)
    if (qrData !== null) return
    setLoading(true)
    setError(false)
    try {
      // eslint-disable-next-line no-restricted-globals
      const response = await fetch(
        vpnConfigDownloadUrl(subscriptionId, accountId)
      )
      if (!response.ok) throw new Error("Failed to download configuration")
      const config = await response.text()
      setQrData(await QRCode.toDataURL(config, { width: 256, margin: 2 }))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => void showQr()}
        aria-label={t.wireGuardQrCode}
      >
        {t.wireGuardQrCode}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.wireGuardQrCode}</DialogTitle>
            <DialogDescription>{t.scanQrWireGuard}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-64 items-center justify-center">
            {loading ? (
              <span className="text-sm text-muted-foreground">
                {t.loadingQr}
              </span>
            ) : error ? (
              <span className="text-sm text-destructive">
                {t.unableToGenerateQr}
              </span>
            ) : qrData ? (
              <img src={qrData} alt={t.wireGuardQrCode} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
function WireGuardConfigQrModal({
  configUrl,
  onClose,
  locale = "en",
}: {
  configUrl: string
  onClose: () => void
  locale?: string
}) {
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices
  const [qrData, setQrData] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        // eslint-disable-next-line no-restricted-globals
        const response = await fetch(configUrl)
        if (!response.ok) throw new Error("Failed to download configuration")
        const config = await response.text()
        const qr = await QRCode.toDataURL(config, { width: 256, margin: 2 })
        if (!cancelled) {
          setQrData(qr)
        }
      } catch {
        if (!cancelled) {
          setError(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [configUrl])

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="text-center sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.wireGuardQrCode}</DialogTitle>
          <DialogDescription>{t.scanQrWireGuardMobile}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-4">
          <div className="flex min-h-48 w-48 items-center justify-center rounded-lg border p-2">
            {loading ? (
              <span className="text-sm text-muted-foreground">
                {t.loadingQr}
              </span>
            ) : error ? (
              <span className="text-sm text-destructive">
                {t.unableToGenerateQr}
              </span>
            ) : qrData ? (
              <img src={qrData} alt={t.wireGuardQrCode} className="h-48 w-48" />
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={configUrl} download>
              {t.downloadConf}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConfigCell({
  subscriptionId,
  account,
  subStatus,
  locale = "en",
}: {
  subscriptionId: string
  account: VpnServerAccount
  subStatus: VpnSubscription["status"]
  locale?: string
}) {
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices
  if (account.provisioningStatus === "REVOKED") {
    return <span className="text-xs text-muted-foreground">{t.revoked}</span>
  }
  if (subStatus !== "ACTIVE") {
    return (
      <span className="text-xs text-muted-foreground">{t.renewToDownload}</span>
    )
  }
  if (account.protocol === "PROXY") {
    return (
      <ProxyCredentialCell
        subscriptionId={subscriptionId}
        account={account}
        locale={locale}
      />
    )
  }
  if (!account.hasConfig) {
    return (
      <span className="text-xs text-muted-foreground">{t.provisioning}</span>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
        <a href={vpnConfigDownloadUrl(subscriptionId, account.id)} download>
          <DownloadIcon className="mr-1 h-3.5 w-3.5" />
          {t.download}
        </a>
      </Button>
      {account.protocol === "WIREGUARD" && (
        <WireGuardQrAction
          subscriptionId={subscriptionId}
          accountId={account.id}
          locale={locale}
        />
      )}
    </div>
  )
}

type ProtocolIconProps = {
  protocol: VpnServerAccount["protocol"]
}

function ProtocolIcon({ protocol }: ProtocolIconProps) {
  const label =
    protocol === "OPENVPN"
      ? "OpenVPN"
      : protocol === "WIREGUARD"
        ? "WireGuard"
        : "Proxy"
  return (
    <span className="inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase">
      {label}
    </span>
  )
}

function ProtocolControl({
  subscriptionId,
  account,
  subStatus,
  locale = "en",
}: {
  subscriptionId: string
  account: VpnServerAccount
  subStatus: VpnSubscription["status"]
  locale?: string
}) {
  const isFailed = account.provisioningStatus === "FAILED"
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
      <span className="text-xs font-medium">
        {account.protocol === "WIREGUARD"
          ? "WireGuard"
          : account.protocol === "OPENVPN"
            ? "OpenVPN"
            : "Proxy"}
      </span>
      <div className="flex items-center gap-1.5">
        <ConfigCell
          subscriptionId={subscriptionId}
          account={account}
          subStatus={subStatus}
          locale={locale}
        />
        {isFailed && (
          <Badge variant="destructive" className="text-[10px]">
            {t.failed}
          </Badge>
        )}
      </div>
    </div>
  )
}
type ServerGroup = {
  serverId: string
  serverName: string
  hostname: string
  ipAddress: string | null
  region: { name: string; slug: string; countryCode: string } | null
  accounts: VpnServerAccount[]
}

function groupByServer(accounts: VpnServerAccount[]): ServerGroup[] {
  const map = new Map<string, ServerGroup>()
  for (const a of accounts) {
    const key = a.serverId
    let group = map.get(key)
    if (!group) {
      group = {
        serverId: a.serverId,
        serverName: a.serverName,
        hostname: a.hostname,
        ipAddress: a.ipAddress,
        region: a.region,
        accounts: [],
      }
      map.set(key, group)
    }
    group.accounts.push(a)
  }
  return [...map.values()]
}

type BillingStatus = "ACTIVE" | "CANCELLING" | "SUSPENDED" | "EXPIRED"

function billingStatus(sub: VpnSubscription): BillingStatus {
  return sub.cancelAtPeriodEnd ? "CANCELLING" : sub.status
}

export function subscriptionPriceLabel(sub: VpnSubscription): string {
  const base = sub.originalPrice
    ? `${sub.originalPrice} ${sub.originalCurrency}`
    : `${sub.priceLocked} ${sub.currency}`
  if (sub.exchangeRate && sub.originalCurrency !== sub.currency) {
    return `${base} (${sub.priceLocked} ${sub.currency})`
  }
  return base
}

function subscriptionSearchText(sub: VpnSubscription): string {
  return sub.serverAccounts
    .flatMap((account) => [
      account.serverName,
      account.hostname,
      account.ipAddress ?? "",
      account.region?.name ?? "",
      account.region?.slug ?? "",
      account.protocol,
      account.username,
    ])
    .filter(Boolean)
    .join(" ")
}

function regionFilterValue(sub: VpnSubscription): string {
  return [
    ...new Set(
      sub.serverAccounts
        .map((account) => account.region?.slug)
        .filter((slug): slug is string => Boolean(slug))
    ),
  ].join("|")
}

async function copySubscriptionId(
  id: string,
  messages?: { copied: string; failedToCopyManual: string }
): Promise<void> {
  const successText = messages?.copied ?? "Copied!"
  const errorText =
    messages?.failedToCopyManual ?? "Failed to copy — please copy manually"
  try {
    await navigator.clipboard.writeText(id)
    toast.success(successText)
  } catch {
    try {
      // ponytail: clipboard requires secure context
      const el = document.createElement("textarea")
      el.value = id
      el.style.position = "fixed"
      el.style.opacity = "0"
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      toast.success(successText)
    } catch {
      toast.error(errorText)
    }
  }
}

function SubscriptionStatusBadge({
  sub,
  locale = "en",
}: {
  sub: VpnSubscription
  locale?: string
}) {
  const status = billingStatus(sub)
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices

  const statusLabel =
    status === "CANCELLING"
      ? t.cancellingStatus
      : status === "ACTIVE"
        ? t.activeStatus
        : status === "SUSPENDED"
          ? t.suspendedStatus
          : status === "EXPIRED"
            ? t.expiredStatus
            : sub.status

  return (
    <Badge
      variant={
        status === "CANCELLING" ? "secondary" : STATUS_VARIANT[sub.status]
      }
      className="text-xs font-medium uppercase"
    >
      {statusLabel}
    </Badge>
  )
}

function ConnectionSummaryCell({
  sub,
  locale = "en",
}: {
  sub: VpnSubscription
  locale?: string
}) {
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices
  const groups = groupByServer(sub.serverAccounts)
  const visibleGroups = groups.slice(0, 2)
  const extraCount = groups.length - visibleGroups.length

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleGroups.map((group) => (
          <RegionBadge
            key={group.serverId}
            region={group.region}
            fallbackLabel={t.region}
          />
        ))}
        {extraCount > 0 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            +{extraCount} {t.moreCount}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {[
          ...new Set(sub.serverAccounts.map((account) => account.protocol)),
        ].map((protocol) => (
          <ProtocolIcon key={protocol} protocol={protocol} />
        ))}
      </div>
    </div>
  )
}

function DeviceSummaryCell({
  sub,
  devices,
  locale = "en",
}: {
  sub: VpnSubscription
  devices: Array<{ deviceName: string; platform: string; status: string }>
  locale?: string
}) {
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices
  const maxDevices =
    sub.serverAccounts.filter(
      (account) => account.provisioningStatus === "ACTIVE"
    ).length * 2

  return (
    <span className="text-sm">
      {devices.length}/{maxDevices} {t.devicesCount}
    </span>
  )
}

export function VpnServerAccountsDetail({
  subscription,
  locale = "en",
}: {
  subscription: VpnSubscription
  locale?: string
}) {
  const t = getMessages(resolveLocaleOrDefault(locale)).console.vpn.myServices
  const [search, setSearch] = useState("")
  const [regionFilter, setRegionFilter] = useState("all")

  const serverGroups = useMemo(
    () => groupByServer(subscription.serverAccounts),
    [subscription.serverAccounts]
  )

  const regionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of serverGroups) {
      if (g.region) {
        map.set(g.region.slug, `${g.region.name} (${g.region.countryCode})`)
      }
    }
    return [...map.entries()].map(([slug, label]) => ({ slug, label }))
  }, [serverGroups])

  const filteredGroups = useMemo(() => {
    return serverGroups.filter((g) => {
      if (regionFilter !== "all" && g.region?.slug !== regionFilter) {
        return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        g.serverName.toLowerCase().includes(q) ||
        (g.hostname && g.hostname.toLowerCase().includes(q)) ||
        (g.ipAddress && g.ipAddress.toLowerCase().includes(q)) ||
        (g.region?.name && g.region.name.toLowerCase().includes(q))
      )
    })
  }, [serverGroups, search, regionFilter])

  const showFilterControls = serverGroups.length > 3

  return (
    <div className="space-y-3">
      {showFilterControls && (
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder={t.searchServersPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs text-xs"
          />
          {regionOptions.length > 1 && (
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:ring-1 focus:ring-ring focus:outline-none"
              aria-label={t.filterByRegion}
            >
              <option value="all">
                {t.allRegionsCount} ({serverGroups.length})
              </option>
              {regionOptions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          {t.noServersMatchFilter}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => {
            const allActive = group.accounts.every(
              (a: VpnServerAccount) => a.provisioningStatus === "ACTIVE"
            )
            const anyFailed = group.accounts.some(
              (a: VpnServerAccount) => a.provisioningStatus === "FAILED"
            )

            return (
              <Card
                key={group.serverId}
                className="flex flex-col justify-between overflow-hidden"
              >
                <CardHeader className="p-3.5 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm leading-tight font-semibold">
                          {group.serverName}
                        </span>
                        <RegionBadge
                          region={group.region}
                          fallbackLabel={t.region}
                        />
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {group.hostname || group.ipAddress || "—"}
                      </p>
                    </div>
                    {anyFailed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        {t.error}
                      </span>
                    ) : allActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {t.ready}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {t.provisioning}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-1.5 p-3.5 pt-0">
                  {group.accounts.map((account: VpnServerAccount) => (
                    <ProtocolControl
                      key={account.id}
                      subscriptionId={subscription.id}
                      account={account}
                      subStatus={subscription.status}
                      locale={locale}
                    />
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function VpnMyServices({
  subscriptions,
  onChanged,
  locale = "en",
}: Props) {
  const messages = useMemo(
    () => getMessages(resolveLocaleOrDefault(locale)),
    [locale]
  )
  const t = messages.console.vpn.myServices
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [confirmCancelTexts, setConfirmCancelTexts] = useState<
    Record<string, string>
  >({})
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({})
  const [reinstating, setReinstating] = useState<string | null>(null)
  const [reinstateDialogId, setReinstateDialogId] = useState<string | null>(
    null
  )
  const [reinstateReasons, setReinstateReasons] = useState<
    Record<string, string>
  >({})
  const [devicesBySub, setDevicesBySub] = useState<
    Record<
      string,
      Array<{ deviceName: string; platform: string; status: string }>
    >
  >({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [pairingSubId, setPairingSubId] = useState<string | null>(null)
  const [pairingQrConfigUrl, setPairingQrConfigUrl] = useState<string | null>(
    null
  )

  // ponytail: inline async, no useCallback wrapper to appease the lint rule
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const { listMobileDevices } = await import("@/lib/vpn-mobile-client")
        const devices = await listMobileDevices()
        if (cancelled) return
        const grouped: Record<
          string,
          Array<{ deviceName: string; platform: string; status: string }>
        > = {}
        for (const d of devices) {
          if (!grouped[d.subscriptionId]) grouped[d.subscriptionId] = []
          grouped[d.subscriptionId].push(d)
        }
        setDevicesBySub(grouped)
      } catch {
        // Device data is supplementary.
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const regionOptions = useMemo(() => {
    const regions = new Map<string, string>()
    for (const sub of subscriptions) {
      for (const account of sub.serverAccounts) {
        if (account.region) {
          regions.set(
            account.region.slug,
            `${account.region.name} (${account.region.countryCode})`
          )
        }
      }
    }
    return [...regions.entries()]
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [subscriptions])

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      await cancelVpnSubscription(id, cancelReasons[id] ?? "")
      setConfirmCancelId(null)
      setConfirmCancelTexts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setCancelReasons((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      onChanged()
    } catch (err) {
      // Keep dialog open so user can retry
      console.error("[VPN] cancel failed:", err)
      toast.error(t.failedToCancel)
    } finally {
      setCancelling(null)
    }
  }

  const handleReinstate = async (id: string) => {
    setReinstating(id)
    try {
      await reinstateVpnSubscription(id, reinstateReasons[id] ?? "")
      setReinstateDialogId(null)
      setReinstateReasons((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      onChanged()
    } catch (err) {
      // Keep dialog open so user can retry
      console.error("[VPN] reinstate failed:", err)
      toast.error(t.failedToReinstate)
    } finally {
      setReinstating(null)
    }
  }

  const columns = useMemo<ColumnDef<VpnSubscription, unknown>[]>(
    () => [
      {
        accessorKey: "packageName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.connectionProfile} />
        ),
        cell: ({ row }) => {
          const sub = row.original
          const displayId =
            sub.id.length > 24 ? `${sub.id.slice(0, 24)}…` : sub.id
          return (
            <div className="space-y-1">
              <Link
                href={`/console/vpn/subscriptions/${sub.id}`}
                className="font-semibold text-foreground hover:underline"
              >
                {sub.packageName}
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono" title={sub.id}>
                  {displayId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    void copySubscriptionId(sub.id, {
                      copied: t.copied,
                      failedToCopyManual: t.failedToCopyManual,
                    })
                  }
                  aria-label={t.copySubscriptionId}
                >
                  <CopySimpleIcon className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )
        },
      },
      {
        id: "status",
        accessorFn: (sub) => billingStatus(sub),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.status} />
        ),
        filterFn: (row, _columnId, value) => {
          if (value === "ALL") return true
          const status = billingStatus(row.original)
          return status === value
        },
        cell: ({ row }) => (
          <SubscriptionStatusBadge sub={row.original} locale={locale} />
        ),
      },
      {
        id: "servers",
        accessorFn: subscriptionSearchText,
        header: t.locationCoverage,
        filterFn: (row, _columnId, value) =>
          regionFilterValue(row.original).split("|").includes(String(value)),
        cell: ({ row }) => (
          <ConnectionSummaryCell sub={row.original} locale={locale} />
        ),
      },
      {
        id: "devices",
        accessorFn: (sub) => devicesBySub[sub.id]?.length ?? 0,
        header: t.devices,
        cell: ({ row }) => (
          <DeviceSummaryCell
            sub={row.original}
            devices={devicesBySub[row.original.id] ?? []}
            locale={locale}
          />
        ),
      },
      {
        id: "quickActions",
        header: () => <div className="text-right">{t.setupAndConnect}</div>,
        cell: ({ row }) => {
          const sub = row.original
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <DownloadIcon className="h-4 w-4 text-primary" />
                    <span>{t.getConfig}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="max-h-80 w-64 space-y-2 overflow-y-auto p-1.5"
                >
                  {groupByServer(sub.serverAccounts).map((group, idx) => (
                    <div
                      key={group.serverId}
                      className={idx > 0 ? "border-t pt-1.5" : ""}
                    >
                      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-foreground">
                        <span>{group.serverName}</span>
                        <RegionBadge
                          region={group.region}
                          fallbackLabel={t.region}
                        />
                      </div>
                      <div className="space-y-0.5">
                        {group.accounts.map((account: VpnServerAccount) => {
                          const isWireGuard = account.protocol === "WIREGUARD"
                          const isProxy = account.protocol === "PROXY"
                          const downloadUrl = vpnConfigDownloadUrl(
                            sub.id,
                            account.id
                          )

                          if (isProxy) {
                            return (
                              <ProxyCredentialCell
                                key={account.id}
                                subscriptionId={sub.id}
                                account={account}
                                locale={locale}
                              />
                            )
                          }

                          return (
                            <div
                              key={account.id}
                              className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-muted/50"
                            >
                              <span className="font-medium text-muted-foreground">
                                {isWireGuard ? "WireGuard" : "OpenVPN"}
                              </span>
                              <div className="flex items-center gap-1">
                                {isWireGuard && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-xs"
                                    onClick={() =>
                                      setPairingQrConfigUrl(downloadUrl)
                                    }
                                  >
                                    {t.qr}
                                  </Button>
                                )}
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-xs font-medium text-primary"
                                >
                                  <a href={downloadUrl} download>
                                    {t.download}
                                  </a>
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const sub = row.original
          const subDevices = devicesBySub[sub.id] ?? []
          const maxDevices =
            sub.serverAccounts.filter(
              (account) => account.provisioningStatus === "ACTIVE"
            ).length * 2

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={t.actions}>
                    <DotsThreeVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/console/vpn/subscriptions/${sub.id}`}>
                      {t.viewDetails}
                    </Link>
                  </DropdownMenuItem>
                  {sub.status === "ACTIVE" && (
                    <DropdownMenuItem
                      disabled={subDevices.length >= maxDevices}
                      onClick={() => setPairingSubId(sub.id)}
                    >
                      {t.pairDevice}
                    </DropdownMenuItem>
                  )}
                  {sub.cancelAtPeriodEnd && sub.status === "ACTIVE" ? (
                    <DropdownMenuItem
                      disabled={reinstating === sub.id}
                      onClick={() => {
                        setReinstateDialogId(sub.id)
                        setReinstateReasons((prev) => ({
                          ...prev,
                          [sub.id]: "",
                        }))
                      }}
                    >
                      {reinstating === sub.id ? t.reinstating : t.reinstate}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={
                        cancelling === sub.id || sub.status !== "ACTIVE"
                      }
                      onClick={() => {
                        setConfirmCancelId(sub.id)
                        setConfirmCancelTexts((prev) => ({
                          ...prev,
                          [sub.id]: "",
                        }))
                        setCancelReasons((prev) => ({
                          ...prev,
                          [sub.id]: "",
                        }))
                      }}
                    >
                      {cancelling === sub.id ? t.cancelling : t.cancel}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [devicesBySub, cancelling, reinstating, locale, t]
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild size="sm">
            <Link href="/console/billing/services/vpn">{t.orderPlan}</Link>
          </Button>
          {subscriptions.length === 1 ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/vpn/subscriptions/${subscriptions[0].id}/download-all`}
                download
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                {t.downloadAllZip}
              </a>
            </Button>
          ) : subscriptions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  {t.downloadAllZip}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {subscriptions.map((sub) => (
                  <DropdownMenuItem key={sub.id} asChild>
                    <a
                      href={`/api/vpn/subscriptions/${sub.id}/download-all`}
                      download
                    >
                      {sub.packageName}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <DataTable
          tableId="console-vpn-subscriptions"
          columns={columns}
          data={subscriptions}
          defaultColumnVisibility={{}}
          searchPlaceholder={t.searchSubscriptionsPlaceholder}
          searchableColumns={["packageName", "servers"]}
          facetFilters={[
            {
              columnId: "status",
              label: t.status,
              allLabel: t.allStatuses,
              options: [
                { label: t.activeStatus, value: "ACTIVE" },
                { label: t.cancellingStatus, value: "CANCELLING" },
                { label: t.suspendedStatus, value: "SUSPENDED" },
                { label: t.expiredStatus, value: "EXPIRED" },
              ],
            },
            {
              columnId: "servers",
              label: t.region,
              allLabel: t.allRegions,
              options: regionOptions,
            },
          ]}
          emptyMessage={t.emptySubscriptions}
        />
      </div>

      {/* Pair modal */}
      <VpnPairingQrModal
        open={pairingSubId !== null}
        onOpenChange={(open) => {
          if (!open) setPairingSubId(null)
        }}
        subscriptionId={pairingSubId ?? ""}
        onPaired={() => {
          setPairingSubId(null)
          setRefreshKey((k) => k + 1)
        }}
      />

      {/* Cancel confirmation dialog */}
      {confirmCancelId &&
        (() => {
          const sub = subscriptions.find((s) => s.id === confirmCancelId)
          if (!sub) return null
          const isProcessing = cancelling === confirmCancelId
          const confirmed =
            (confirmCancelTexts[confirmCancelId] ?? "") === "CANCEL"

          return (
            <Dialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  const id = confirmCancelId
                  setConfirmCancelId(null)
                  setConfirmCancelTexts((prev) => {
                    const next = { ...prev }
                    if (id) delete next[id]
                    return next
                  })
                  setCancelReasons((prev) => {
                    const next = { ...prev }
                    if (id) delete next[id]
                    return next
                  })
                }
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t.cancelDialogTitle}</DialogTitle>
                  <DialogDescription className="space-y-3 pt-2">
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                      <p>
                        {t.cancelDialogAbout} <strong>{sub.packageName}</strong>
                        .
                      </p>
                      <p className="mt-1">
                        {t.cancelDialogServiceUntil}{" "}
                        <strong>
                          {formatDate(sub.currentPeriodEnd, locale)}
                        </strong>
                        {t.cancelDialogServiceUntilSuffix}
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.cancelDialogReasonLabel}
                    </label>
                    <Textarea
                      value={cancelReasons[confirmCancelId] ?? ""}
                      onChange={(e) =>
                        setCancelReasons((prev) => ({
                          ...prev,
                          [confirmCancelId]: e.target.value,
                        }))
                      }
                      placeholder={t.cancelDialogReasonPlaceholder}
                      rows={2}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.cancelDialogType}{" "}
                      <span className="font-bold text-destructive">CANCEL</span>{" "}
                      {t.cancelDialogToConfirm}
                    </label>
                    <Input
                      value={confirmCancelTexts[confirmCancelId] ?? ""}
                      onChange={(e) =>
                        setConfirmCancelTexts((prev) => ({
                          ...prev,
                          [confirmCancelId]: e.target.value,
                        }))
                      }
                      placeholder={t.cancelDialogConfirmPlaceholder}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const id = confirmCancelId
                      setConfirmCancelId(null)
                      setConfirmCancelTexts((prev) => {
                        const next = { ...prev }
                        if (id) delete next[id]
                        return next
                      })
                      setCancelReasons((prev) => {
                        const next = { ...prev }
                        if (id) delete next[id]
                        return next
                      })
                    }}
                    disabled={isProcessing}
                  >
                    {t.keepSubscription}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!confirmed || isProcessing}
                    onClick={async () => {
                      await handleCancel(confirmCancelId)
                    }}
                  >
                    {isProcessing ? t.cancelling : t.confirmCancelButton}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        })()}

      {/* Reinstate confirmation dialog */}
      {reinstateDialogId &&
        (() => {
          const sub = subscriptions.find((s) => s.id === reinstateDialogId)
          if (!sub) return null
          const isProcessing = reinstating === reinstateDialogId
          const hasReason =
            (reinstateReasons[reinstateDialogId] ?? "").trim().length > 0

          return (
            <Dialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  const id = reinstateDialogId
                  setReinstateDialogId(null)
                  setReinstateReasons((prev) => {
                    const next = { ...prev }
                    if (id) delete next[id]
                    return next
                  })
                }
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t.reinstateDialogTitle}</DialogTitle>
                  <DialogDescription className="space-y-3 pt-2">
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p>
                        {t.reinstateDialogAbout}{" "}
                        <strong>{sub.packageName}</strong>.
                      </p>
                      <p className="mt-1">
                        {t.reinstateDialogBillingResume}{" "}
                        <strong>
                          {formatDate(sub.currentPeriodEnd, locale)}
                        </strong>
                        {t.reinstateDialogBillingResumeSuffix}
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.reinstateDialogReasonLabel}
                  </label>
                  <Textarea
                    value={reinstateReasons[reinstateDialogId] ?? ""}
                    onChange={(e) =>
                      setReinstateReasons((prev) => ({
                        ...prev,
                        [reinstateDialogId]: e.target.value,
                      }))
                    }
                    placeholder={t.reinstateDialogReasonPlaceholder}
                    rows={3}
                    autoFocus
                  />
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const id = reinstateDialogId
                      setReinstateDialogId(null)
                      setReinstateReasons((prev) => {
                        const next = { ...prev }
                        if (id) delete next[id]
                        return next
                      })
                    }}
                    disabled={isProcessing}
                  >
                    {t.goBack}
                  </Button>
                  <Button
                    disabled={!hasReason || isProcessing}
                    onClick={async () => {
                      await handleReinstate(reinstateDialogId)
                    }}
                  >
                    {isProcessing ? t.reinstating : t.confirmReinstateButton}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        })()}
      {pairingQrConfigUrl && (
        <WireGuardConfigQrModal
          configUrl={pairingQrConfigUrl}
          onClose={() => setPairingQrConfigUrl(null)}
          locale={locale}
        />
      )}
    </>
  )
}
