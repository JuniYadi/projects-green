"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

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
import { Input } from "@/components/ui/input"
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
  CopyIcon,
  MagnifyingGlassIcon,
  EyeIcon,
} from "@phosphor-icons/react"

import { ServerForm } from "./server-form"
import { ConnectionTestModal } from "./connection-test-modal"
import {
  listVpnServers,
  listVpnRegions,
  listVpnSshKeys,
  deleteVpnServer,
  testVpnServer,
  type ScanResult,
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
  const [searchFilter, setSearchFilter] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VpnServerItem | null>(null)
  const [duplicating, setDuplicating] = useState<VpnServerItem | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testTarget, setTestTarget] = useState<VpnServerItem | null>(null)
  const [testResult, setTestResult] = useState<ScanResult | null>(null)

  const loadServers = useCallback(async (regionId: string, search: string) => {
    setLoading(true)
    setError(null)
    try {
      const qs: Record<string, string> = {}
      if (regionId && regionId !== "all") qs.regionId = regionId
      if (search) qs.search = search
      const res = await listVpnServers(
        Object.keys(qs).length > 0 ? qs : undefined
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
        listVpnRegions(),
        listVpnSshKeys(),
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
    const timer = setTimeout(() => {
      setSearchDebounced(searchFilter)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServers(regionFilter, searchDebounced)
  }, [loadServers, regionFilter, searchDebounced])

  const openCreate = () => {
    setEditing(null)
    setDuplicating(null)
    setFormOpen(true)
  }

  const openEdit = (server: VpnServerItem) => {
    setEditing(server)
    setDuplicating(null)
    setFormOpen(true)
  }

  const openDuplicate = (server: VpnServerItem) => {
    setEditing(null)
    setDuplicating(server)
    setFormOpen(true)
  }

  const remove = async (server: VpnServerItem) => {
    if (!window.confirm(`Delete server "${server.name}"?`)) return
    try {
      await deleteVpnServer(server.id)
      await loadServers(regionFilter, searchDebounced)
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  const testConnection = async (server: VpnServerItem) => {
    setTestingId(server.id)
    setTestTarget(server)
    setTestResult(null)
    try {
      const res = await testVpnServer(server.id)
      setTestResult(res.data)
      await loadServers(regionFilter, searchDebounced)
    } catch (err) {
      window.alert((err as Error).message)
      setTestTarget(null)
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchFilter("")
            }}
            placeholder="Search hostname or IP..."
            className="pl-8"
            aria-label="Search servers by hostname or IP"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region.id} value={region.id}>
                  {region.countryCode.toUpperCase()} — {region.name}
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Name</TableHead>
                <TableHead className="min-w-[140px]">Region</TableHead>
                <TableHead className="min-w-[140px]">Host</TableHead>
                <TableHead className="min-w-[120px]">IP</TableHead>
                <TableHead className="min-w-[80px]">OVPN</TableHead>
                <TableHead className="min-w-[80px]">WG</TableHead>
                <TableHead className="min-w-[80px]">Proxy</TableHead>
                <TableHead className="min-w-[80px]">Health</TableHead>
                <TableHead className="min-w-[90px]">Active</TableHead>
                <TableHead className="min-w-[60px] text-center">📍</TableHead>
                <TableHead className="min-w-[180px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : servers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No servers yet.
                  </TableCell>
                </TableRow>
              ) : (
                servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="max-w-[180px] truncate font-medium">
                      <Link
                        href={`/portal/vpn/servers/${server.id}`}
                        className="underline-offset-4 hover:underline"
                        title={server.name}
                      >
                        {server.name}
                      </Link>
                    </TableCell>
                    <TableCell
                      className="max-w-[160px] truncate whitespace-nowrap"
                      title={`${server.region.countryCode.toUpperCase()} — ${server.region.name}`}
                    >
                      {server.region.countryCode.toUpperCase()} —{" "}
                      {server.region.name}
                    </TableCell>
                    <TableCell
                      className="max-w-[160px] truncate font-mono text-xs"
                      title={server.hostname}
                    >
                      {server.hostname}
                    </TableCell>
                    <TableCell
                      className="max-w-[140px] truncate font-mono text-xs"
                      title={server.ipAddress ?? undefined}
                    >
                      {server.ipAddress ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                      <Badge
                        variant={server.isActive ? "default" : "secondary"}
                      >
                        {server.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-center"
                      title={
                        server.latitude && server.longitude
                          ? `${server.latitude}, ${server.longitude}`
                          : undefined
                      }
                    >
                      {server.latitude && server.longitude ? "📍" : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-nowrap justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/portal/vpn/servers/${server.id}`}
                            aria-label={`View details for ${server.name}`}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testConnection(server)}
                          disabled={testingId === server.id}
                          aria-label={`Test connection to ${server.name}`}
                        >
                          <PlugIcon className="h-4 w-4" />
                        </Button>
                        {server.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDuplicate(server)}
                            aria-label={`Duplicate ${server.name}`}
                          >
                            <CopyIcon className="h-4 w-4" />
                          </Button>
                        )}
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
      </div>

      {formOpen && (
        <ServerForm
          key={editing?.id ?? duplicating?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          duplicateFrom={duplicating}
          regions={regions}
          sshKeys={sshKeys}
          onSaved={() => loadServers(regionFilter, searchDebounced)}
        />
      )}

      {testTarget && (
        <ConnectionTestModal
          open={Boolean(testTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setTestTarget(null)
              setTestResult(null)
            }
          }}
          serverName={testTarget.name}
          result={testResult}
          running={testingId === testTarget.id}
          onRerun={() => testConnection(testTarget)}
        />
      )}
    </div>
  )
}
