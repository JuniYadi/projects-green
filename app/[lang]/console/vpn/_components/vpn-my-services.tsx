"use client"

import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  cancelVpnSubscription,
  getVpnProxyCredentials,
  vpnConfigDownloadUrl,
  type VpnServerAccount,
  type VpnSubscription,
} from "@/lib/vpn-client"
import {
  DownloadIcon,
  EyeIcon,
  EyeSlashIcon,
  DeviceMobileIcon,
} from "@phosphor-icons/react"

type Props = {
  subscriptions: VpnSubscription[]
  onChanged: () => void
}

function formatDate(value: string): string {
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

/** ponytail: inline helper, extracted only if a 2nd caller appears. */
function flagEmoji(countryCode: string | undefined): string {
  if (!countryCode || countryCode.length !== 2) return ""
  const a = 0x1f1e6 + countryCode.charCodeAt(0) - 65
  const b = 0x1f1e6 + countryCode.charCodeAt(1) - 65
  return String.fromCodePoint(a, b)
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

  const toggle = async () => {
    if (revealed) {
      setRevealed(false)
      return
    }
    if (password === null) {
      setLoading(true)
      try {
        const creds = await getVpnProxyCredentials(subscriptionId, account.id)
        setPassword(creds.password ?? "—")
      } catch {
        setPassword("—")
      } finally {
        setLoading(false)
      }
    }
    setRevealed(true)
  }

  return (
    <div className="space-y-1 text-sm">
      <p>
        user: <span className="font-mono">{account.username}</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="font-mono">
          pass: {revealed ? (password ?? "…") : "••••••••"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1"
          onClick={toggle}
          disabled={loading}
          aria-label={revealed ? "Hide password" : "Show password"}
        >
          {revealed ? (
            <EyeSlashIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function ConfigCell({
  subscriptionId,
  account,
}: {
  subscriptionId: string
  account: VpnServerAccount
}) {
  if (account.protocol === "PROXY") {
    return (
      <ProxyCredentialCell subscriptionId={subscriptionId} account={account} />
    )
  }
  const ext = account.protocol === "WIREGUARD" ? ".conf" : ".ovpn"
  if (!account.hasConfig) {
    return <span className="text-sm text-muted-foreground">Provisioning…</span>
  }
  return (
    <Button asChild size="sm" variant="outline">
      <a href={vpnConfigDownloadUrl(subscriptionId, account.id)}>
        <DownloadIcon className="mr-1 h-4 w-4" />
        {ext}
      </a>
    </Button>
  )
}

type ProtocolIconProps = {
  protocol: VpnServerAccount["protocol"]
}

function ProtocolIcon({ protocol }: ProtocolIconProps) {
  const label =
    protocol === "OPENVPN"
      ? "OVPN"
      : protocol === "WIREGUARD"
        ? "WG"
        : "Proxy"
  return (
    <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
      {label}
    </span>
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

export function VpnMyServices({ subscriptions, onChanged }: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [devicesBySub, setDevicesBySub] = useState<
    Record<
      string,
      Array<{ deviceName: string; platform: string; status: string }>
    >
  >({})

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
    return () => { cancelled = true }
  }, [])

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      await cancelVpnSubscription(id)
      onChanged()
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="space-y-6">
      {subscriptions.map((sub) => {
        const groups = groupByServer(sub.serverAccounts)
        const subDevices = devicesBySub[sub.id] ?? []

        return (
          <Card key={sub.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  {sub.packageName}
                  <Badge variant={STATUS_VARIANT[sub.status]}>
                    {sub.status}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Next bill: {formatDate(sub.currentPeriodEnd)}
                  {sub.originalPrice && (
                    <>
                      <span className="mx-1">·</span>
                      {sub.originalPrice} {sub.originalCurrency}
                      {sub.exchangeRate && sub.originalCurrency !== sub.currency && (
                        <span className="text-xs">
                          {" "}({sub.priceLocked} {sub.currency})
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancel(sub.id)}
                disabled={
                  cancelling === sub.id ||
                  sub.status !== "ACTIVE" ||
                  sub.cancelAtPeriodEnd
                }
              >
                {cancelling === sub.id
                  ? "Cancelling…"
                  : sub.cancelAtPeriodEnd
                    ? "Cancelled"
                    : "Cancel"}
              </Button>
            </CardHeader>
            <CardContent>
              {/* Server groups */}
              <div className="space-y-4">
                {groups.map((group) => (
                  <div
                    key={group.serverId}
                    className="rounded-lg border p-3"
                  >
                    {/* Server header */}
                    <div className="mb-2 flex items-center gap-2">
                      {group.region && (
                        <span className="text-lg leading-none" aria-hidden>
                          {flagEmoji(group.region.countryCode)}
                        </span>
                      )}
                      <span className="font-semibold">{group.serverName}</span>
                      {group.region && (
                        <span className="text-sm text-muted-foreground">
                          {group.region.name}
                        </span>
                      )}
                    </div>

                    {/* Hostname / IP */}
                    <p className="mb-2 text-sm text-muted-foreground">
                      {group.hostname || "—"}
                      <span className="mx-1">·</span>
                      {group.ipAddress || "—"}
                    </p>

                    {/* Protocol rows */}
                    <div className="space-y-2">
                      {group.accounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 p-2 sm:flex-nowrap sm:gap-3"
                        >
                          <ProtocolIcon protocol={account.protocol} />

                          {account.port != null && (
                            <span className="font-mono text-sm text-muted-foreground">
                              :{account.port}
                            </span>
                          )}

                          <div className="flex-1">
                            <ConfigCell
                              subscriptionId={sub.id}
                              account={account}
                            />
                          </div>

                          <div className="flex flex-col items-end gap-0.5">
                            <Badge
                              variant={
                                PROVISIONING_VARIANT[
                                  account.provisioningStatus
                                ]
                              }
                            >
                              {account.provisioningStatus}
                            </Badge>
                            {account.provisioningStatus === "FAILED" &&
                              account.failureReason && (
                                <span className="max-w-[200px] text-xs text-destructive">
                                  {account.failureReason}
                                </span>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paired Devices section */}
              {subDevices.length > 0 && (
                <div className="mt-4 rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Devices ({subDevices.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {subDevices.map((d, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        {d.deviceName}
                        <span className="mx-1">·</span>
                        {d.platform === "ios"
                          ? "iOS"
                          : d.platform === "android"
                            ? "Android"
                            : d.platform}
                        <span className="mx-1">·</span>
                        <span
                          className={
                            d.status === "ACTIVE"
                              ? "text-green-600"
                              : d.status === "REVOKED"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {d.status}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
