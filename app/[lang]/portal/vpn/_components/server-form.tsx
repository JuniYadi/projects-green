"use client"

import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  testVpnServer,
  updateVpnServer,
  createVpnServer,
  deleteVpnServer,
  type ScanResult,
  type VpnRegionItem,
  type VpnServerItem,
  type VpnSshKeyItem,
} from "./vpn-admin-client"
import { ConnectionTestModal } from "./connection-test-modal"

const DEFAULT_PORTS = { openVpn: 1194, wireGuard: 51820, proxy: 3128 }
const DEFAULT_SSH_PORT = 22

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

type ProtocolKey = "openVpn" | "wireGuard" | "proxy"

type ProtoState = Record<ProtocolKey, { enabled: boolean; port: number }>

export type ServerFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: VpnServerItem | null
  /** When set, prefill from this server as a new (create) server. */
  duplicateFrom?: VpnServerItem | null
  regions: VpnRegionItem[]
  sshKeys: VpnSshKeyItem[]
  onSaved: () => void | Promise<void>
}

function initialProtocols(source: VpnServerItem | null): ProtoState {
  return {
    openVpn: {
      enabled: source?.protocols.openVpn.enabled ?? false,
      port: source?.protocols.openVpn.port ?? DEFAULT_PORTS.openVpn,
    },
    wireGuard: {
      enabled: source?.protocols.wireGuard.enabled ?? false,
      port: source?.protocols.wireGuard.port ?? DEFAULT_PORTS.wireGuard,
    },
    proxy: {
      enabled: source?.protocols.proxy.enabled ?? false,
      port: source?.protocols.proxy.port ?? DEFAULT_PORTS.proxy,
    },
  }
}

const PROTOCOL_LABELS: Record<ProtocolKey, string> = {
  openVpn: "OpenVPN",
  wireGuard: "WireGuard",
  proxy: "Proxy",
}

export function ServerForm({
  open,
  onOpenChange,
  editing,
  duplicateFrom,
  regions,
  sshKeys,
  onSaved,
}: ServerFormProps) {
  // Fields copied when duplicating; name/hostname/ip/sshPort are intentionally cleared.
  const copySource = editing ?? duplicateFrom ?? null
  const [name, setName] = useState(editing?.name ?? "")
  const [regionId, setRegionId] = useState(copySource?.region.id ?? "")
  const [hostname, setHostname] = useState(editing?.hostname ?? "")
  const [ipAddress, setIpAddress] = useState(editing?.ipAddress ?? "")
  const [sshPort, setSshPort] = useState<number>(
    editing?.sshPort ?? DEFAULT_SSH_PORT
  )
  const [sshKeyId, setSshKeyId] = useState(copySource?.sshKey.id ?? "")
  const [sshUser, setSshUser] = useState(copySource?.sshUser ?? "root")
  const [isActive, setIsActive] = useState(copySource?.isActive ?? true)
  const [protocols, setProtocols] = useState<ProtoState>(
    initialProtocols(copySource)
  )
  const [latitude, setLatitude] = useState<number | null>(
    editing?.latitude ?? null
  )
  const [longitude, setLongitude] = useState<number | null>(
    editing?.longitude ?? null
  )
  const [locationSearch, setLocationSearch] = useState("")
  const [searchResults, setSearchResults] = useState<
    { lat: string; lon: string; display_name: string }[]
  >([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)

  // Any field change invalidates a prior connection-test result.
  const clearTestResult = () => setScanResult(null)

  const searchNominatim = async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      // eslint-disable-next-line no-restricted-globals -- Nominatim is an external public API, not our internal API
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { "User-Agent": "ProjectsGreen/1.0" } }
      )
      if (!res.ok) return
      const data = await res.json()
      setSearchResults(data)
    } catch {
      // silently ignore search failures
    } finally {
      setSearching(false)
    }
  }

  const selectLocation = (
    loc: { lat: string; lon: string; display_name: string }
  ) => {
    setLatitude(Number(loc.lat))
    setLongitude(Number(loc.lon))
    setLocationSearch("")
    setSearchResults([])
    clearTestResult()
  }

  const setProtocol = (
    key: ProtocolKey,
    patch: Partial<ProtoState[ProtocolKey]>
  ) => {
    clearTestResult()
    setProtocols((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  // Test Connection only works against a saved server (needs a server id).
  const canTest = Boolean(editing)

  const testConnection = async () => {
    if (!editing) return
    setTesting(true)
    setTestModalOpen(true)
    setScanResult(null)
    try {
      const res = await testVpnServer(editing.id)
      setScanResult(res.data)
    } catch (err) {
      setTestModalOpen(false)
      setError((err as Error).message)
    } finally {
      setTesting(false)
    }
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name,
        regionId,
        hostname,
        ipAddress: ipAddress.trim() ? ipAddress.trim() : undefined,
        sshPort,
        sshKeyId,
        sshUser,
        isActive,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        openVpnPort: protocols.openVpn.enabled
          ? protocols.openVpn.port
          : undefined,
        wireGuardPort: protocols.wireGuard.enabled
          ? protocols.wireGuard.port
          : undefined,
        proxyPort: protocols.proxy.enabled ? protocols.proxy.port : undefined,
      }
      if (editing) {
        // Edit flow: save directly (test is optional)
        await updateVpnServer(editing.id, body)
        onOpenChange(false)
        await onSaved()
      } else {
        // Create flow: save as inactive → test → activate or rollback
        const createBody = { ...body, isActive: false }
        const created = await createVpnServer(createBody)
        const serverId = created.data?.id
        if (!serverId) throw new Error("Server creation failed: invalid response")

        // Run connection test
        setSaving(false)
        setTesting(true)
        let testResult: ScanResult
        try {
          const testRes = await testVpnServer(serverId, {
            signal: AbortSignal.timeout(30_000),
          })
          testResult = testRes.data
        } catch (testErr) {
          // Test request failed (network error, timeout, 500, etc.)
          setTesting(false)
          await rollbackServer(serverId)
          const msg = (testErr as Error).message
          setError(
            msg.includes("timeout")
              ? "Connection test timed out after 30s — server may be unreachable"
              : `Connection test failed: ${msg}`
          )
          return
        }

        // Check SSH reachability
        const sshPassed = testResult.results.some(
          (r) => r.check === "ssh" && r.status === "pass"
        )
        if (!sshPassed) {
          setTesting(false)
          await rollbackServer(serverId)
          const sshResult = testResult.results.find((r) => r.check === "ssh")
          setError(
            `Server unreachable: ${sshResult?.message ?? "SSH connection failed"}`
          )
          return
        }

        // SSH passed → activate the server
        setSaving(true)
        setTesting(false)
        await updateVpnServer(serverId, { ...body, isActive: true })
        onOpenChange(false)
        await onSaved()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
      setTesting(false)
    }
  }

  const rollbackServer = async (serverId: string) => {
    try {
      await deleteVpnServer(serverId)
    } catch (err) {
      console.error(`Failed to rollback server ${serverId}:`, err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Edit Server"
              : duplicateFrom
                ? `Duplicate Server — ${duplicateFrom.name}`
                : "Add Server"}
          </DialogTitle>
          <DialogDescription>
            {duplicateFrom
              ? "Fields are pre-filled from the source. Enter a new name, hostname, IP, and SSH port."
              : "Pick a saved SSH key. Enable at least one protocol."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server-name">Name</Label>
              <Input
                id="server-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ID-01"
              />
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.countryCode.toUpperCase()} — {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-host">Hostname</Label>
              <Input
                id="server-host"
                value={hostname}
                onChange={(e) => {
                  clearTestResult()
                  setHostname(e.target.value)
                }}
                placeholder="vpn-id-01.example.net"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-ip">IP Address</Label>
              <Input
                id="server-ip"
                value={ipAddress}
                onChange={(e) => {
                  clearTestResult()
                  setIpAddress(e.target.value)
                }}
                placeholder="203.0.113.10 (optional)"
              />
              <p className="text-xs text-muted-foreground">
                Optional — fallback if hostname DNS fails. IPv4 or IPv6.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-ssh-port">SSH Port</Label>
              <Input
                id="server-ssh-port"
                type="number"
                value={sshPort}
                onChange={(e) => {
                  clearTestResult()
                  setSshPort(Number(e.target.value))
                }}
                placeholder="22"
              />
            </div>
            <div className="space-y-2">
              <Label>SSH Key</Label>
              <Select
                value={sshKeyId}
                onValueChange={(value) => {
                  clearTestResult()
                  setSshKeyId(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select SSH key" />
                </SelectTrigger>
                <SelectContent>
                  {sshKeys.map((key) => (
                    <SelectItem
                      key={key.id}
                      value={key.id}
                      title={`${key.name} — ${key.fingerprint}`}
                    >
                      <span className="flex max-w-[18rem] items-center gap-2">
                        <span aria-hidden>🔑</span>
                        <span className="truncate">
                          {truncate(key.name, 40)}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {truncate(key.fingerprint, 12)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-ssh-user">SSH User</Label>
              <Input
                id="server-ssh-user"
                value={sshUser}
                onChange={(e) => {
                  clearTestResult()
                  setSshUser(e.target.value)
                }}
                placeholder="root"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <Label>Location (for map pin)</Label>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={locationSearch}
                  onChange={(e) => {
                    setLocationSearch(e.target.value)
                    if (searchTimeoutRef.current)
                      clearTimeout(searchTimeoutRef.current)
                    searchTimeoutRef.current = setTimeout(
                      () => searchNominatim(e.target.value),
                      400
                    )
                  }}
                  placeholder="Search city… Jakarta, Singapore"
                  aria-label="Search location"
                />
                {searching && (
                  <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                    …
                  </span>
                )}
              </div>
              {searchResults.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-md border text-sm">
                  {searchResults.map((loc, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-muted cursor-pointer"
                        onClick={() => selectLocation(loc)}
                      >
                        <span className="line-clamp-1">
                          {loc.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {Number(loc.lat).toFixed(4)},{" "}
                          {Number(loc.lon).toFixed(4)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="server-lat">Latitude</Label>
                <Input
                  id="server-lat"
                  type="number"
                  step="any"
                  value={latitude ?? ""}
                  onChange={(e) => {
                    const val = e.target.value
                    setLatitude(val === "" ? null : Number(val))
                    clearTestResult()
                  }}
                  placeholder="-6.2088"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="server-lng">Longitude</Label>
                <Input
                  id="server-lng"
                  type="number"
                  step="any"
                  value={longitude ?? ""}
                  onChange={(e) => {
                    const val = e.target.value
                    setLongitude(val === "" ? null : Number(val))
                    clearTestResult()
                  }}
                  placeholder="106.8456"
                />
              </div>
            </div>
            {latitude !== null && longitude !== null && (
              <div className="overflow-hidden rounded-md border h-48">
                <iframe
                  title="Server location"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.02},${latitude - 0.02},${longitude + 0.02},${latitude + 0.02}&layer=mapnik&marker=${latitude},${longitude}`}
                  className="h-full w-full border-0"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Protocols &amp; Ports</Label>
            {(Object.keys(PROTOCOL_LABELS) as ProtocolKey[]).map((key) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={protocols[key].enabled}
                    onChange={(e) =>
                      setProtocol(key, { enabled: e.target.checked })
                    }
                  />
                  {PROTOCOL_LABELS[key]}
                </label>
                <Input
                  type="number"
                  value={protocols[key].port}
                  disabled={!protocols[key].enabled}
                  onChange={(e) =>
                    setProtocol(key, { port: Number(e.target.value) })
                  }
                  className="w-28"
                  aria-label={`${PROTOCOL_LABELS[key]} port`}
                />
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>

          {error && (
            <p className="text-sm break-words text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {canTest && (
            <Button
              type="button"
              variant="secondary"
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          )}
          <Button onClick={submit} disabled={saving || testing}>
            {saving
              ? "Saving..."
              : testing
                ? "Testing connection..."
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {editing && (
        <ConnectionTestModal
          open={testModalOpen}
          onOpenChange={setTestModalOpen}
          serverName={editing.name}
          result={scanResult}
          running={testing}
          onRerun={testConnection}
        />
      )}
    </Dialog>
  )
}
