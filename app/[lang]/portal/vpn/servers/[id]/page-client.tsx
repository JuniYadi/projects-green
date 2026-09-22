"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowClockwise,
  PencilSimpleIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CountryFlag } from "@/components/ui/country-flag"
import { Skeleton } from "@/components/ui/skeleton"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  getVpnServer,
  getVpnServerMetrics,
  listOpenVpnUsers,
  listWireGuardSessionsByServer,
  listVpnRegions,
  listVpnSshKeys,
  syncVpnServerProtocols,
  testVpnServer,
  type OpenVpnUserItem,
  type WireGuardSessionItem,
  type VpnRegionItem,
  type VpnServerItem,
  type VpnServerMetrics,
  type VpnServerProcessItem,
  type VpnServerTrafficPoint,
  type VpnSshKeyItem,
} from "../../_components/vpn-admin-client"
import { ServerForm } from "../../_components/server-form"

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function TrafficList({
  rows,
  messages,
}: {
  rows: VpnServerTrafficPoint[]
  messages?: ReturnType<typeof getMessages>["console"]["vpn"]["serverDetail"]
}) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {messages?.noVnstatData ?? "No vnStat data."}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rows
        .slice(-6)
        .reverse()
        .map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {row.label}
            </span>
            <span className="text-right font-medium">
              {formatBytes(row.total)}
              <span className="ml-2 text-xs text-muted-foreground">
                ↓ {formatBytes(row.rx)} ↑ {formatBytes(row.tx)}
              </span>
            </span>
          </div>
        ))}
    </div>
  )
}

function ProcessList({
  rows,
  metric,
  messages,
}: {
  rows: VpnServerProcessItem[]
  metric: "cpu" | "memory"
  messages?: ReturnType<typeof getMessages>["console"]["vpn"]["serverDetail"]
}) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {messages?.noProcessData ?? "No process data."}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rows.map((process) => (
        <div
          key={`${metric}:${process.pid}:${process.command}`}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="truncate font-mono text-xs">{process.command}</span>
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            pid {process.pid} · CPU {process.cpu}% · MEM {process.memory}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function VpnServerDetailPage() {
  const params = useParams()
  const locale = resolveLocaleOrDefault(params?.lang as string)
  const messages = getMessages(locale).console.vpn.serverDetail
  const serverId = params.id as string

  const [server, setServer] = useState<VpnServerItem | null>(null)
  const [users, setUsers] = useState<OpenVpnUserItem[]>([])
  const [metrics, setMetrics] = useState<VpnServerMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [healthChecking, setHealthChecking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<VpnRegionItem[]>([])
  const [sshKeys, setSshKeys] = useState<VpnSshKeyItem[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const wireGuardQuery = useQuery<WireGuardSessionItem[]>({
    queryKey: ["portal", "vpn", "wireguard-sessions", serverId],
    queryFn: async () => (await listWireGuardSessionsByServer(serverId)).data,
    enabled: Boolean(server?.protocols.wireGuard.enabled),
  })

  const loadServer = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getVpnServer(serverId)
      setServer(res.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [serverId])

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await getVpnServerMetrics(serverId)
      setMetrics(res.data)
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setMetricsLoading(false)
    }
  }, [serverId])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await listOpenVpnUsers(serverId)
      setUsers(res.data)
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setUsersLoading(false)
    }
  }, [serverId])

  const runHealthCheck = useCallback(async () => {
    setHealthChecking(true)
    try {
      await testVpnServer(serverId)
      await loadServer()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setHealthChecking(false)
    }
  }, [serverId, loadServer])

  const runSyncProtocols = useCallback(async () => {
    if (!window.confirm(messages.syncConfirmMsg)) return
    setSyncing(true)
    try {
      const res = await syncVpnServerProtocols(serverId)
      if (res.data.queued) {
        window.alert(messages.syncQueuedMsg)
      } else {
        window.alert(messages.syncInProgressMsg)
      }
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setSyncing(false)
    }
  }, [serverId, messages])

  useEffect(() => {
    // ponytail: voided async calls; setState fires after fetch resolves, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServer()
    void loadMetrics()
    void loadUsers()
  }, [loadServer, loadMetrics, loadUsers])

  useEffect(() => {
    async function loadRefs() {
      try {
        const [regionsRes, keysRes] = await Promise.all([
          listVpnRegions(),
          listVpnSshKeys(),
        ])
        setRegions(regionsRes.data)
        setSshKeys(keysRes.data)
      } catch {
        // Refs failure shows as empty selects in the form.
      }
    }
    void loadRefs()
  }, [])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/portal/vpn/servers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {messages.backToServers}
          </Link>
        </Button>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              {server
                ? `${server.name} (${server.ipAddress ?? server.hostname})`
                : "VPN Server"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {messages.pageDescription}
            </p>
          </div>
          {server && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(true)}
            >
              <PencilSimpleIcon className="mr-2 h-4 w-4" />
              {messages.editServer}
            </Button>
          )}
        </header>
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : server ? (
        <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-lg border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{server.name}</h2>
                  <Badge variant={server.isActive ? "default" : "secondary"}>
                    {server.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge
                    variant={
                      server.health === "HEALTHY"
                        ? "default"
                        : server.health === "DOWN"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {server.health}
                  </Badge>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CountryFlag
                    country={server.region.countryCode}
                    className="rounded-2xs inline-block h-3.5 w-5 shrink-0 object-cover shadow-2xs"
                  />
                  <span>
                    {server.region.countryCode.toUpperCase()} —{" "}
                    {server.region.name}
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runHealthCheck}
                disabled={healthChecking}
              >
                {healthChecking ? "Checking..." : "Run health check"}
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {messages.publicEndpointTitle}
                </div>
                <div className="mt-1 font-mono text-sm font-medium">
                  {server.hostname}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {server.ipAddress ?? "No IP address configured"}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {messages.sshAccessTitle}
                </div>
                <div className="mt-1 font-mono text-sm font-medium">
                  {server.sshUser}@{server.hostname}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {messages.portLabel} {server.sshPort}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-md bg-muted/40 p-3">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {messages.sshKeyLabel}
              </div>
              <div className="mt-1 text-sm font-medium">
                {server.sshKey.name}
              </div>
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {server.sshKey.fingerprint}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {messages.sshKeyNotice}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                {messages.protocolConfigTitle}
              </h2>
              <p className="text-sm text-muted-foreground">
                {messages.protocolConfigDesc}
              </p>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["OpenVPN", server.protocols.openVpn],
                ["WireGuard", server.protocols.wireGuard],
                ["Proxy", server.protocols.proxy],
              ].map(([label, protocol]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between rounded-md border bg-background p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{label as string}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {(protocol as { enabled: boolean; port: number | null })
                        .enabled
                        ? `${messages.port} ${(protocol as { port: number | null }).port ?? "—"}`
                        : messages.disabled}
                    </div>
                  </div>
                  <Badge
                    variant={
                      (protocol as { enabled: boolean }).enabled
                        ? "default"
                        : "secondary"
                    }
                  >
                    {(protocol as { enabled: boolean }).enabled
                      ? messages.enabled
                      : messages.disabled}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={runSyncProtocols}
                disabled={syncing}
              >
                <ArrowClockwise className="mr-2 h-4 w-4" />
                {syncing ? messages.syncing : messages.syncProtocols}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                {messages.provisionAccountsNotice}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {server && (
        <ServerForm
          key={server.id}
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={server}
          regions={regions}
          sshKeys={sshKeys}
          onSaved={loadServer}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {messages.liveMetricsTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {messages.liveMetricsDesc}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={metricsLoading}
          >
            <ArrowClockwise className="mr-2 h-4 w-4" />
            {metricsLoading ? "..." : messages.refresh}
          </Button>
        </div>

        {metricsLoading && !metrics ? (
          <Skeleton className="h-48 w-full" />
        ) : metrics ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                label={messages.uptime}
                value={metrics.uptime ?? "Unavailable"}
              />
              <MetricCard
                label="CPU"
                value={
                  metrics.resources.cpu.usedPercent === null
                    ? "Unavailable"
                    : `${metrics.resources.cpu.usedPercent.toFixed(1)}% / ${metrics.resources.cpu.totalCores ?? "?"} cores`
                }
                hint="usage / total"
              />
              <MetricCard
                label={messages.memory}
                value={
                  metrics.resources.memory.used === null ||
                  metrics.resources.memory.total === null
                    ? "Unavailable"
                    : `${formatBytes(metrics.resources.memory.used)} / ${formatBytes(metrics.resources.memory.total)}`
                }
                hint="usage / total"
              />
              <MetricCard
                label={messages.bandwidthMonth}
                value={formatBytes(metrics.resources.currentMonthBandwidth)}
                hint={messages.vnstatTotal}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  {messages.dailyTraffic}
                </h3>
                <TrafficList rows={metrics.traffic.daily} messages={messages} />
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  {messages.monthlyTraffic}
                </h3>
                <TrafficList
                  rows={metrics.traffic.monthly}
                  messages={messages}
                />
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  {messages.topCpuProcesses}
                </h3>
                <ProcessList
                  rows={metrics.processes.cpu}
                  metric="cpu"
                  messages={messages}
                />
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  {messages.topMemoryProcesses}
                </h3>
                <ProcessList
                  rows={metrics.processes.memory}
                  metric="memory"
                  messages={messages}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            {messages.metricsUnavailable}
          </div>
        )}
      </section>

      {server?.protocols.wireGuard.enabled && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {messages.wireguardSessionsTitle}
              </h2>
              <p className="text-sm text-muted-foreground">
                {messages.wireguardSessionsDesc}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => wireGuardQuery.refetch()}
              disabled={wireGuardQuery.isFetching}
            >
              <ArrowClockwise className="mr-2 h-4 w-4" />
              {wireGuardQuery.isFetching ? "..." : messages.refresh}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.thUsername}</TableHead>
                  <TableHead>{messages.thVpnIp}</TableHead>
                  <TableHead>{messages.thRealAddress}</TableHead>
                  <TableHead>{messages.wireguardStatus}</TableHead>
                  <TableHead>{messages.wireguardHandshake}</TableHead>
                  <TableHead>{messages.wireguardRx}</TableHead>
                  <TableHead>{messages.wireguardTx}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wireGuardQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : wireGuardQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-red-600">
                      {messages.metricsUnavailable}
                    </TableCell>
                  </TableRow>
                ) : wireGuardQuery.data?.length ? (
                  wireGuardQuery.data.map((session) => (
                    <TableRow key={`${session.serverId}:${session.username}`}>
                      <TableCell className="font-mono text-sm">
                        {session.username}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {session.ip}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {session.endpoint ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.status === "Online"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {session.handshake}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {session.rx}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {session.tx}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {messages.noWireguardSessions}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {messages.openvpnUsersTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {messages.openvpnUsersDesc}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={usersLoading}
          >
            <ArrowClockwise className="mr-2 h-4 w-4" />
            {usersLoading ? "..." : messages.refresh}
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.thUsername}</TableHead>
                <TableHead>{messages.thStatus}</TableHead>
                <TableHead>{messages.thConnection}</TableHead>
                <TableHead>{messages.thVpnIp}</TableHead>
                <TableHead>{messages.thRealAddress}</TableHead>
                <TableHead>{messages.thTraffic}</TableHead>
                <TableHead>{messages.thExpires}</TableHead>
                <TableHead>{messages.thIpAllocation}</TableHead>
                <TableHead>{messages.thSerial}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={`${user.status}:${user.clientName}`}>
                    <TableCell className="font-mono text-sm">
                      {user.clientName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === "ACTIVE"
                            ? "default"
                            : user.status === "REVOKED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.connected ? "default" : "secondary"}>
                        {user.connected ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.virtualAddress ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.realAddress ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.connected
                        ? `↓ ${formatBytes(user.bytesReceived ?? 0)} ↑ ${formatBytes(user.bytesSent ?? 0)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.expiresAt ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.ipAllocation ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                      {user.serial ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {messages.noUsersReturned}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  )
}
