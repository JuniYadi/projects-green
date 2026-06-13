"use client"

import { useState } from "react"

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
  vpnApi,
  type VpnRegionItem,
  type VpnServerItem,
  type VpnSshKeyItem,
} from "./vpn-admin-client"

const DEFAULT_PORTS = { openVpn: 1194, wireGuard: 51820, proxy: 3128 }

type ProtocolKey = "openVpn" | "wireGuard" | "proxy"

type ProtoState = Record<ProtocolKey, { enabled: boolean; port: number }>

export type ServerFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: VpnServerItem | null
  regions: VpnRegionItem[]
  sshKeys: VpnSshKeyItem[]
  onSaved: () => void | Promise<void>
}

function initialProtocols(editing: VpnServerItem | null): ProtoState {
  return {
    openVpn: {
      enabled: editing?.protocols.openVpn.enabled ?? false,
      port: editing?.protocols.openVpn.port ?? DEFAULT_PORTS.openVpn,
    },
    wireGuard: {
      enabled: editing?.protocols.wireGuard.enabled ?? false,
      port: editing?.protocols.wireGuard.port ?? DEFAULT_PORTS.wireGuard,
    },
    proxy: {
      enabled: editing?.protocols.proxy.enabled ?? false,
      port: editing?.protocols.proxy.port ?? DEFAULT_PORTS.proxy,
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
  regions,
  sshKeys,
  onSaved,
}: ServerFormProps) {
  const [name, setName] = useState(editing?.name ?? "")
  const [regionId, setRegionId] = useState(editing?.region.id ?? "")
  const [hostname, setHostname] = useState(editing?.hostname ?? "")
  const [sshKeyId, setSshKeyId] = useState(editing?.sshKey.id ?? "")
  const [sshUser, setSshUser] = useState(editing?.sshUser ?? "root")
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)
  const [protocols, setProtocols] = useState<ProtoState>(
    initialProtocols(editing)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setProtocol = (key: ProtocolKey, patch: Partial<ProtoState[ProtocolKey]>) =>
    setProtocols((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name,
        regionId,
        hostname,
        sshKeyId,
        sshUser,
        isActive,
        openVpnPort: protocols.openVpn.enabled
          ? protocols.openVpn.port
          : undefined,
        wireGuardPort: protocols.wireGuard.enabled
          ? protocols.wireGuard.port
          : undefined,
        proxyPort: protocols.proxy.enabled ? protocols.proxy.port : undefined,
      }
      if (editing) {
        await vpnApi(`/admin/vpn/servers/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
      } else {
        await vpnApi("/admin/vpn/servers", {
          method: "POST",
          body: JSON.stringify(body),
        })
      }
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Server" : "Add Server"}</DialogTitle>
          <DialogDescription>
            Pick a saved SSH key. Enable at least one protocol.
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
              onChange={(e) => setHostname(e.target.value)}
              placeholder="vpn-id-01.example.net"
            />
          </div>
          <div className="space-y-2">
            <Label>SSH Key</Label>
            <Select value={sshKeyId} onValueChange={setSshKeyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select SSH key" />
              </SelectTrigger>
              <SelectContent>
                {sshKeys.map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    {key.name} ({key.fingerprint})
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
              onChange={(e) => setSshUser(e.target.value)}
              placeholder="root"
            />
          </div>
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
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
