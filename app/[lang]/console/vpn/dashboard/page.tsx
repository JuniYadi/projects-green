"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useParams } from "next/navigation"
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  DeviceMobileIcon,
  GaugeIcon,
  MapPinIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  listMobileDevices,
  type MobileDeviceEntry,
} from "@/lib/vpn-mobile-client"
import { listVpnSubscriptions, type VpnSubscription } from "@/lib/vpn-client"

type PageState =
  | { phase: "loading" }
  | {
      phase: "ready"
      devices: MobileDeviceEntry[]
      subscriptions: VpnSubscription[]
    }

type RegionCoverage = {
  key: string
  name: string
  active: number
  pending: number
  failed: number
  protocols: Set<string>
}

type VpnOverview = {
  activeSubscriptions: number
  cancellingSubscriptions: number
  activeAccounts: number
  totalAccounts: number
  pendingAccounts: number
  failedAccounts: number
  revokedAccounts: number
  activeDevices: number
  revokedDevices: number
  nextRenewal: {
    date: string
    packageName: string
  } | null
  regions: RegionCoverage[]
  protocols: string[]
}

type DashboardAction = {
  label: string
  description: string
  href: string
  icon: React.ReactNode
  tone: string
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function protocolLabel(protocol: string): string {
  if (protocol === "OPENVPN") return "OpenVPN"
  if (protocol === "WIREGUARD") return "WireGuard"
  if (protocol === "PROXY") return "Proxy"
  return protocol
}

function buildOverview(
  subscriptions: VpnSubscription[],
  devices: MobileDeviceEntry[]
): VpnOverview {
  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === "ACTIVE"
  )
  const allAccounts = subscriptions.flatMap((sub) => sub.serverAccounts)
  const regionMap = new Map<string, RegionCoverage>()
  const protocolSet = new Set<string>()

  for (const account of allAccounts) {
    protocolSet.add(protocolLabel(account.protocol))

    const regionKey =
      account.region?.slug ?? account.region?.name ?? account.hostname
    const regionName = account.region?.name ?? "Unknown region"
    let region = regionMap.get(regionKey)
    if (!region) {
      region = {
        key: regionKey,
        name: regionName,
        active: 0,
        pending: 0,
        failed: 0,
        protocols: new Set<string>(),
      }
      regionMap.set(regionKey, region)
    }

    region.protocols.add(protocolLabel(account.protocol))
    if (account.provisioningStatus === "ACTIVE") region.active += 1
    if (
      account.provisioningStatus === "PENDING" ||
      account.provisioningStatus === "PROVISIONING"
    ) {
      region.pending += 1
    }
    if (account.provisioningStatus === "FAILED") region.failed += 1
  }

  const nextRenewal =
    activeSubscriptions
      .filter((sub) => !sub.cancelAtPeriodEnd)
      .map((sub) => ({
        date: sub.currentPeriodEnd,
        packageName: sub.packageName,
      }))
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0] ?? null

  return {
    activeSubscriptions: activeSubscriptions.length,
    cancellingSubscriptions: subscriptions.filter(
      (sub) => sub.cancelAtPeriodEnd
    ).length,
    activeAccounts: allAccounts.filter(
      (account) => account.provisioningStatus === "ACTIVE"
    ).length,
    totalAccounts: allAccounts.length,
    pendingAccounts: allAccounts.filter((account) =>
      ["PENDING", "PROVISIONING"].includes(account.provisioningStatus)
    ).length,
    failedAccounts: allAccounts.filter(
      (account) => account.provisioningStatus === "FAILED"
    ).length,
    revokedAccounts: allAccounts.filter(
      (account) => account.provisioningStatus === "REVOKED"
    ).length,
    activeDevices: devices.filter((device) => device.status === "ACTIVE")
      .length,
    revokedDevices: devices.filter((device) => device.status === "REVOKED")
      .length,
    nextRenewal,
    regions: [...regionMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    protocols: [...protocolSet].sort(),
  }
}

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode
  label: string
  value: string
  description: string
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-normal">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

function ReadinessRow({
  label,
  value,
  total,
  tone = "default",
}: {
  label: string
  value: number
  total: number
  tone?: "default" | "warning" | "danger" | "muted"
}) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0
  const barClass =
    tone === "danger"
      ? "bg-destructive"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "muted"
          ? "bg-muted-foreground"
          : "bg-primary"

  return (
    <div className="grid gap-2 sm:grid-cols-[120px_1fr_40px] sm:items-center">
      <div className="text-xs font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${barClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="text-sm font-medium sm:text-right">{value}</div>
    </div>
  )
}

function NextActions({
  overview,
  subscriptionsUrl,
  devicesUrl,
  packagesUrl,
}: {
  overview: VpnOverview
  subscriptionsUrl: string
  devicesUrl: string
  packagesUrl: string
}) {
  const actions: DashboardAction[] = []

  if (overview.activeSubscriptions === 0) {
    actions.push({
      label: "Choose a VPN package",
      description: "Provision your first VPN locations and protocols.",
      href: packagesUrl,
      icon: <ShieldCheckIcon className="h-4 w-4" />,
      tone: "text-primary",
    })
  }

  if (overview.failedAccounts > 0) {
    actions.push({
      label: `${overview.failedAccounts} VPN account failed`,
      description: "Review failed provisioning and retry from subscriptions.",
      href: subscriptionsUrl,
      icon: <WarningCircleIcon className="h-4 w-4" />,
      tone: "text-destructive",
    })
  }

  if (overview.pendingAccounts > 0) {
    actions.push({
      label: `${overview.pendingAccounts} VPN account provisioning`,
      description: "Check setup progress and available configs.",
      href: subscriptionsUrl,
      icon: <GaugeIcon className="h-4 w-4" />,
      tone: "text-amber-600 dark:text-amber-400",
    })
  }

  if (overview.activeSubscriptions > 0 && overview.activeDevices === 0) {
    actions.push({
      label: "Pair your first device",
      description: "Connect mobile devices to your active VPN service.",
      href: devicesUrl,
      icon: <DeviceMobileIcon className="h-4 w-4" />,
      tone: "text-primary",
    })
  }

  if (overview.cancellingSubscriptions > 0) {
    actions.push({
      label: `${overview.cancellingSubscriptions} plan cancelling`,
      description: "Review renewal status before the period ends.",
      href: subscriptionsUrl,
      icon: <CalendarIcon className="h-4 w-4" />,
      tone: "text-amber-600 dark:text-amber-400",
    })
  }

  if (actions.length === 0) {
    actions.push({
      label: "VPN service is ready",
      description: "All current server accounts are available.",
      href: subscriptionsUrl,
      icon: <CheckCircleIcon className="h-4 w-4" />,
      tone: "text-emerald-600 dark:text-emerald-400",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next Best Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.slice(0, 4).map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
          >
            <span className={`mt-0.5 ${action.tone}`}>{action.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{action.label}</span>
              <span className="block text-sm text-muted-foreground">
                {action.description}
              </span>
            </span>
            <ArrowRightIcon className="mt-1 h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

export default function ConsoleVpnDashboardPage() {
  const [state, setState] = useState<PageState>({ phase: "loading" })
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const subscriptionsUrl = localizePathname({
    pathname: "/console/vpn/subscriptions",
    locale,
  })
  const devicesUrl = localizePathname({
    pathname: "/console/vpn/devices",
    locale,
  })
  const orderUrl = localizePathname({
    pathname: "/console/vpn/order",
    locale,
  })

  const load = useCallback(async () => {
    const [subscriptionResult, deviceResult] = await Promise.allSettled([
      listVpnSubscriptions(),
      listMobileDevices(),
    ])

    setState({
      phase: "ready",
      subscriptions:
        subscriptionResult.status === "fulfilled"
          ? subscriptionResult.value
          : [],
      devices: deviceResult.status === "fulfilled" ? deviceResult.value : [],
    })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const overview = useMemo(() => {
    if (state.phase === "loading") return null
    return buildOverview(state.subscriptions, state.devices)
  }, [state])

  if (state.phase === "loading" || !overview) {
    return (
      <>
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </header>
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </>
    )
  }

  const hasSubscriptions = overview.activeSubscriptions > 0

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">VPN Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor VPN service health, devices, coverage, and next actions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          Refresh
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<ShieldCheckIcon className="h-5 w-5" />}
          label="Active Plans"
          value={String(overview.activeSubscriptions)}
          description={`${overview.cancellingSubscriptions} cancelling`}
        />
        <MetricCard
          icon={<GaugeIcon className="h-5 w-5" />}
          label="Ready Accounts"
          value={`${overview.activeAccounts} / ${overview.totalAccounts}`}
          description={`${overview.pendingAccounts} provisioning`}
        />
        <MetricCard
          icon={<DeviceMobileIcon className="h-5 w-5" />}
          label="Paired Devices"
          value={String(overview.activeDevices)}
          description={`${overview.revokedDevices} revoked`}
        />
        <MetricCard
          icon={<CalendarIcon className="h-5 w-5" />}
          label="Next Renewal"
          value={
            overview.nextRenewal ? formatDate(overview.nextRenewal.date) : "-"
          }
          description={overview.nextRenewal?.packageName ?? "No active renewal"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Service Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <ReadinessRow
                label="Active"
                value={overview.activeAccounts}
                total={overview.totalAccounts}
              />
              <ReadinessRow
                label="Provisioning"
                value={overview.pendingAccounts}
                total={overview.totalAccounts}
                tone="warning"
              />
              <ReadinessRow
                label="Failed"
                value={overview.failedAccounts}
                total={overview.totalAccounts}
                tone="danger"
              />
              <ReadinessRow
                label="Revoked"
                value={overview.revokedAccounts}
                total={overview.totalAccounts}
                tone="muted"
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              {overview.protocols.length > 0 ? (
                overview.protocols.map((protocol) => (
                  <Badge key={protocol} variant="secondary">
                    {protocol}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Buy a VPN package to enable protocols.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <NextActions
          overview={overview}
          subscriptionsUrl={subscriptionsUrl}
          devicesUrl={devicesUrl}
          packagesUrl={orderUrl}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-medium">Region Coverage</h2>
            <p className="text-sm text-muted-foreground">
              Coverage grouped by location and available protocol.
            </p>
          </div>
          {hasSubscriptions && (
            <Button asChild variant="outline" size="sm">
              <Link href={subscriptionsUrl}>View Details</Link>
            </Button>
          )}
        </div>

        {overview.regions.length > 0 ? (
          <div className="grid gap-3">
            {overview.regions.map((region) => (
              <Card key={region.key} size="sm">
                <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{region.name}</span>
                      {region.failed > 0 ? (
                        <Badge variant="destructive">Needs attention</Badge>
                      ) : region.pending > 0 ? (
                        <Badge variant="secondary">Provisioning</Badge>
                      ) : (
                        <Badge variant="default">Ready</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {region.active} ready
                      {region.pending > 0 && ` / ${region.pending} setup`}
                      {region.failed > 0 && ` / ${region.failed} failed`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 md:justify-end">
                    {[...region.protocols].sort().map((protocol) => (
                      <Badge key={protocol} variant="outline">
                        {protocol}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No VPN coverage yet. Choose a package to provision your first VPN
              locations.
            </p>
          </div>
        )}
      </section>
    </>
  )
}
