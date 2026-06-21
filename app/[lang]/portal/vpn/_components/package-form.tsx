"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  updateVpnPackage,
  createVpnPackage,
  type VpnPackageItem,
  type VpnServerItem,
} from "./vpn-admin-client"

function protocolLabels(server: VpnServerItem): string {
  const labels: string[] = []
  if (server.protocols.openVpn.enabled) labels.push("OpenVPN")
  if (server.protocols.wireGuard.enabled) labels.push("WireGuard")
  if (server.protocols.proxy.enabled) labels.push("Proxy")
  return labels.length > 0 ? labels.join(", ") : "—"
}

export type PackageFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: VpnPackageItem | null
  servers: VpnServerItem[]
  onSaved: () => void | Promise<void>
}

export function PackageForm({
  open,
  onOpenChange,
  editing,
  servers,
  onSaved,
}: PackageFormProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR")
  const [isActive, setIsActive] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(editing?.name ?? "")
    setDescription(editing?.description ?? "")
    setPrice(editing?.price ?? "")
    setCurrency(editing?.currency ?? "IDR")
    setIsActive(editing?.isActive ?? true)
    setSelected(new Set(editing?.servers.map((entry) => entry.server.id) ?? []))
    setError(null)
  }, [open, editing])

  const toggleServer = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name,
        description: description.trim() === "" ? undefined : description.trim(),
        price: Number(price),
        currency,
        isActive,
        serverIds: [...selected],
      }
      if (editing) {
        await updateVpnPackage(editing.id, body)
      } else {
        await createVpnPackage(body)
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
          <DialogTitle>{editing ? "Edit Package" : "Add Package"}</DialogTitle>
          <DialogDescription>
            Pick servers. The user gets ALL protocols enabled on each server.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="package-name">Name</Label>
            <Input
              id="package-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Global Bundle"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="package-description">Description</Label>
            <Input
              id="package-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="All servers, all protocols"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="package-price">Price / month</Label>
              <Input
                id="package-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="100000"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value as "IDR" | "USD")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Servers (user gets ALL protocols enabled)</Label>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Include?</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Protocols</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No servers available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    servers.map((server) => (
                      <TableRow key={server.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selected.has(server.id)}
                            onChange={() => toggleServer(server.id)}
                            aria-label={`Include ${server.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {server.name}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-muted-foreground uppercase">
                            {server.region.countryCode}
                          </span>{" "}
                          {server.region.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {protocolLabels(server)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Protocols are auto-detected from each server&apos;s configuration.
            </p>
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
