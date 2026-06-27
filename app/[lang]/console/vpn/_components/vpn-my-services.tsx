"use client"

import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  DeviceMobileIcon,
  MapPinIcon,
  CopySimpleIcon,
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
      </span>
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
    return <span className="text-xs text-muted-foreground">Provisioning…</span>
  }
  return (
    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
      <a href={vpnConfigDownloadUrl(subscriptionId, account.id)}>
        <DownloadIcon className="mr-1 h-3.5 w-3.5" />
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
    <span className="inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
    </span>
  )
}

function ProtocolControl({
  subscriptionId,
  account,
}: {
  subscriptionId: string
  account: VpnServerAccount
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ProtocolIcon protocol={account.protocol} />
        {account.port != null && (
          <span className="font-mono text-xs text-muted-foreground">
            :{account.port}
          </span>
        )}
        <ConfigCell subscriptionId={subscriptionId} account={account} />
        <Badge
          variant={PROVISIONING_VARIANT[account.provisioningStatus]}
          className="ml-auto"
        >
          {account.provisioningStatus}
        </Badge>
      </div>
      {account.provisioningStatus === "FAILED" && account.failureReason && (
        <p className="mt-1 text-xs text-destructive">
          {account.failureReason}
        </p>
      )}
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

export function VpnMyServices({ subscriptions, onChanged }: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(
    null,
  )
  const [confirmCancelTexts, setConfirmCancelTexts] = useState<
    Record<string, string>
  >({})
  const [cancelReasons, setCancelReasons] = useState<
    Record<string, string>
  >({})
  const [reinstating, setReinstating] = useState<string | null>(null)
  const [reinstateDialogId, setReinstateDialogId] = useState<
    string | null
  >(null)
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
  }, [refreshKey])

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

  return (
    <>
      <div className="space-y-6">
        {subscriptions.map((sub) => {
          const groups = groupByServer(sub.serverAccounts)
          const subDevices = devicesBySub[sub.id] ?? []

          return (
            <Card key={sub.id} size="sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  {sub.packageName}
                  <Badge
                    variant={
                      sub.cancelAtPeriodEnd
                        ? "secondary"
                        : STATUS_VARIANT[sub.status]
                    }
                  >
                    {sub.cancelAtPeriodEnd ? "Cancelling" : sub.status}
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
              {sub.cancelAtPeriodEnd && sub.status === "ACTIVE" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-800/40"
                  onClick={() => {
                    setReinstateDialogId(sub.id)
                    setReinstateReasons((prev) => ({
                      ...prev,
                      [sub.id]: "",
                    }))
                  }}
                  disabled={reinstating === sub.id}
                >
                  {reinstating === sub.id
                    ? "Reinstating…"
                    : "Reinstate"}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
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
                  disabled={
                    cancelling === sub.id ||
                    sub.status !== "ACTIVE"
                  }
                >
                  {cancelling === sub.id
                    ? "Cancelling…"
                    : "Cancel"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* ponytail: subscription.id already on VpnSubscription type */}
              <div className="flex items-center gap-2">
                <Badge variant="outline">ID</Badge>
                <span className="font-mono text-xs text-muted-foreground" title={sub.id}>
                  {sub.id.length > 24 ? `${sub.id.slice(0, 24)}…` : sub.id}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sub.id)
                      toast.success("Copied!")
                    } catch {
                      try {
                        // ponytail: clipboard requires secure context
                        const el = document.createElement("textarea")
                        el.value = sub.id
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
                  }}
                  aria-label="Copy subscription ID"
                >
                  <CopySimpleIcon className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.serverId}
                    className="grid gap-3 rounded-lg border px-3 py-2.5 lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {group.serverName}
                        </span>
                        <RegionBadge region={group.region} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {group.hostname || "—"}
                        <span className="mx-1">·</span>
                        {group.ipAddress || "—"}
                      </p>
                    </div>

                    <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {group.accounts.map((account) => (
                        <ProtocolControl
                          key={account.id}
                          subscriptionId={sub.id}
                          account={account}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paired Devices section */}
              <div className="mt-4 rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Devices ({subDevices.length}/10)
                  </span>
                  {sub.status === "ACTIVE" && (
                    <span className="ml-auto">
                      <span
                        className="inline-block"
                        title={
                          subDevices.length >= 10
                            ? "Max devices reached"
                            : "Pair a new device"
                        }
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={subDevices.length >= 10}
                          onClick={() => setPairingSubId(sub.id)}
                        >
                          Pair New Device
                        </Button>
                      </span>
                    </span>
                  )}
                </div>
                {subDevices.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {sub.status === "ACTIVE"
                      ? "No devices paired yet."
                      : "Renew to pair devices."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          )
        })}
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
                      <strong>{formatDate(sub.currentPeriodEnd)}</strong>,
                      and your subscription will continue as usual.
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
    </>
  )
}
