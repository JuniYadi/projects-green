"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
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
    protocol === "OPENVPN" ? "OVPN" : protocol === "WIREGUARD" ? "WG" : "Proxy"
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
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ProtocolIcon protocol={account.protocol} />
        {account.port != null && (
          <span className="font-mono text-xs text-muted-foreground">
            :{account.port}
          </span>
        )}
        <ConfigCell
          subscriptionId={subscriptionId}
          account={account}
          subStatus={subStatus}
        />
        <Badge
          variant={PROVISIONING_VARIANT[account.provisioningStatus]}
          className="ml-auto"
        >
          {account.provisioningStatus}
        </Badge>
      </div>
      {account.provisioningStatus === "FAILED" && account.failureReason && (
        <p className="mt-1 text-xs text-destructive">{account.failureReason}</p>
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
    >
      {status === "CANCELLING" ? "Cancelling" : sub.status}
    </Badge>
  )
}

function ServerSummaryCell({
  sub,
  devices,
}: {
  sub: VpnSubscription
  devices: Array<{ deviceName: string; platform: string; status: string }>
}) {
  const groups = groupByServer(sub.serverAccounts)
  const maxDevices =
    sub.serverAccounts.filter(
      (account) => account.provisioningStatus === "ACTIVE"
    ).length * 2

  return (
    <div className="min-w-[220px] space-y-1">
      <div className="text-sm font-medium">
        {groups.length} servers · {sub.serverAccounts.length} accounts
      </div>
      <div className="text-xs text-muted-foreground">
        Devices {devices.length}/{maxDevices}
      </div>
      <RegionSummary sub={sub} />
    </div>
  )
}

export function VpnServerAccountsDetail({
  subscription,
}: {
  subscription: VpnSubscription
}) {
  return (
    <div className="space-y-2">
      {groupByServer(subscription.serverAccounts).map((group) => (
        <div
          key={group.serverId}
          className="grid gap-3 rounded-lg border px-3 py-2.5 lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-center"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{group.serverName}</span>
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
                subscriptionId={subscription.id}
                account={account}
                subStatus={subscription.status}
              />
            ))}
          </div>
        </div>
      ))}
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
          <DataTableColumnHeader column={column} title="Package" />
        ),
        cell: ({ row }) => {
          const sub = row.original
          const displayId =
            sub.id.length > 24 ? `${sub.id.slice(0, 24)}…` : sub.id

          return (
            <div className="min-w-[200px] space-y-1">
              <div className="font-medium">{sub.packageName}</div>
              <Button
                asChild
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
              >
                <Link href={`/console/vpn/subscriptions/${sub.id}`}>
                  View details
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs text-muted-foreground"
                  title={sub.id}
                >
                  {displayId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5"
                  onClick={() => void copySubscriptionId(sub.id)}
                  aria-label="Copy subscription ID"
                >
                  <CopySimpleIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        },
      },
      {
        id: "billingStatus",
        accessorFn: billingStatus,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <SubscriptionStatusBadge sub={row.original} />,
      },
      {
        id: "servers",
        accessorFn: subscriptionSearchText,
        header: "Service",
        filterFn: (row, _columnId, value) =>
          regionFilterValue(row.original).split("|").includes(String(value)),
        cell: ({ row }) => (
          <ServerSummaryCell
            sub={row.original}
            devices={devicesBySub[row.original.id] ?? []}
          />
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="First buy" />
        ),
        sortingFn: "datetime",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: "firstPayment",
        accessorFn: (sub) => sub.firstPayment?.amount ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="First payment" />
        ),
        cell: ({ row }) => {
          const payment = row.original.firstPayment
          if (!payment) return <span className="text-muted-foreground">—</span>
          return (
            <div className="space-y-1 text-sm">
              <div>
                {payment.amount} {payment.currency}
              </div>
              {payment.paidAt && (
                <div className="text-xs text-muted-foreground">
                  {formatDate(payment.paidAt)}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: "renewPrice",
        accessorFn: (sub) => `${sub.priceLocked} ${sub.currency}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Renew price" />
        ),
        cell: ({ row }) => subscriptionPriceLabel(row.original),
      },
      {
        accessorKey: "currentPeriodEnd",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Next payment" />
        ),
        sortingFn: "datetime",
        cell: ({ row }) => (
          <div className="space-y-1 text-sm">
            <div>{formatDate(row.original.currentPeriodEnd)}</div>
            {row.original.cancelAtPeriodEnd && (
              <div className="text-xs text-muted-foreground">
                Cancels after this date
              </div>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
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
      <DataTable
        tableId="console-vpn-subscriptions"
        columns={columns}
        data={subscriptions}
        defaultColumnVisibility={{}}
        searchPlaceholder="Search subscriptions..."
        searchableColumns={["packageName", "billingStatus", "servers"]}
        facetFilters={[
          {
            columnId: "billingStatus",
            label: "Status",
            allLabel: "All status",
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
    </>
  )
}
