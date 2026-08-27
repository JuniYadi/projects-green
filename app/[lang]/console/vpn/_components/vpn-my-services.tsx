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
import { toast } from "sonner"
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
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const STATUS_VARIANT: Record<
  VpnSubscription["status"],
  "default" | "secondary" | "destructive"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "destructive",
}

const PROVISIONING_VARIANT: Record<
  VpnServerAccount["provisioningStatus"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  PENDING: "secondary",
  PROVISIONING: "secondary",
  FAILED: "destructive",
  REVOKED: "outline",
}

function normalizeCountryCode(countryCode: string | undefined): string {
  return countryCode?.trim().toUpperCase() ?? ""
}

function flagEmoji(countryCode: string | undefined): string {
  const normalized = normalizeCountryCode(countryCode)
  if (!/^[A-Z]{2}$/.test(normalized)) return ""
  const a = 0x1f1e6 + normalized.charCodeAt(0) - 65
  const b = 0x1f1e6 + normalized.charCodeAt(1) - 65
  return String.fromCodePoint(a, b)
}

function RegionBadge({
  region,
}: {
  region: { name: string; slug: string; countryCode: string } | null
}) {
  if (!region) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <MapPinIcon className="h-3.5 w-3.5" />
        Region
      </Badge>
    )
  }

  const countryCode = normalizeCountryCode(region.countryCode)
  const flag = flagEmoji(countryCode)

  return (
    <Badge variant="outline" className="gap-1.5">
      <span aria-hidden>{flag}</span>
      <span>{countryCode || region.slug.toUpperCase()}</span>
      <span className="text-muted-foreground">{region.name}</span>
    </Badge>
  )
}

function ProxyCredentialCell({
  subscriptionId,
  account,
}: {
  subscriptionId: string
  account: VpnServerAccount
}) {
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
      toast.success("Proxy credentials copied")
    } catch {
      toast.error("Failed to copy proxy credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span>
        user: <span className="font-mono">{account.username}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="font-mono">
          pass: {revealed ? (password ?? "…") : "••••••••"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1"
          onClick={() => void toggle()}
          disabled={loading}
          aria-label={revealed ? "Hide password" : "Show password"}
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
          aria-label="Copy Proxy Credentials"
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
}: {
  subscriptionId: string
  accountId: string
}) {
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
        aria-label="WireGuard QR Code"
      >
        WireGuard QR Code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>WireGuard QR Code</DialogTitle>
            <DialogDescription>
              Scan this code with the WireGuard app to add the profile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-64 items-center justify-center">
            {loading ? (
              <span className="text-sm text-muted-foreground">
                Loading QR code…
              </span>
            ) : error ? (
              <span className="text-sm text-destructive">
                Unable to generate QR code.
              </span>
            ) : qrData ? (
              <img src={qrData} alt="WireGuard QR Code" />
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
}: {
  configUrl: string
  onClose: () => void
}) {
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
          <DialogTitle>WireGuard QR Code</DialogTitle>
          <DialogDescription>
            Scan this QR code with the WireGuard app on your phone to connect
            instantly.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-4">
          <div className="flex min-h-48 w-48 items-center justify-center rounded-lg border p-2">
            {loading ? (
              <span className="text-sm text-muted-foreground">
                Loading QR code…
              </span>
            ) : error ? (
              <span className="text-sm text-destructive">
                Unable to generate QR code.
              </span>
            ) : qrData ? (
              <img src={qrData} alt="WireGuard QR Code" className="h-48 w-48" />
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={configUrl} download>
              Download .conf File
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
}: {
  subscriptionId: string
  account: VpnServerAccount
  subStatus: VpnSubscription["status"]
}) {
  if (account.provisioningStatus === "REVOKED") {
    return <span className="text-xs text-muted-foreground">Revoked</span>
  }
  if (subStatus !== "ACTIVE") {
    return (
      <span className="text-xs text-muted-foreground">Renew to download</span>
    )
  }
  if (account.protocol === "PROXY") {
    return (
      <ProxyCredentialCell subscriptionId={subscriptionId} account={account} />
    )
  }
  if (!account.hasConfig) {
    return <span className="text-xs text-muted-foreground">Provisioning…</span>
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
        <a href={vpnConfigDownloadUrl(subscriptionId, account.id)} download>
          <DownloadIcon className="mr-1 h-3.5 w-3.5" />
          Download
        </a>
      </Button>
      {account.protocol === "WIREGUARD" && (
        <WireGuardQrAction
          subscriptionId={subscriptionId}
          accountId={account.id}
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
}: {
  subscriptionId: string
  account: VpnServerAccount
  subStatus: VpnSubscription["status"]
}) {
  const isFailed = account.provisioningStatus === "FAILED"

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
        />
        {isFailed && (
          <Badge variant="destructive" className="text-[10px]">
            Failed
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

async function copySubscriptionId(id: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(id)
    toast.success("Copied!")
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
      toast.success("Copied!")
    } catch {
      toast.error("Failed to copy — please copy manually")
    }
  }
}

function uniqueRegionNames(sub: VpnSubscription): string[] {
  return [
    ...new Set(
      sub.serverAccounts
        .map((account) => account.region?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ]
}

function RegionSummary({ sub }: { sub: VpnSubscription }) {
  const regions = uniqueRegionNames(sub)
  const visible = regions.slice(0, 2).join(", ") || "No regions"
  const more = regions.length > 2 ? ` +${regions.length - 2} more` : ""

  return (
    <p className="max-w-[220px] truncate text-xs text-muted-foreground">
      {visible}
      {more}
    </p>
  )
}

function SubscriptionStatusBadge({ sub }: { sub: VpnSubscription }) {
  const status = billingStatus(sub)

  return (
    <Badge
      variant={
        status === "CANCELLING" ? "secondary" : STATUS_VARIANT[sub.status]
      }
      className="text-xs font-medium uppercase"
    >
      {status === "CANCELLING" ? "Cancelling" : sub.status}
    </Badge>
  )
}

function ConnectionSummaryCell({ sub }: { sub: VpnSubscription }) {
  const groups = groupByServer(sub.serverAccounts)
  const visibleGroups = groups.slice(0, 2)
  const extraCount = groups.length - visibleGroups.length

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleGroups.map((group) => (
          <RegionBadge key={group.serverId} region={group.region} />
        ))}
        {extraCount > 0 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            +{extraCount} more
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
}: {
  sub: VpnSubscription
  devices: Array<{ deviceName: string; platform: string; status: string }>
}) {
  const maxDevices =
    sub.serverAccounts.filter(
      (account) => account.provisioningStatus === "ACTIVE"
    ).length * 2

  return (
    <span className="text-sm">
      {devices.length}/{maxDevices} devices
    </span>
  )
}

export function VpnServerAccountsDetail({
  subscription,
}: {
  subscription: VpnSubscription
}) {
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
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs text-xs"
          />
          {regionOptions.length > 1 && (
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:ring-1 focus:ring-ring focus:outline-none"
              aria-label="Filter by region"
            >
              <option value="all">All regions ({serverGroups.length})</option>
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
          No server locations match your filter.
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
                        <RegionBadge region={group.region} />
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {group.hostname || group.ipAddress || "—"}
                      </p>
                    </div>
                    {anyFailed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        Error
                      </span>
                    ) : allActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Provisioning
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

export function VpnMyServices({ subscriptions, onChanged }: Props) {
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
      toast.error("Failed to cancel subscription. Please try again.")
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
      toast.error("Failed to reinstate subscription. Please try again.")
    } finally {
      setReinstating(null)
    }
  }

  const columns = useMemo<ColumnDef<VpnSubscription, unknown>[]>(
    () => [
      {
        accessorKey: "packageName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Connection Profile" />
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
                  onClick={() => void copySubscriptionId(sub.id)}
                  aria-label="Copy subscription ID"
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
          <DataTableColumnHeader column={column} title="Status" />
        ),
        filterFn: (row, _columnId, value) => {
          if (value === "ALL") return true
          const status = billingStatus(row.original)
          return status === value
        },
        cell: ({ row }) => <SubscriptionStatusBadge sub={row.original} />,
      },
      {
        id: "servers",
        accessorFn: subscriptionSearchText,
        header: "Location Coverage",
        filterFn: (row, _columnId, value) =>
          regionFilterValue(row.original).split("|").includes(String(value)),
        cell: ({ row }) => <ConnectionSummaryCell sub={row.original} />,
      },
      {
        id: "devices",
        accessorFn: (sub) => devicesBySub[sub.id]?.length ?? 0,
        header: "Devices",
        cell: ({ row }) => (
          <DeviceSummaryCell
            sub={row.original}
            devices={devicesBySub[row.original.id] ?? []}
          />
        ),
      },
      {
        id: "quickActions",
        header: () => <div className="text-right">Setup & Connect</div>,
        cell: ({ row }) => {
          const sub = row.original
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <DownloadIcon className="h-4 w-4 text-primary" />
                    <span>Get Config</span>
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
                        <RegionBadge region={group.region} />
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
                                    QR
                                  </Button>
                                )}
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-xs font-medium text-primary"
                                >
                                  <a href={downloadUrl} download>
                                    Download
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
                  <Button variant="ghost" size="icon-sm" aria-label="Actions">
                    <DotsThreeVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/console/vpn/subscriptions/${sub.id}`}>
                      View details
                    </Link>
                  </DropdownMenuItem>
                  {sub.status === "ACTIVE" && (
                    <DropdownMenuItem
                      disabled={subDevices.length >= maxDevices}
                      onClick={() => setPairingSubId(sub.id)}
                    >
                      Pair device
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
                      {reinstating === sub.id ? "Reinstating…" : "Reinstate"}
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
                      {cancelling === sub.id ? "Cancelling…" : "Cancel"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [devicesBySub, cancelling, reinstating]
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          {subscriptions.length === 1 ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/vpn/subscriptions/${subscriptions[0].id}/download-all`}
                download
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                Download All ZIP
              </a>
            </Button>
          ) : subscriptions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download All ZIP
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
          searchPlaceholder="Search subscriptions..."
          searchableColumns={["packageName", "servers"]}
          facetFilters={[
            {
              columnId: "status",
              label: "Status",
              allLabel: "All statuses",
              options: [
                { label: "Active", value: "ACTIVE" },
                { label: "Cancelling", value: "CANCELLING" },
                { label: "Suspended", value: "SUSPENDED" },
                { label: "Expired", value: "EXPIRED" },
              ],
            },
            {
              columnId: "servers",
              label: "Region",
              allLabel: "All regions",
              options: regionOptions,
            },
          ]}
          emptyMessage="No VPN subscriptions found."
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
                  <DialogTitle>Cancel VPN Subscription</DialogTitle>
                  <DialogDescription className="space-y-3 pt-2">
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                      <p>
                        You are about to cancel{" "}
                        <strong>{sub.packageName}</strong>.
                      </p>
                      <p className="mt-1">
                        Your service will continue until{" "}
                        <strong>{formatDate(sub.currentPeriodEnd)}</strong>,
                        then expire. No further charges will be made after
                        cancellation.
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Why are you cancelling?
                    </label>
                    <Textarea
                      value={cancelReasons[confirmCancelId] ?? ""}
                      onChange={(e) =>
                        setCancelReasons((prev) => ({
                          ...prev,
                          [confirmCancelId]: e.target.value,
                        }))
                      }
                      placeholder="Tell us why you're cancelling..."
                      rows={2}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Type{" "}
                      <span className="font-bold text-destructive">CANCEL</span>{" "}
                      to confirm
                    </label>
                    <Input
                      value={confirmCancelTexts[confirmCancelId] ?? ""}
                      onChange={(e) =>
                        setConfirmCancelTexts((prev) => ({
                          ...prev,
                          [confirmCancelId]: e.target.value,
                        }))
                      }
                      placeholder='Type "CANCEL" to confirm'
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
                    Keep subscription
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!confirmed || isProcessing}
                    onClick={async () => {
                      await handleCancel(confirmCancelId)
                    }}
                  >
                    {isProcessing ? "Cancelling…" : "Yes, cancel subscription"}
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
                  <DialogTitle>Reinstate Subscription</DialogTitle>
                  <DialogDescription className="space-y-3 pt-2">
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p>
                        You are about to reinstate{" "}
                        <strong>{sub.packageName}</strong>.
                      </p>
                      <p className="mt-1">
                        Normal billing will resume after{" "}
                        <strong>{formatDate(sub.currentPeriodEnd)}</strong>, and
                        your subscription will continue as usual.
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Why did you decide to reinstate?
                  </label>
                  <Textarea
                    value={reinstateReasons[reinstateDialogId] ?? ""}
                    onChange={(e) =>
                      setReinstateReasons((prev) => ({
                        ...prev,
                        [reinstateDialogId]: e.target.value,
                      }))
                    }
                    placeholder="Tell us why you changed your mind..."
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
                    Go back
                  </Button>
                  <Button
                    disabled={!hasReason || isProcessing}
                    onClick={async () => {
                      await handleReinstate(reinstateDialogId)
                    }}
                  >
                    {isProcessing
                      ? "Reinstating…"
                      : "Yes, reinstate subscription"}
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
        />
      )}
    </>
  )
}
