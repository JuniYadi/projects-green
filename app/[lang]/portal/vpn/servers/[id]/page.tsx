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

function PortBadge({ label, port }: { label: string; port: number | null }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-medium">
        {port ? `:${port}` : "Disabled"}
      </div>
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
            {server?.name ?? "VPN Server"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Realtime OpenVPN users from <code>/root/userlist.sh</code>.
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
        <section className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-muted-foreground">Host</div>
            <div className="font-medium">{server.hostname}</div>
          </div>
          <div>
            <div className="text-muted-foreground">IP</div>
            <div className="font-medium">{server.ipAddress ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">OpenVPN</div>
            <Badge variant={server.protocols.openVpn.enabled ? "default" : "secondary"}>
              {server.protocols.openVpn.enabled
                ? `Enabled :${server.protocols.openVpn.port ?? "?"}`
                : "Disabled"}
            </Badge>
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
              <PortBadge label="OpenVPN Port" port={metrics.ports.openVpn} />
              <PortBadge label="WireGuard Port" port={metrics.ports.wireGuard} />
              <PortBadge label="Proxy Port" port={metrics.ports.proxy} />
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Uptime</div>
                <div className="mt-1 text-sm font-medium">
                  {metrics.uptime ?? "Unavailable"}
                </div>
              </div>
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
                <TableHead>Expires</TableHead>
                <TableHead>IP Allocation</TableHead>
                <TableHead>Serial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
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
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
