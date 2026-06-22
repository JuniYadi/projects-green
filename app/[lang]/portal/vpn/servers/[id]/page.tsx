"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ArrowClockwise } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  testVpnServer,
  type OpenVpnUserItem,
  type VpnServerItem,
  type VpnServerMetrics,
  type VpnServerProcessItem,
  type VpnServerTrafficPoint,
} from "../../_components/vpn-admin-client"

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
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

function TrafficList({ rows }: { rows: VpnServerTrafficPoint[] }) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground">No vnStat data.</div>
  }
  return (
    <div className="space-y-2">
      {rows.slice(-6).reverse().map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{row.label}</span>
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

function ProcessList({ rows, metric }: { rows: VpnServerProcessItem[]; metric: "cpu" | "memory" }) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground">No process data.</div>
  }
  return (
    <div className="space-y-2">
      {rows.map((process) => (
        <div key={`${metric}:${process.pid}:${process.command}`} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate font-mono text-xs">{process.command}</span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            pid {process.pid} · CPU {process.cpu}% · MEM {process.memory}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function VpnServerDetailPage() {
  const params = useParams()
  const serverId = params.id as string

  const [server, setServer] = useState<VpnServerItem | null>(null)
  const [users, setUsers] = useState<OpenVpnUserItem[]>([])
  const [metrics, setMetrics] = useState<VpnServerMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [healthChecking, setHealthChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    void loadServer()
    void loadMetrics()
    void loadUsers()
  }, [loadServer, loadMetrics, loadUsers])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/portal/vpn/servers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to servers
          </Link>
        </Button>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {server
              ? `${server.name} (${server.ipAddress ?? server.hostname})`
              : "VPN Server"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Realtime VPN server details, resource metrics, traffic usage, processes, and OpenVPN users.
          </p>
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
                <p className="text-sm text-muted-foreground">
                  {server.region.countryCode.toUpperCase()} — {server.region.name}
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
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Public endpoint
                </div>
                <div className="mt-1 font-mono text-sm font-medium">
                  {server.hostname}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {server.ipAddress ?? "No IP address configured"}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  SSH access
                </div>
                <div className="mt-1 font-mono text-sm font-medium">
                  {server.sshUser}@{server.hostname}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Port {server.sshPort}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-md bg-muted/40 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                SSH key
              </div>
              <div className="mt-1 text-sm font-medium">{server.sshKey.name}</div>
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {server.sshKey.fingerprint}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Private key material is hidden. Only key name and fingerprint are shown.
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Protocol configuration</h2>
              <p className="text-sm text-muted-foreground">
                Enabled services and exposed ports for this server.
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
                      {(protocol as { enabled: boolean; port: number | null }).enabled
                        ? `:${(protocol as { port: number | null }).port ?? "?"}`
                        : "No port configured"}
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
                      ? "Enabled"
                      : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Live server metrics</h2>
            <p className="text-sm text-muted-foreground">
              Ports, uptime, vnStat traffic, and top processes from SSH.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={metricsLoading}
          >
            <ArrowClockwise className="mr-2 h-4 w-4" />
            {metricsLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {metricsLoading && !metrics ? (
          <Skeleton className="h-48 w-full" />
        ) : metrics ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                label="Uptime"
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
                label="Memory"
                value={
                  metrics.resources.memory.used === null ||
                  metrics.resources.memory.total === null
                    ? "Unavailable"
                    : `${formatBytes(metrics.resources.memory.used)} / ${formatBytes(metrics.resources.memory.total)}`
                }
                hint="usage / total"
              />
              <MetricCard
                label="Bandwidth this month"
                value={formatBytes(metrics.resources.currentMonthBandwidth)}
                hint="vnStat total"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">Daily traffic</h3>
                <TrafficList rows={metrics.traffic.daily} />
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">Monthly traffic</h3>
                <TrafficList rows={metrics.traffic.monthly} />
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">Top CPU processes</h3>
                <ProcessList rows={metrics.processes.cpu} metric="cpu" />
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">Top memory processes</h3>
                <ProcessList rows={metrics.processes.memory} metric="memory" />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            Metrics unavailable.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">OpenVPN users</h2>
            <p className="text-sm text-muted-foreground">
              Realtime list from the server, not from database.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={usersLoading}>
            <ArrowClockwise className="mr-2 h-4 w-4" />
            {usersLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead>VPN IP</TableHead>
                <TableHead>Real Address</TableHead>
                <TableHead>Traffic</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>IP Allocation</TableHead>
                <TableHead>Serial</TableHead>
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
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No OpenVPN users returned by server.
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
