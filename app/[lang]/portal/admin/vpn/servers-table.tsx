"use client"

import { useCallback, useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PlusIcon,
  PencilSimpleIcon,
  TrashIcon,
  PlugIcon,
} from "@phosphor-icons/react"

import { ServerForm } from "./server-form"
import {
  vpnApi,
  type VpnRegionItem,
  type VpnServerItem,
  type VpnSshKeyItem,
} from "./vpn-admin-client"

const HEALTH_ICON: Record<VpnServerItem["health"], string> = {
  HEALTHY: "✅",
  WARNING: "🟡",
  DOWN: "🔴",
  UNKNOWN: "⚪",
}

function ProtocolCell({
  enabled,
  port,
}: {
  enabled: boolean
  port: number | null
}) {
  if (!enabled) return <span className="text-muted-foreground">❌</span>
  return (
    <span className="whitespace-nowrap">
      ✅ <span className="font-mono text-xs">:{port}</span>
    </span>
  )
}

export function ServersTable() {
  const [servers, setServers] = useState<VpnServerItem[]>([])
  const [regions, setRegions] = useState<VpnRegionItem[]>([])
  const [sshKeys, setSshKeys] = useState<VpnSshKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VpnServerItem | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const loadServers = useCallback(async (regionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const qs =
        regionId && regionId !== "all"
          ? `?regionId=${encodeURIComponent(regionId)}`
          : ""
      const res = await vpnApi<{ ok: true; data: VpnServerItem[] }>(
        `/admin/vpn/servers${qs}`
      )
      setServers(res.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRefs = useCallback(async () => {
    try {
      const [regionsRes, keysRes] = await Promise.all([
        vpnApi<{ ok: true; data: VpnRegionItem[] }>("/admin/vpn/regions"),
        vpnApi<{ ok: true; data: VpnSshKeyItem[] }>("/admin/vpn/ssh-keys"),
      ])
      setRegions(regionsRes.data)
      setSshKeys(keysRes.data)
    } catch {
      // Surface only the server-list error; refs failure shows as empty selects.
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRefs()
  }, [loadRefs])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServers(regionFilter)
  }, [loadServers, regionFilter])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (server: VpnServerItem) => {
    setEditing(server)
    setFormOpen(true)
  }

  const remove = async (server: VpnServerItem) => {
    if (!window.confirm(`Delete server "${server.name}"?`)) return
    try {
      await vpnApi(`/admin/vpn/servers/${server.id}`, { method: "DELETE" })
      await loadServers(regionFilter)
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  const testConnection = async (server: VpnServerItem) => {
    setTestingId(server.id)
    try {
      const res = await vpnApi<{
        ok: true
        data: { reachable: boolean; message: string }
      }>(`/admin/vpn/servers/${server.id}/test`, { method: "POST" })
      window.alert(
        `${res.data.reachable ? "✅" : "🔴"} ${res.data.message}`
      )
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add VPN servers and control which protocols each supports.
        </p>
        <div className="flex items-center gap-2">
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region.id} value={region.id}>
                  {region.flagEmoji} {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} size="sm">
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Server
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>OpenVPN</TableHead>
              <TableHead>WG</TableHead>
              <TableHead>Proxy</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : servers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-sm text-muted-foreground"
                >
                  No servers yet.
                </TableCell>
              </TableRow>
            ) : (
              servers.map((server) => (
                <TableRow key={server.id}>
                  <TableCell className="font-medium">{server.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {server.region.flagEmoji} {server.region.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {server.hostname}
                  </TableCell>
                  <TableCell>
                    <ProtocolCell
                      enabled={server.protocols.openVpn.enabled}
                      port={server.protocols.openVpn.port}
                    />
                  </TableCell>
                  <TableCell>
                    <ProtocolCell
                      enabled={server.protocols.wireGuard.enabled}
                      port={server.protocols.wireGuard.port}
                    />
                  </TableCell>
                  <TableCell>
                    <ProtocolCell
                      enabled={server.protocols.proxy.enabled}
                      port={server.protocols.proxy.port}
                    />
                  </TableCell>
                  <TableCell title={server.health}>
                    {HEALTH_ICON[server.health]}
                  </TableCell>
                  <TableCell>
                    <Badge variant={server.isActive ? "default" : "secondary"}>
                      {server.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => testConnection(server)}
                        disabled={testingId === server.id}
                        aria-label={`Test connection to ${server.name}`}
                      >
                        <PlugIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(server)}
                        aria-label={`Edit ${server.name}`}
                      >
                        <PencilSimpleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(server)}
                        aria-label={`Delete ${server.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {formOpen && (
        <ServerForm
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          regions={regions}
          sshKeys={sshKeys}
          onSaved={() => loadServers(regionFilter)}
        />
      )}
    </div>
  )
}
